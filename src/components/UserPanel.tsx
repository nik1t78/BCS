import React, { useState, useEffect, useRef } from "react";
import { User, Meeting, Tag, ScheduleConflict } from "../types";
import { roomsAPI, meetingsAPI, syncServerTime, serverNowDate, serverTodayKeyTz, serverNowHmTz } from "../api/client";
import {
  getMeetings,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  cancelMeeting,
  getUsersForDisplay,
  getTags,
  checkConflictsApi,
  clearLastMeetingSaveError,
} from "../store-api";
// lastMeetingSaveError — mutable export: читаем актуальное значение через namespace-import
import * as storeApi from "../store-api";
import TagsSelector from "./TagsSelector";
import MeetingRsvp from "./MeetingRsvp";
import { describeRRule } from "../utils/recurrence";
import MeetingHistoryView from "./MeetingHistoryView";
import MeetingMinutes from "./MeetingMinutes";
import { SortMode, SORT_OPTIONS, sortMeetings, getMeetingGroup } from "../utils/meetingSort";
import { exportMeetingToIcs } from "../utils/ics";
import { getFavoriteIds, toggleFavorite, addFavorites } from "../utils/favorites";
import {
  generateVksLink,
  normalizeVksLink,
  isVksLink,
  buildJoinUrl,
  extractPswFromAny,
  sanitizeVksLink,
  vksRoomCodeFromLink,
  vksPasswordFromLink,
} from "../utils/vksLink";
import { createVksViaBot } from "../utils/vksBot";
import { isLateTime, LATE_CREATE_LIMIT_HM } from "../utils/freeSlots";

/** «Сегодня» по локальному времени устройства — НЕ через toISOString()
 *  (UTC может сдвигать дату на день назад/вперёд → виджет показывал
 *  «вчерашнюю» дату, а линия текущего времени расходилась с реальностью). */
export const localTodayKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** «Сегодня» по ЧАСАМ СЕРВЕРА И В ПОЯСЕ СЕРВЕРА (Europe/Moscow, см. /api/time).
 *  Используется в форме создания встречи: сервер проверяет «прошедшее время»
 *  по своим часам и своему поясу. Если часы/пояс браузера расходятся,
 *  локальная дата/время «не совпадают» с серверными и корректный выбор
 *  отклоняется. min даты и проверка прошлого считаются от серверного «сейчас».
 *  Реализация — через Intl.DateTimeFormat(timeZone сервера), поэтому даже у
 *  пользователя из другого часового пояса «сегодня» = те же сутки, что у Laravel. */
export const serverTodayKey = (): string => serverTodayKeyTz();

/** «Сейчас» (HH:mm) по часам и поясу сервера — нижняя граница времени начала встречи сегодня. */
export const serverNowHm = (): string => serverNowHmTz();

/** Нижняя граница для поля «Начало» (type=time): если встреча сегодня —
 *  не раньше текущего серверного времени (с поправкой offset из /api/time),
 *  иначе можно выбрать уже прошедший слот и сервер отклонит заявку. */
export const minStartHm = (dateKey: string): string => {
  return dateKey === serverTodayKey() ? serverNowHm() : "00:00";
};

/** Автоподгонка времени под выбранную дату/границы (см. эффекты в форме):
 *  начало сдвигается на «сейчас» (серверные часы), конец — минимум +30 мин. */
export const clampFormTimes = (
  date: string,
  startTime: string,
  endTime: string
): { startTime: string; endTime: string } => {
  let s = startTime || "10:00";
  let e = endTime || "";
  const minS = minStartHm(date);
  if (s < minS) s = minS;
  // не позже предела вечернего создания (20:00)
  if (isLateTime(s)) s = LATE_CREATE_LIMIT_HM;
  if (!e || e <= s) {
    const [h, m] = s.split(":").map((x) => parseInt(x, 10) || 0);
    const total = Math.min(h * 60 + m + 30, 23 * 60 + 59);
    e = `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }
  return { startTime: s, endTime: e };
};

/** Предзаполнение формы создания конференции (например, из блока «Свободные залы» на главной) */
export interface MeetingPrefill {
  date?: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  room?: string; // название переговорной
  autoLink?: boolean; // сразу сгенерировать ссылку ВКС
  /** Готовая ссылка ВКС (например, созданная на этапе выбора зала) */
  link?: string;
}

interface UserPanelProps {
  user: User;
  onNavigate: (page: string) => void;
  /** Передаётся при переходе с главной («Свободные залы» → создание ВКС) */
  initialPrefill?: MeetingPrefill | null;
  /** Вызывается после применения предзаполнения — родитель может его сбросить */
  onPrefillConsumed?: () => void;
  /** Компактный режим: только форма создания ВКС (используется в модалке на главной) */
  formOnly?: boolean;
  /** Вызывается после успешного создания конференции (для закрытия модалки) */
  onCreated?: () => void;
  /** Закрытие формы без сохранения (в режиме formOnly — закрыть модалку на главной) */
  onClose?: () => void;
}

// На главной странице раздела «Мои конференции» показываем первые TEASER_COUNT
// конференций (10), остальные — отдельной страницей-панелью («Все конференции»)
// по PAGE_SIZE за подгрузку.
const PAGE_SIZE = 20;
const TEASER_COUNT = 10;

// Напоминания по умолчанию для новых конференций — из настроек пользователя
const getDefaultReminder = (): number => {
  try {
    const raw = localStorage.getItem("vks_reminder_default");
    const v = raw ? parseInt(raw, 10) : NaN;
    if (!Number.isNaN(v) && v >= 5 && v <= 1440) return v;
  } catch {
    /* ignore */
  }
  return 15;
};

/** Надёжное чтение reminderMinutes: если в localStorage («myMeetings» профиль,
 *  шаблон, предзаполнение) затёрлось/повредилось значение (undefined, NaN, 0,
 *  «abc»), сервер отклонял заявку с «напоминание — от 5 до 1440 минут».
 *  Возвращаем валидное число всегда. */
export const normalizeReminderMinutes = (v: unknown): number => {
  const n = typeof v === "string" ? parseInt(v, 10) : Number(v);
  if (!Number.isFinite(n)) return getDefaultReminder();
  if (n < 5) return 5;
  if (n > 1440) return 1440;
  return Math.round(n);
};

/** Приведение времени к формату HH:mm (сервер может вернуть '14:30:00',
 *  фронт отправляет обратно — жёсткая валидация H:i отваливалась на этом). */
export const normHm = (v: unknown): string => {
  const s = String(v ?? "");
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return s;
  return `${String(parseInt(m[1], 10)).padStart(2, "0")}:${m[2]}`;
};

// Копирование текста в буфер обмена (код конференции / пароль ВКС)
const copyText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* браузер не дал доступ к буферу */
    return false;
  }
};

interface CreateMeetingFormProps {
  formData: Meeting;
  setFormData: React.Dispatch<React.SetStateAction<Meeting>>;
  /** Каталог переговорных комнат для подсказок в поле «Комната» */
  roomsCatalog: { name: string; capacity: number; equipment: string[] }[];
  users: User[];
  tags: Tag[];
  conflicts: ScheduleConflict[];
  editing?: boolean;
  /** Текст-индикатор («Создаём ссылку ВКС…») — показывается над кнопками */
  savingNote?: string | null;
  /** Копирование в буфер обмена (код/пароль конференции) + зелёная подсказка */
  copyToClipboard?: (text: string, okLabel?: string) => Promise<void> | void;
  vksHint?: string | null;
  onCancel: () => void;
  handleSubmit: (e: React.FormEvent) => void;
}

/** Данные приглашения участников из текущей ссылки ВКС.
 *  ВАЖНО: buildJoinUrl ждёт ПОЛНУЮ ссылку (https://salutejazz.ru/calls/<код>?psw=<пароль>). */
export function computeInviteData(
  link?: string | null
): { joinUrl: string; code: string; psw: string | null; inviteText: string } | null {
  if (!link || !isVksLink(link)) return null;
  const clean = sanitizeVksLink(link);
  const code = vksRoomCodeFromLink(clean);
  if (!code) return null;
  const psw = vksPasswordFromLink(clean);
  const joinUrl = buildJoinUrl(clean, psw ?? undefined) || clean;
  const lines = [
    "Максимальное количество — 100 человек",
    `Адрес видеовстречи: ${joinUrl}`,
    `Код видеовстречи: ${code}@salutejazz.ru`,
  ];
  if (psw) lines.push(`Пароль: ${psw}`);
  return { joinUrl, code, psw, inviteText: lines.join("\n") };
}

/** Блок «Приглашение участников» — общий для обеих форм создания ВКС
 *  (раздел «Мои конференции» и модалка на главной). Раньше каждая форма
 *  имела свою копию рендера, из-за чего после рефакторинга осталась ссылка
 *  на несуществующую renderVksInviteBlock → крах страницы при создании. */
export function VksInviteBlock({
  link,
  copyToClipboard,
}: {
  link?: string | null;
  copyToClipboard?: (text: string, okLabel?: string) => Promise<void> | void;
}) {
  const inviteData = computeInviteData(link);
  if (!inviteData) return null;
  const { joinUrl, code, psw, inviteText } = inviteData;
  return (
    <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-900/20 p-3 text-sm">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
        <span className="font-medium text-gray-800 dark:text-gray-100">
          <i className="fas fa-user-plus mr-1 text-blue-600 dark:text-blue-400" aria-hidden="true"></i>
          Приглашение участников
        </span>
        <button
          type="button"
          onClick={() => copyToClipboard?.(inviteText, "Приглашение скопировано")}
          title="Скопировать всё приглашение целиком"
          className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium whitespace-nowrap"
        >
          <i className="fas fa-copy mr-1" aria-hidden="true"></i>
          Копировать приглашение
        </button>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Максимальное количество — 100 человек</p>
      <div className="space-y-1.5">
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Адрес видеовстречи</div>
          <div className="font-mono text-xs break-all text-gray-800 dark:text-gray-100">{joinUrl}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Код видеовстречи</div>
          <div className="font-mono text-xs text-gray-800 dark:text-gray-100">{code}@salutejazz.ru</div>
        </div>
        {psw && (
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Пароль</div>
            <div className="font-mono text-xs text-gray-800 dark:text-gray-100">{psw}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Форма создания/редактирования конференции — вынесена из UserPanel,
 *  чтобы открываться и в разделе «Мои конференции», и в модалке на главной. */
function CreateMeetingForm({
  formData,
  setFormData,
  roomsCatalog,
  users,
  tags,
  conflicts,
  editing,
  savingNote,
  copyToClipboard,
  vksHint,
  onCancel,
  handleSubmit,
}: CreateMeetingFormProps) {
  const toggleParticipant = (userId: string) => {
    setFormData((f) => {
      const has = (f.participants ?? []).some((id) => String(id) === String(userId));
      return {
        ...f,
        participants: has
          ? (f.participants ?? []).filter((id) => String(id) !== String(userId))
          : [...(f.participants ?? []), userId],
      };
    });
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {conflicts.length > 0 && (
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 text-sm text-amber-800 dark:text-amber-200">
          <p className="font-medium mb-1">
            <i className="fas fa-exclamation-triangle mr-1"></i>Конфликты расписания ({conflicts.length}):
          </p>
          <ul className="list-disc list-inside space-y-0.5">
            {conflicts.map((c: ScheduleConflict) => (
              <li key={String(c.meeting_id)}>
                «{c.title}» {c.start_time}–{c.end_time}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Название *</label>
          <input
            type="text"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
            placeholder="Название конференции"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Описание</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
            rows={2}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Дата *</label>
          <input
            type="date"
            required
            min={serverTodayKey()}
            value={formData.date}
            onChange={(e) => {
              const date = e.target.value;
              setFormData((f) => {
                const next = { ...f, date };
                // «всё уехало»: при смене даты на сегодня автоподгоняем
                // прошедшее время начала/окончания под серверные часы.
                if (!editing) {
                  const clamped = clampFormTimes(date, next.startTime, next.endTime);
                  next.startTime = clamped.startTime;
                  next.endTime = clamped.endTime;
                }
                return next;
              });
            }}
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Комната</label>
          <select
            value={formData.room}
            onChange={(e) => setFormData({ ...formData, room: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
          >
            {/* Комната всегда должна открываться для выбора: пустая опция
                разворачивает список, а каталог залов заполняется из API */}
            <option value="">— Выберите комнату —</option>
            {roomsCatalog.map((r) => (
              <option key={r.name} value={r.name}>
                {r.name}
              </option>
            ))}
            {/* Если введённой ранее комнаты нет в каталоге — не теряем её */}
            {formData.room && !roomsCatalog.some((r) => r.name === formData.room) && (
              <option value={formData.room}>{formData.room}</option>
            )}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Начало *</label>
          <input
            type="time"
            required
            min={editing ? undefined : minStartHm(formData.date)}
            max={LATE_CREATE_LIMIT_HM}
            value={formData.startTime}
            onChange={(e) => {
              const startTime = e.target.value;
              setFormData((f) => {
                const next = { ...f, startTime };
                // конец всегда позже начала — иначе 422/500 от сервера
                if (!next.endTime || next.endTime <= startTime) {
                  const [h, m] = startTime.split(":").map((x) => parseInt(x, 10) || 0);
                  const total = Math.min(h * 60 + m + 60, 23 * 60 + 59);
                  next.endTime = `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
                }
                return next;
              });
            }}
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
          />
          {!editing && formData.date === serverTodayKey() && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Сегодня можно выбрать время не раньше {minStartHm(formData.date)} (по часам сервера).
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Конец *</label>
          <input
            type="time"
            required
            min={formData.startTime}
            value={formData.endTime}
            onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ссылка ВКС</label>
          <div className="flex gap-2 flex-wrap">
            <input
              type="text"
              inputMode="url"
              value={formData.link}
              onChange={(e) => setFormData({ ...formData, link: e.target.value })}
              onPaste={(e) => {
                // разрешаем вставку любой ссылки (в т.ч. вручную созданной на salutejazz.ru)
                const t = e.clipboardData.getData("text");
                if (t) {
                  e.preventDefault();
                  setFormData({ ...formData, link: t.trim() });
                }
              }}
              className="flex-1 min-w-[180px] px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
              placeholder="https://salutejazz.ru/calls/... или вставьте свою ссылку"
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Ссылка ВКС создаётся автоматически при сохранении встречи (бот проходит salutejazz.ru/calls/create). При
            желании можно вставить свою ссылку — она сохранится как есть. Данные для приглашения участников показаны
            ниже.
          </p>
          {isVksLink(formData.link) && vksHint && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
              <i className="fas fa-check mr-1"></i>
              {vksHint}
            </p>
          )}
          {isVksLink(formData.link) && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
              <i className="fas fa-check-circle mr-1" aria-hidden="true"></i>
              Ссылка на корпоративную ВКС
            </p>
          )}
          <VksInviteBlock link={formData.link} copyToClipboard={copyToClipboard} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Приоритет</label>
          <select
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: e.target.value as Meeting["priority"] })}
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="low">Низкий</option>
            <option value="medium">Средний</option>
            <option value="high">Высокий</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Повтор</label>
          <select
            value={formData.recurring}
            onChange={(e) => setFormData({ ...formData, recurring: e.target.value as Meeting["recurring"] })}
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="none">Без повтора</option>
            <option value="daily">Ежедневно</option>
            <option value="weekly">Еженедельно</option>
            <option value="monthly">Ежемесячно</option>
            <option value="custom">По правилу (RRULE)…</option>
          </select>
        </div>
        {formData.recurring === "custom" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Правило RRULE</label>
            <input
              type="text"
              value={formData.rrule ?? ""}
              placeholder="FREQ=MONTHLY;BYDAY=FR;BYSETPOS=-1"
              onChange={(e) => setFormData({ ...formData, rrule: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500 font-mono text-xs"
            />
            <div className="flex flex-wrap gap-1 mt-1.5">
              {[
                ["FREQ=WEEKLY;INTERVAL=2;BYDAY=MO", "кажд. 2 нед. пн"],
                ["FREQ=MONTHLY;BYDAY=FR;BYSETPOS=-1", "послед. пятница мес."],
                ["FREQ=MONTHLY;BYDAY=MO;BYSETPOS=1", "перв. понедельник мес."],
                ["FREQ=DAILY;INTERVAL=3", "каждые 3 дня"],
              ].map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setFormData({ ...formData, rrule: val })}
                  className={`px-2 py-0.5 rounded text-[11px] border ${formData.rrule === val ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"}`}
                  title={val}
                >
                  {label}
                </button>
              ))}
            </div>
            {formData.rrule && (
              <p className="text-[11px] text-gray-400 mt-1">
                <i className="fas fa-sync-alt mr-1"></i>
                {describeRRule(formData.rrule)}
              </p>
            )}
          </div>
        )}
        {formData.recurring !== "none" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Повторять до (опционально)
            </label>
            <input
              type="date"
              value={formData.repeatUntil ?? ""}
              min={formData.date}
              onChange={(e) => setFormData({ ...formData, repeatUntil: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>
        )}
      </div>

      {/* Participants */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Участники ({formData.participants.length} выбрано)
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          <i className="fas fa-info-circle mr-1"></i>
          Выберите зарегистрированных пользователей из списка ниже
        </p>

        {users.length === 0 ? (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <i className="fas fa-exclamation-triangle mr-2"></i>В системе нет зарегистрированных пользователей.
            </p>
          </div>
        ) : (
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 max-h-64 overflow-y-auto">
            <div className="space-y-2">
              {users
                .filter((u) => u.isActive)
                .map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggleParticipant(u.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg border transition-colors flex items-center gap-3 ${
                      (formData.participants ?? []).some((id) => String(id) === String(u.id))
                        ? "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700"
                        : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                        (formData.participants ?? []).some((id) => String(id) === String(u.id))
                          ? "bg-blue-600 border-blue-600"
                          : "bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-500"
                      }`}
                    >
                      {(formData.participants ?? []).some((id) => String(id) === String(u.id)) && (
                        <i className="fas fa-check text-white text-xs"></i>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800 dark:text-gray-100 text-sm">{u.name}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            u.role === "admin"
                              ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                              : u.role === "moderator"
                                ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400"
                                : "bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {u.role === "admin" ? "Админ" : u.role === "moderator" ? "Модератор" : "Пользователь"}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        @{u.login}
                        {u.department && <span className="ml-2">• {u.department}</span>}
                      </div>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
        >
          Отмена
        </button>
        <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
          {savingNote ? (
            <span className="flex items-center gap-2">
              <i className="fas fa-spinner fa-spin"></i>
              {savingNote}
            </span>
          ) : editing ? (
            "Сохранить"
          ) : (
            "Создать ВКС"
          )}
        </button>
      </div>
    </form>
  );
}

export default function UserPanel({
  user,
  onNavigate,
  initialPrefill,
  onPrefillConsumed,
  formOnly,
  onCreated,
  onClose,
}: UserPanelProps) {
  // короткая зелёная подсказка после копирования кода/пароля конференции
  const [vksHint, setVksHint] = useState<string | null>(null);
  const copyToClipboard = async (text: string, okLabel?: string) => {
    if ((await copyText(text)) && okLabel) {
      setVksHint(okLabel);
      setTimeout(() => setVksHint((h) => (h === okLabel ? null : h)), 2500);
    }
  };
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  // formOnly (модалка «Создание ВКС» поверх главной): НЕ начинаем с loading=true —
  // иначе при каждом обновлении списка встреч (loadData после onCreated) панель
  // на мгновение размонтируется («исчезает») и форма закрывается сама.
  const [loading, setLoading] = useState(!formOnly);
  const [error, setError] = useState(false);
  // Модальное окно просмотра конференции (доступен всем участникам)
  const [viewMeeting, setViewMeeting] = useState<Meeting | null>(null);
  // Фильтры, календарь, избранное, массовые действия, история изменений
  const [statusFilter, setStatusFilter] = useState<"all" | "upcoming" | "past" | "cancelled">("all");
  const [roomFilter, setRoomFilter] = useState("");
  const [roomsCatalog, setRoomsCatalog] = useState<{ name: string; capacity: number; equipment: string[] }[]>([]);
  const [tagFilter, setTagFilter] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "calendar">("list");
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth(), d: d.getDate() };
  });
  const [calView, setCalView] = useState<"month" | "week">("month");
  const [favorites, setFavorites] = useState<Set<string>>(() => getFavoriteIds(user.id));
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // «Все конференции» — отдельная страница-панель поверх раздела; visibleCount
  // на ней растёт кнопкой «Показать ещё». На главной странице списка всегда
  // видно не больше TEASER_COUNT карточек.
  const [showAllPage, setShowAllPage] = useState(false);
  const [visibleCount, setVisibleCount] = useState(TEASER_COUNT);
  // Компактный режим списка (адаптивен для мобильных и «плотного» просмотра)
  const [compact, setCompact] = useState<boolean>(() => {
    try {
      return localStorage.getItem("vks_compact_list") === "1";
    } catch {
      return false;
    }
  });
  const toggleCompact = () =>
    setCompact((c) => {
      try {
        localStorage.setItem("vks_compact_list", c ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !c;
    });

  const emptyMeeting: Meeting = {
    id: "",
    title: "",
    description: "",
    date: serverTodayKey(),
    // Время начала по умолчанию — на 10 минут позже «сейчас» по серверным
    // часам, чтобы при открытии формы сразу был валидный слот (иначе
    // дефолт 10:00 оказывается в прошлом и сервер отклоняет заявку).
    startTime: (() => {
      // serverNowHm() уже в поясе сервера (см. /api/time): прибавляем 10 минут
      const [h, m] = serverNowHm().split(":").map(Number);
      const total = Math.min(h * 60 + m + 10, 20 * 60);
      return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
    })(),
    endTime: (() => {
      const [h, m] = serverNowHm().split(":").map(Number);
      const total = Math.min(h * 60 + m + 70, 20 * 60);
      return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
    })(),
    organizerId: user.id,
    participants: [user.id],
    participantEmails: [],
    // Ссылка ВКС ПУСТАЯ: живая комната создаётся Selenium-ботом на
    // salutejazz.ru при сохранении (handleSave). Локальная заглушка давала
    // несуществующий код комнаты → «неправильный пароль» при входе.
    link: "",
    room: "",
    status: "scheduled",
    reminderMinutes: getDefaultReminder(),
    recurring: "none",
    priority: "medium",
    createdAt: new Date().toISOString(),
    isPrivate: false,
  };

  const [formData, setFormData] = useState<Meeting>(() => {
    // ВАЖНО: если форма открыта сразу с предзаполнением (модалка «Выбор зала»
    // из плашек «Свободные залы» / «Расписание аудиторий»), начальные значения
    // должны содержать prefill СРАЗУ. Иначе первый рендер показывает пустую
    // форму, а эффект ниже после onPrefillConsumed() родитель сбрасывает
    // initialPrefill в null — предзаполнение теряется и окно «быстро
    // закрывается», выбрать ничего нельзя.
    if (initialPrefill) {
      return {
        ...emptyMeeting,
        date: initialPrefill.date ?? emptyMeeting.date,
        startTime: initialPrefill.startTime ?? emptyMeeting.startTime,
        endTime: initialPrefill.endTime ?? emptyMeeting.endTime,
        room: initialPrefill.room || emptyMeeting.room,
        // Ссылка: либо готовая из prefill (например, вставленная вручную),
        // либо пустая — живая комната создаётся Selenium-ботом при сохранении.
        link: initialPrefill.link || "",
      };
    }
    return emptyMeeting;
  });
  // Индикатор: «Создаём ссылку ВКС…» (пока Selenium-бот работает на salutejazz.ru)
  const [savingNote, setSavingNote] = useState<string | null>(null);

  // Предзаполнение из виджета «Свободные залы» на главной: открываем форму
  // создания ВКС с датой/временем/залом и сразу сгенерированной ссылкой.
  useEffect(() => {
    if (!initialPrefill) return;
    const p = initialPrefill;
    setEditingMeeting(null);
    setFormData({
      ...emptyMeeting,
      date: p.date ?? emptyMeeting.date,
      startTime: p.startTime ?? emptyMeeting.startTime,
      endTime: p.endTime ?? emptyMeeting.endTime,
      room: p.room || emptyMeeting.room,
      // Ссылка: готовая из prefill или пустая (бот создаст живую комнату при сохранении).
      link: p.link || "",
    });
    setShowForm(true);
    // formOnly: НЕ уведомляем родителя о «потреблении» предзаполнения —
    // иначе Dashboard делает setCreatePrefill(null), панель «Создание ВКС»
    // мгновенно размонтируется и форма закрывается раньше, чем пользователь
    // что-либо выбрал. Для formOnly панель закрывается только через
    // onCreated / кнопку «×».
    if (!formOnly) onPrefillConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrefill]);

  useEffect(() => {
    loadData();
  }, [user.id, showForm]);

  // Автоподгонка времени при открытии формы «Новая конференция» (не при
  // редактировании): если дефолтный/предзаполненный слот уже прошёл по
  // серверным часам — сдвигаем начало на «сейчас+10 мин», конец +30 мин.
  // Пользователь потом спокойно меняет время в полях формы.
  useEffect(() => {
    if (!showForm || editingMeeting) return;
    let cancelled = false;
    syncServerTime().finally(() => {
      if (cancelled) return;
      setFormData((f) => {
        const minS = minStartHm(f.date);
        if (f.startTime >= minS && f.endTime > f.startTime) return f;
        const clamped = clampFormTimes(f.date, minS, "");
        return { ...f, startTime: clamped.startTime, endTime: clamped.endTime };
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForm]);

  const loadData = async () => {
    setLoading(true);
    const [allMeetings, allUsers, allTags] = await Promise.all([
      getMeetings(),
      getUsersForDisplay(user.role),
      getTags(),
    ]);

    // Модераторы и админы видят все конференции, обычные пользователи - тоже все
    // (но могут редактировать только свои)
    setMeetings(allMeetings);
    setUsers(allUsers);
    setTags(allTags);
    // getMeetings при ошибке API (401/500/нет связи с бэкендом) возвращает [] —
    // показываем явную ошибку вместо пустого «Нет конференций»
    setError(allMeetings.length === 0 && allUsers.length === 0);
    setLoading(false);
  };

  // Все конференции видны в списке без фильтров «Организованные/Участие».
  // Сортировка: по умолчанию «умная» — сначала сегодняшние ВКС, затем завтра,
  // ближайшая неделя, поздние и в конце прошедшие/отменённые.
  const [sortMode, setSortMode] = useState<SortMode>("smart");

  // ===== Фильтры: статус / комната / тег / поиск по названию, описанию, участникам =====
  // «Сейчас» в локальном времени (YYYY-MM-DDTHH:mm) — toISOString() даёт UTC
  // и мог считать встречи прошедшими/будущими с ошибкой до нескольких часов.
  const nowIso = () => {
    const n = new Date();
    return `${localTodayKey()}T${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
  };
  useEffect(() => {
    const mapRoom = (r: any) => ({
      name: r.name,
      capacity: r.capacity ?? 0,
      equipment: r.equipment ?? [],
    });
    roomsAPI
      .list()
      .then((res: any) => {
        const list = (res?.data ?? []).map(mapRoom);
        if (list.length) {
          setRoomsCatalog(list);
          return;
        }
        throw new Error("empty");
      })
      .catch(() => {
        // 403/404 на справочнике GET /rooms (роль «user» или старый бэкенд):
        // каталог залов берём из агрегированного /meetings/rooms-availability.
        // Дату берём по ЧАСАМ СЕРВЕРА — локальные часы в docker-окружении могут
        // расходиться, и сервер вернёт пустой список для «своей» даты.
        meetingsAPI
          .roomsAvailability({ date: serverTodayKey() })
          .then((av: any) => {
            const list: any[] = av?.data ?? av ?? [];
            setRoomsCatalog(list.map(mapRoom));
          })
          .catch(() => {});
      });
  }, []);

  const rooms = Array.from(
    new Set([...(meetings.map((m) => m.room).filter(Boolean) as string[]), ...roomsCatalog.map((r) => r.name)])
  ).sort();
  const matchSearch = (m: Meeting) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    const inTitle = m.title.toLowerCase().includes(q);
    const inDesc = (m.description ?? "").toLowerCase().includes(q);
    const inPeople =
      getUserName(m.organizerId).toLowerCase().includes(q) ||
      (m.participants ?? []).some((p) => getUserName(p).toLowerCase().includes(q));
    return inTitle || inDesc || inPeople;
  };
  const filteredMeetings = meetings.filter((m) => {
    if (onlyFavorites && !favorites.has(String(m.id))) return false;
    if (roomFilter && (m.room ?? "") !== roomFilter) return false;
    if (tagFilter && !(m.tags ?? []).map(String).includes(tagFilter)) return false;
    if (statusFilter === "cancelled" && m.status !== "cancelled") return false;
    if (statusFilter === "past") {
      const isPast = m.status === "completed" || `${m.date}T${m.endTime || "23:59"}` < nowIso();
      if (!isPast || m.status === "cancelled") return false;
    }
    if (statusFilter === "upcoming") {
      const isUpcoming = m.status === "scheduled" || m.status === "in-progress";
      if (!isUpcoming || `${m.date}T${m.endTime || "23:59"}` < nowIso()) return false;
    }
    return matchSearch(m);
  });
  const sortedMeetings = sortMeetings(filteredMeetings, sortMode);
  // В «умном» режиме группы показываем заголовками-разделителями
  const showGroups = sortMode === "smart";

  // Сброс пагинации при смене фильтров (на панели «Все конференции» — до
  // размера одной страницы, на главной списке — до тизерных 10 карточек)
  useEffect(() => {
    setVisibleCount(showAllPage ? PAGE_SIZE : TEASER_COUNT);
    setSelected(new Set());
  }, [statusFilter, roomFilter, tagFilter, search, onlyFavorites, sortMode, showAllPage]);

  const toggleFavoriteMeeting = (id: string) => setFavorites(toggleFavorite(user.id, id));
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const allVisibleSelected = sortedMeetings.length > 0 && sortedMeetings.every((m) => selected.has(String(m.id)));
  const toggleSelectAll = () => {
    if (allVisibleSelected) setSelected(new Set());
    else setSelected(new Set(sortedMeetings.map((m) => String(m.id))));
  };

  // Массовые действия: отмена / удаление / избранное для выделенных чекбоксами
  const bulkAction = async (action: "cancel" | "delete" | "favorite") => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (action === "delete" && !confirm(`Удалить выбранные конференции (${ids.length})?`)) return;
    if (
      action === "cancel" &&
      !confirm(`Отменить выбранные конференции (${ids.length})? Участники получат уведомление.`)
    )
      return;
    if (action === "favorite") {
      setFavorites(addFavorites(user.id, ids));
      setSelected(new Set());
      return;
    }
    for (const id of ids) {
      const m = meetings.find((x) => String(x.id) === id);
      if (!m) continue;
      if (action === "delete") await deleteMeeting(id);
      else if (action === "cancel") await updateMeeting(id, { ...m, status: "cancelled" });
    }
    setSelected(new Set());
    loadData();
  };

  // Отмена встречи организатором из модалки — специальный эндпоинт:
  // сервер ставит статус cancelled и рассылает уведомления участникам.
  const handleCancelMeeting = async (m: Meeting) => {
    const reason = window.prompt("Причина отмены (необязательно, увидят участники):", "") ?? undefined;
    const saved = await cancelMeeting(m.id, reason?.trim() || undefined);
    if (!saved) {
      alert("Не удалось отменить конференцию");
      return;
    }
    setViewMeeting(null);
    loadData();
  };

  // Перенос встречи из модалки — открывает форму редактирования
  const handleRescheduleMeeting = (m: Meeting) => {
    setViewMeeting(null);
    handleEdit(m);
  };

  // История изменений (audit log на бэкенде) выводится компонентом MeetingHistoryView внутри модалки

  // Приглашение/удаление участников прямо из модалки (только организатор)
  const manageParticipantFromModal = async (target: User, add: boolean) => {
    if (!viewMeeting) return;
    const cur = (viewMeeting.participants ?? []).map(String);
    const tid = String(target.id);
    const next = add ? [...cur, tid] : cur.filter((id) => id !== tid);
    const saved = await updateMeeting(viewMeeting.id, { ...viewMeeting, participants: next });
    if (!saved) {
      alert("Не удалось изменить список участников");
      return;
    }
    setViewMeeting({ ...viewMeeting, participants: next });
    loadData();
  };

  // Конфликты расписания при создании/редактировании встречи
  const [conflicts, setConflicts] = useState<ScheduleConflict[]>([]);
  const [conflictChecked, setConflictChecked] = useState(false);
  const [forceSave, setForceSave] = useState(false);
  // Флаг «идёт сохранение» — защита от двойного submit (двойной клик)
  const savingRef = useRef(false);

  const runConflictCheck = async (): Promise<ScheduleConflict[]> => {
    const userIds = [...(formData.participants ?? []), editingMeeting ? editingMeeting.organizerId : user.id]
      .map((x) => String(x))
      .filter(Boolean);
    const found = await checkConflictsApi({
      date: formData.date,
      startTime: formData.startTime,
      endTime: formData.endTime,
      userIds,
      excludeMeetingId: editingMeeting?.id,
    });
    setConflicts(found);
    return found;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Защита от двойной отправки (двойной клик по «Создать»): второй submit
    // создавал дубликат конференции и закрывал панель раньше времени.
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      await handleSubmitInner();
    } finally {
      savingRef.current = false;
    }
  };

  const handleSubmitInner = async () => {
    if (!formData.title || !formData.date || !formData.startTime || !formData.endTime) {
      alert("Заполните все обязательные поля");
      return;
    }
    if (formData.endTime <= formData.startTime) {
      alert("Время окончания должно быть позже времени начала");
      return;
    }
    // Поздним вечером ВКС создавать нельзя: не позже 20:00.
    if (isLateTime(formData.startTime)) {
      alert(`Нельзя создать встречу позже ${LATE_CREATE_LIMIT_HM}. Выберите время начала до ${LATE_CREATE_LIMIT_HM}.`);
      return;
    }
    // В прошедшее время заявки создавать нельзя: дата не раньше сегодня,
    // а если сегодня — начало встречи не раньше текущего момента.
    // (При редактировании существующей встречи проверка не применяется.)
    if (!editingMeeting) {
      const todayKey = serverTodayKey();
      if (formData.date < todayKey) {
        alert("Нельзя создать встречу в прошедшую дату. Выберите сегодня или будущий день.");
        return;
      }
      if (formData.date === todayKey && formData.startTime < serverNowHm()) {
        alert("Это время уже прошло. Нельзя создать заявку на прошедшее время — выберите более поздний слот.");
        return;
      }
    }
    // Валидация пересечений у тех же участников (кроме принудительного сохранения)
    if (!conflictChecked && !forceSave) {
      const found = await runConflictCheck();
      setConflictChecked(true);
      if (found.length > 0) {
        const NL = String.fromCharCode(10);
        const proceed = window.confirm(
          `Обнаружены конфликты расписания (${found.length}):` +
            NL +
            found.map((c) => `• «${c.title}» ${c.start_time}–${c.end_time}`).join(NL) +
            NL +
            NL +
            "Создать встречу всё равно?"
        );
        if (!proceed) return;
        setForceSave(true);
      }
    }

    // createMeeting/updateMeeting возвращают null при ошибке сервера
    // (422 валидация, истёкший токен и т.п.) — без проверки форма
    // «тихо» закрывалась, и казалось, что создание конференции не работает.
    const payload: Meeting = { ...formData };
    // Страховки от «сервер отклонил заявку»: значения полей приводим к тем
    // форматам, которые принимает бэкенд (HH:mm, reminder_minutes 5..1440).
    payload.startTime = normHm(payload.startTime);
    payload.endTime = normHm(payload.endTime);
    payload.reminderMinutes = normalizeReminderMinutes(payload.reminderMinutes);
    if (payload.endTime <= payload.startTime) {
      // конец не позже начала — авто-сдвигаем (+60 мин), иначе валидация
      // 'after:start_time' на сервере вернёт ошибку и встреча не сохранится
      const [h, m] = payload.startTime.split(":").map((x) => parseInt(x, 10) || 0);
      const total = Math.min(h * 60 + m + 60, 23 * 60 + 59);
      payload.endTime = `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
    }
    if (payload.recurring === "none") delete payload.repeatUntil;
    else if (payload.repeatUntil && payload.repeatUntil < payload.date) {
      alert("Дата окончания повтора не может быть раньше даты встречи");
      return;
    }
    // ВКС: ссылка создаётся автоматически. Сначала пробуем Selenium-бота,
    // который реально заходит на https://salutejazz.ru/calls/create, вводит
    // название встречи и имя организатора и возвращает живую ссылку.
    // Если бот недоступен — генерируем ссылку локально в том же формате.
    // ВАЖНО: если ссылка уже есть в поле, но она НЕ ведёт на нашу платформу
    // (например, вставлен текст приглашения или посторонний URL при авто-
    // сценарии), заменяем её автоматически созданной — иначе встреча
    // сохранялась со «странным» адресом вместо рабочей ссылки ВКС.
    if (!payload.link) {
      setSavingNote("Создаём ссылку ВКС на salutejazz.ru…");
      try {
        const botRes = await createVksViaBot(payload.title || "Встреча", user.name);
        payload.link = botRes.link;
        // skipped=true — автосоздание через бота ВЫКЛЮЧЕНО (VITE_VKS_AUTOBOT=0,
        // штатный режим экономии RAM): предупреждать пользователя не нужно.
        // Alert ниже — только при РЕАЛЬНОЙ попытке обратиться к боту, которая
        // не удалась (контейнер vks-bot не запущен / 401 из-за BOT_TOKENS /
        // таймаут Selenium).
        if (!botRes.real && !botRes.skipped) {
          // Бот был ВКЛЮЧЁН (VITE_VKS_AUTOBOT=1), но реально не смог создать
          // встречу — это сбой, о котором пользователя надо предупредить.
          // ВАЖНО: предупреждение адресовано администратору сервера, а НЕ
          // пользователю встречи — встреча всё равно сохранится и работать
          // будет (организатор создаёт комнату вручную по кнопке «Создать
          // вручную» на salutejazz.ru). Команда ниже — для запуска на сервере
          // 10.48.4.235 в папке проекта, а не в браузере.
          const NL2 = String.fromCharCode(10);
          alert(
            "Внимание: Selenium-бот не смог создать встречу на salutejazz.ru" +
              (botRes.error ? ` (${botRes.error})` : "") +
              "." +
              NL2 +
              NL2 +
              "Ссылка сгенерирована локально — такой комнаты на платформе ещё нет, вход может потребовать создания встречи организатором." +
              NL2 +
              NL2 +
              "Администратору сервера: проверить контейнер vks-bot командой (в папке проекта на сервере):" +
              NL2 +
              "docker compose --profile bot up -d vks-bot"
          );
        }
      } catch {
        payload.link = generateVksLink();
        alert(
          "Не удалось создать ссылку через бота — ссылка сгенерирована локально. " +
            "Администратору сервера: docker compose --profile bot up -d vks-bot"
        );
      } finally {
        setSavingNote(null);
      }
    } else if (!isVksLink(payload.link) && !/^https?:\/\//i.test(String(payload.link).trim())) {
      // не ссылка вовсе (обрывки текста из буфера обмена) — создаём новую
      try {
        const botRes = await createVksViaBot(payload.title || "Встреча", user.name);
        payload.link = botRes.link;
        if (!botRes.real && !botRes.skipped) {
          alert("Бот недоступен — ссылка сгенерирована локально (комнаты на платформе ещё нет).");
        }
      } catch {
        payload.link = generateVksLink();
      }
    } else if (isVksLink(payload.link)) {
      // ВАЖНО: ссылка на нашу платформу (в т.ч. созданная вручную на
      // salutejazz.ru, напр. /calls/09pa0i?psw=...) сохраняется КАК ЕСТЬ —
      // только чистка от мусора и дописывание https://. Код комнаты и пароль
      // НЕ меняем, иначе ссылка «не совпадает» с живой комнатой.
      payload.link = sanitizeVksLink(payload.link);
    } else {
      // посторонняя ссылка (zoom/webex/…) — сохраняем как есть; пустое поле
      // ниже никогда не бывает (ссылка генерируется при открытии формы)
      payload.link = payload.link.trim();
    }

    clearLastMeetingSaveError();
    const saved = editingMeeting ? await updateMeeting(editingMeeting.id, payload) : await createMeeting(payload);

    if (!saved) {
      // Показываем КОНКРЕТНУЮ причину с сервера (например, «Нельзя создать
      // встречу в прошедшем времени…»), а не универсальный список полей —
      // пользователь видел «время не совпадает», хотя поля были в порядке.
      alert(
        storeApi.lastMeetingSaveError
          ? `Не удалось сохранить конференцию: ${storeApi.lastMeetingSaveError}`
          : "Не удалось сохранить конференцию. Проверьте поля: время начала должно быть раньше времени окончания, ссылка — корректный URL, напоминание — от 5 до 1440 минут."
      );
      return;
    }

    // Сервер мог выполнить автофикс (например, сдвинуть окончание на +60 мин,
    // если конец совпал с началом) — честно показываем это пользователю,
    // иначе сохранённая встреча «расходится» с формой без объяснений.
    const warnings: string[] = Array.isArray((saved as any)?.warnings) ? (saved as any).warnings : [];
    if (warnings.length) {
      alert("Встреча сохранена с изменениями: " + warnings.join("; "));
    }

    loadData();
    setShowForm(false);
    setEditingMeeting(null);
    setFormData(emptyMeeting);
    setConflicts([]);
    setConflictChecked(false);
    setForceSave(false);
    onCreated?.();
  };

  const handleEdit = (meeting: Meeting) => {
    setEditingMeeting(meeting);
    // Нормализуем время/напоминание перед открытием формы: сервер может
    // вернуть '14:30:00' — input[type=time] такое значение не показывает,
    // а reminderMinutes из устаревшего кэша мог быть пустым.
    setFormData({
      ...meeting,
      startTime: normHm(meeting.startTime),
      endTime: normHm(meeting.endTime),
      reminderMinutes: normalizeReminderMinutes(meeting.reminderMinutes),
    });
    setShowForm(true);
    setConflicts([]);
    setConflictChecked(false);
    setForceSave(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Удалить конференцию?")) {
      await deleteMeeting(id);
      loadData();
    }
  };

  // ID из API приходят числами, а user.id — строка; сравниваем через Number,
  // иначе фильтры «Организованные/Участие» и кнопки редактирования не срабатывают
  const isOrganizer = (m: Meeting) => Number(m.organizerId) === Number(user.id);
  const isParticipant = (m: Meeting) => (m.participants ?? []).some((p) => Number(p) === Number(user.id));

  const toggleParticipant = (userId: string) => {
    const participants = formData.participants.includes(userId)
      ? formData.participants.filter((id) => id !== userId)
      : [...formData.participants, userId];
    setFormData({ ...formData, participants });
  };

  const getUserName = (id: string) => users.find((u) => Number(u.id) === Number(id))?.name || "Неизвестный";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-4xl text-blue-600 mb-4"></i>
          <p className="text-gray-600 dark:text-gray-400">Загрузка...</p>
        </div>
      </div>
    );
  }

  // Режим формы: только модалка создания ВКС (открывается с главной сразу после выбора времени/зала)
  if (formOnly) {
    // Закрытие панели: ОБЯЗАТЕЛЬНО уведомляем родителя (onClose / onCreated),
    // иначе Dashboard оставит createPrefill !== null и панель будет «восставать»
    // при каждом ре-рендере. Раньше здесь вызывался только onCreated?.(), а
    // onCancel в CreateMeetingForm вообще не закрывал родительскую панель —
    // из-за чего окно «быстро закрывалось»/не давало выбрать значения.
    const closePanel = () => {
      setShowForm(false);
      setConflicts([]);
      setConflictChecked(false);
      setForceSave(false);
      onClose?.();
    };
    return showForm ? (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl 3k:max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
              {editingMeeting ? "Редактировать конференцию" : "Новая конференция"}
            </h2>
            <button onClick={closePanel} className="text-gray-400 hover:text-gray-600" aria-label="Закрыть">
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>
          <CreateMeetingForm
            formData={formData}
            setFormData={setFormData}
            roomsCatalog={roomsCatalog}
            users={users}
            tags={tags}
            conflicts={conflicts}
            editing={!!editingMeeting}
            savingNote={savingNote}
            copyToClipboard={copyToClipboard}
            vksHint={vksHint}
            onCancel={closePanel}
            handleSubmit={handleSubmit}
          />
        </div>
      </div>
    ) : null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={() => {
            setShowForm(true);
            setEditingMeeting(null);
            setFormData(emptyMeeting);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <i className="fas fa-plus"></i>
          Создать конференцию
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Переключатель Список / Календарь */}
          <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
            <button
              onClick={() => setView("list")}
              className={`px-3 py-2 text-sm ${view === "list" ? "bg-blue-600 text-white" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"}`}
              title="Список конференций"
            >
              <i className="fas fa-list mr-1"></i>Список
            </button>
            <button
              onClick={() => setView("calendar")}
              className={`px-3 py-2 text-sm ${view === "calendar" ? "bg-blue-600 text-white" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"}`}
              title="Календарь (месяц/неделя)"
            >
              <i className="fas fa-calendar-alt mr-1"></i>Календарь
            </button>
          </div>
          {/* Переключатель компактного режима списка */}
          {view === "list" && (
            <button
              onClick={toggleCompact}
              className={`px-3 py-2 text-sm rounded-lg border ${
                compact
                  ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400"
                  : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
              title={compact ? "Обычный режим" : "Компактный режим"}
            >
              <i className="fas fa-compress-alt mr-1"></i>
              {compact ? "Компактно" : "Обычно"}
            </button>
          )}
          <label className="text-sm text-gray-600 dark:text-gray-400">
            <i className="fas fa-sort mr-1"></i>Сортировка:
          </label>
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Панель фильтров: статус, комната, тег, поиск, избранное */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по названию, описанию, участникам…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
          >
            <option value="all">Все статусы</option>
            <option value="upcoming">Предстоящие</option>
            <option value="past">Прошедшие</option>
            <option value="cancelled">Отменённые</option>
          </select>
          <select
            value={roomFilter}
            onChange={(e) => setRoomFilter(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
          >
            <option value="">Все комнаты</option>
            {rooms.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
          >
            <option value="">Все теги</option>
            {tags.map((t) => (
              <option key={t.id} value={String(t.id)}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => setOnlyFavorites((v) => !v)}
            title="Показать только избранные"
            className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
              onlyFavorites
                ? "bg-yellow-400 border-yellow-500 text-yellow-900"
                : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            }`}
          >
            <i className={`fas fa-star mr-1 ${onlyFavorites ? "" : "text-yellow-400"}`}></i>Избранные
          </button>
          {(statusFilter !== "all" || roomFilter || tagFilter || search || onlyFavorites) && (
            <button
              onClick={() => {
                setStatusFilter("all");
                setRoomFilter("");
                setTagFilter("");
                setSearch("");
                setOnlyFavorites(false);
              }}
              className="px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
            >
              <i className="fas fa-times-circle mr-1"></i>Сбросить
            </button>
          )}
        </div>

        {/* Массовые действия — появляются при выделении чекбоксами */}
        {selected.size > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Выбрано: {selected.size}</span>
            <button
              onClick={() => bulkAction("favorite")}
              className="px-3 py-1.5 text-sm bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
            >
              <i className="fas fa-star mr-1"></i>В избранное
            </button>
            <button
              onClick={() => bulkAction("cancel")}
              className="px-3 py-1.5 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600"
            >
              <i className="fas fa-ban mr-1"></i>Отменить
            </button>
            <button
              onClick={() => bulkAction("delete")}
              className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              <i className="fas fa-trash mr-1"></i>Удалить
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              Снять выделение
            </button>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl 3k:max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                  {editingMeeting ? "Редактировать конференцию" : "Новая конференция"}
                </h2>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setConflicts([]);
                    setConflictChecked(false);
                    setForceSave(false);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {conflicts.length > 0 && (
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 text-sm text-amber-800 dark:text-amber-200">
                    <p className="font-medium mb-1">
                      <i className="fas fa-exclamation-triangle mr-1"></i>Конфликты расписания ({conflicts.length}):
                    </p>
                    <ul className="list-disc list-inside space-y-0.5">
                      {conflicts.map((c: ScheduleConflict) => (
                        <li key={String(c.meeting_id)}>
                          «{c.title}» {c.start_time}–{c.end_time}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Название *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                      placeholder="Название конференции"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Описание</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                      rows={2}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Дата *</label>
                    <input
                      type="date"
                      required
                      min={editingMeeting ? undefined : serverTodayKey()}
                      value={formData.date}
                      onChange={(e) => {
                        const date = e.target.value;
                        setFormData((f) => {
                          const next = { ...f, date };
                          // «всё уехало»: при смене даты на сегодня автоподгоняем
                          // прошедшее время начала/окончания под серверные часы.
                          if (!editingMeeting) {
                            const clamped = clampFormTimes(date, next.startTime, next.endTime);
                            next.startTime = clamped.startTime;
                            next.endTime = clamped.endTime;
                          }
                          return next;
                        });
                      }}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Комната</label>
                    <select
                      value={formData.room}
                      onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                    >
                      {/* Комната всегда должна открываться для выбора */}
                      <option value="">— Выберите комнату —</option>
                      {roomsCatalog.map((r) => (
                        <option key={r.name} value={r.name}>
                          {r.name}
                        </option>
                      ))}
                      {formData.room && !roomsCatalog.some((r) => r.name === formData.room) && (
                        <option value={formData.room}>{formData.room}</option>
                      )}
                    </select>
                    {roomsCatalog.length === 0 && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                        Справочник комнат загрузится автоматически; если список пуст — поле «Комната» можно оставить невыбранным.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Начало *</label>
                    <input
                      type="time"
                      required
                      min={editingMeeting ? undefined : minStartHm(formData.date)}
                      max={LATE_CREATE_LIMIT_HM}
                      value={formData.startTime}
                      onChange={(e) => {
                        const startTime = e.target.value;
                        setFormData((f) => {
                          const next = { ...f, startTime };
                          // конец всегда позже начала — иначе сервер отклоняет заявку
                          if (!next.endTime || next.endTime <= startTime) {
                            const [h, m] = startTime.split(":").map((x) => parseInt(x, 10) || 0);
                            const total = Math.min(h * 60 + m + 60, 23 * 60 + 59);
                            next.endTime = `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
                          }
                          return next;
                        });
                      }}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                    {!editingMeeting && formData.date === serverTodayKey() && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Сегодня можно выбрать время не раньше {minStartHm(formData.date)} (по часам сервера).
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Конец *</label>
                    <input
                      type="time"
                      required
                      min={formData.startTime}
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Ссылка ВКС
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      <input
                        type="text"
                        inputMode="url"
                        value={formData.link}
                        onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                        onPaste={(e) => {
                          const t = e.clipboardData.getData("text");
                          if (t) {
                            e.preventDefault();
                            setFormData({ ...formData, link: t.trim() });
                          }
                        }}
                        className="flex-1 min-w-[180px] px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                        placeholder="https://salutejazz.ru/calls/... или вставьте свою ссылку"
                      />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Ссылка ВКС создаётся автоматически при сохранении встречи (бот проходит
                      salutejazz.ru/calls/create). При желании можно вставить свою ссылку — она сохранится как есть.
                      Данные для приглашения участников показаны ниже.
                    </p>
                    {isVksLink(formData.link) && vksHint && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
                        <i className="fas fa-check mr-1"></i>
                        {vksHint}
                      </p>
                    )}
                    {isVksLink(formData.link) && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                        <i className="fas fa-check-circle mr-1" aria-hidden="true"></i>
                        Ссылка на корпоративную ВКС
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Приоритет</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value as Meeting["priority"] })}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                    >
                      <option value="low">Низкий</option>
                      <option value="medium">Средний</option>
                      <option value="high">Высокий</option>
                    </select>
                  </div>

                  {/* Приглашение участников — общий блок VksInviteBlock (модалка «Мои конференции») */}
                  <div className="md:col-span-2">
                    <VksInviteBlock link={formData.link} copyToClipboard={copyToClipboard} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Повтор</label>
                    <select
                      value={formData.recurring}
                      onChange={(e) => setFormData({ ...formData, recurring: e.target.value as Meeting["recurring"] })}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                    >
                      <option value="none">Без повтора</option>
                      <option value="daily">Ежедневно</option>
                      <option value="weekly">Еженедельно</option>
                      <option value="monthly">Ежемесячно</option>
                      <option value="custom">По правилу (RRULE)…</option>
                    </select>
                  </div>
                  {formData.recurring === "custom" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Правило RRULE
                      </label>
                      <input
                        type="text"
                        value={formData.rrule ?? ""}
                        placeholder="FREQ=MONTHLY;BYDAY=FR;BYSETPOS=-1"
                        onChange={(e) => setFormData({ ...formData, rrule: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500 font-mono text-xs"
                      />
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {[
                          ["FREQ=WEEKLY;INTERVAL=2;BYDAY=MO", "кажд. 2 нед. пн"],
                          ["FREQ=MONTHLY;BYDAY=FR;BYSETPOS=-1", "послед. пятница мес."],
                          ["FREQ=MONTHLY;BYDAY=MO;BYSETPOS=1", "перв. понедельник мес."],
                          ["FREQ=DAILY;INTERVAL=3", "каждые 3 дня"],
                        ].map(([val, label]) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setFormData({ ...formData, rrule: val })}
                            className={`px-2 py-0.5 rounded text-[11px] border ${formData.rrule === val ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"}`}
                            title={val}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      {formData.rrule && (
                        <p className="text-[11px] text-gray-400 mt-1">
                          <i className="fas fa-sync-alt mr-1"></i>
                          {describeRRule(formData.rrule)}
                        </p>
                      )}
                    </div>
                  )}
                  {formData.recurring !== "none" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Повторять до (опционально)
                      </label>
                      <input
                        type="date"
                        value={formData.repeatUntil ?? ""}
                        min={formData.date}
                        onChange={(e) => setFormData({ ...formData, repeatUntil: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  )}
                </div>

                {/* Participants */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Участники ({formData.participants.length} выбрано)
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    <i className="fas fa-info-circle mr-1"></i>
                    Выберите зарегистрированных пользователей из списка ниже
                  </p>

                  {users.length === 0 ? (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        <i className="fas fa-exclamation-triangle mr-2"></i>В системе нет зарегистрированных
                        пользователей.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 max-h-64 overflow-y-auto">
                      <div className="space-y-2">
                        {users
                          .filter((u) => u.isActive)
                          .map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => toggleParticipant(u.id)}
                              className={`w-full text-left px-3 py-2 rounded-lg border transition-colors flex items-center gap-3 ${
                                (formData.participants ?? []).some((id) => String(id) === String(u.id))
                                  ? "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700"
                                  : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600"
                              }`}
                            >
                              <div
                                className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                                  (formData.participants ?? []).some((id) => String(id) === String(u.id))
                                    ? "bg-blue-600 border-blue-600"
                                    : "bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-500"
                                }`}
                              >
                                {(formData.participants ?? []).some((id) => String(id) === String(u.id)) && (
                                  <i className="fas fa-check text-white text-xs"></i>
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-800 dark:text-gray-100 text-sm">{u.name}</span>
                                  <span
                                    className={`px-2 py-0.5 rounded text-xs ${
                                      u.role === "admin"
                                        ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                                        : u.role === "moderator"
                                          ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400"
                                          : "bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300"
                                    }`}
                                  >
                                    {u.role === "admin"
                                      ? "Админ"
                                      : u.role === "moderator"
                                        ? "Модератор"
                                        : "Пользователь"}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                  @{u.login}
                                  {u.department && <span className="ml-2">• {u.department}</span>}
                                </div>
                              </div>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setConflicts([]);
                      setConflictChecked(false);
                      setForceSave(false);
                    }}
                    className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  >
                    Отмена
                  </button>
                  <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    {savingNote ? (
                      <span className="flex items-center gap-2">
                        <i className="fas fa-spinner fa-spin"></i>
                        {savingNote}
                      </span>
                    ) : editingMeeting ? (
                      "Сохранить"
                    ) : (
                      "Создать"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Просмотр конференции — доступен всем, кто видит конференцию в списке */}
      {viewMeeting &&
        (() => {
          const vm = viewMeeting;
          return (
            <div
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setViewMeeting(null)}
            >
              <div
                className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-xl 3k:max-w-3xl max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{vm.title}</h2>
                    <button onClick={() => setViewMeeting(null)} className="text-gray-400 hover:text-gray-600">
                      <i className="fas fa-times text-xl"></i>
                    </button>
                  </div>
                  <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                    <p>
                      <i className="fas fa-calendar mr-2 text-blue-500"></i>
                      {new Date(vm.date).toLocaleDateString("ru-RU")}
                      <span className="mx-2">•</span>
                      <i className="fas fa-clock mr-2 text-blue-500"></i>
                      {vm.startTime} - {vm.endTime}
                    </p>
                    {vm.room && (
                      <p>
                        <i className="fas fa-map-marker-alt mr-2 text-blue-500"></i>
                        {vm.room}
                      </p>
                    )}
                    <p>
                      <i className="fas fa-user mr-2 text-blue-500"></i>
                      Организатор: {getUserName(vm.organizerId)}
                    </p>
                    <p>
                      <i className="fas fa-users mr-2 text-blue-500"></i>
                      Участники ({(vm.participants ?? []).length}):{" "}
                      {(vm.participants ?? []).map((p) => getUserName(p)).join(", ") || "нет"}
                    </p>
                    {vm.recurring !== "none" && (
                      <p>
                        <i className="fas fa-sync-alt mr-2 text-blue-500"></i>
                        {vm.recurring === "daily"
                          ? "Ежедневно"
                          : vm.recurring === "weekly"
                            ? "Еженедельно"
                            : "Ежемесячно"}
                        {vm.repeatUntil ? ` до ${new Date(vm.repeatUntil).toLocaleDateString("ru-RU")}` : ""}
                      </p>
                    )}
                    {vm.description && (
                      <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg whitespace-pre-line">
                        {vm.description}
                      </div>
                    )}
                  </div>

                  {/* Приглашение участников — организатор может добавлять/удалять прямо из модалки */}
                  {isOrganizer(vm) && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                        <i className="fas fa-user-plus mr-1 text-blue-500"></i>Участники
                      </h4>
                      <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700">
                        {users
                          .filter((u) => Number(u.id) !== Number(vm.organizerId))
                          .map((u) => {
                            const isIn = (vm.participants ?? []).map(String).includes(String(u.id));
                            return (
                              <div key={u.id} className="flex items-center justify-between px-3 py-1.5 text-sm">
                                <span className="text-gray-700 dark:text-gray-200">
                                  {u.name}
                                  <span className="text-gray-400 ml-1">@{u.login}</span>
                                </span>
                                <button
                                  onClick={() => manageParticipantFromModal(u, !isIn)}
                                  className={`px-2 py-0.5 rounded text-xs ${
                                    isIn
                                      ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100"
                                      : "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100"
                                  }`}
                                >
                                  {isIn ? "Удалить" : "Пригласить"}
                                </button>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* RSVP — подтверждение участия */}
                  <MeetingRsvp meeting={vm} user={user} />

                  {/* Протокол встречи и задачи (action items) */}
                  <MeetingMinutes
                    meetingId={vm.id}
                    user={user}
                    users={users}
                    canWrite={
                      isOrganizer(vm) ||
                      user.role === "admin" ||
                      user.role === "moderator" ||
                      (vm.participants ?? []).some((p) => Number(p) === Number(user.id))
                    }
                  />

                  {/* История изменений — audit log с бэкенда */}
                  <div className="mt-4">
                    <MeetingHistoryView meetingId={vm.id} />
                  </div>
                  <div className="flex flex-wrap justify-end gap-3 pt-4 mt-4 border-t dark:border-gray-700">
                    <button
                      onClick={() => exportMeetingToIcs(vm)}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                      title="Добавить в Outlook / Google Calendar"
                    >
                      <i className="fas fa-file-download mr-1"></i>.ics
                    </button>
                    {isOrganizer(vm) && vm.status !== "cancelled" && (
                      <>
                        <button
                          onClick={() => handleRescheduleMeeting(vm)}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                          title="Изменить дату и время конференции"
                        >
                          <i className="fas fa-clock mr-1"></i>Перенести
                        </button>
                        <button
                          onClick={() => handleCancelMeeting(vm)}
                          className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                          title="Отменить встречу (участники получат уведомление)"
                        >
                          <i className="fas fa-ban mr-1"></i>Отменить встречу
                        </button>
                      </>
                    )}
                    {isOrganizer(vm) && (
                      <button
                        onClick={() => {
                          setViewMeeting(null);
                          handleEdit(vm);
                        }}
                        className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                      >
                        <i className="fas fa-edit mr-1"></i>Редактировать
                      </button>
                    )}
                    {vm.link && (
                      <button
                        type="button"
                        onClick={async () => {
                          // «Скопировать приглашение» — по шагам ручного создания:
                          // ссылку с salutejazz.ru вставляют в это поле, а здесь её
                          // можно скопировать целиком и разослать участникам.
                          const joinUrl = buildJoinUrl(vm.link, vm.meetingPassword, vm);
                          const psw = extractPswFromAny(joinUrl);
                          const text =
                            `Приглашаю на встречу: ${vm.title}\n` +
                            `Дата: ${vm.date} ${vm.startTime || ""}${vm.endTime ? "–" + vm.endTime : ""}\n` +
                            `Ссылка для входа: ${joinUrl}` +
                            (psw ? `\nПароль конференции: ${psw}` : "");
                          try {
                            await navigator.clipboard.writeText(text);
                          } catch {
                            // HTTP/старые браузеры: фолбэк через временное textarea
                            const ta = document.createElement("textarea");
                            ta.value = text;
                            document.body.appendChild(ta);
                            ta.select();
                            try {
                              document.execCommand("copy");
                            } catch {
                              /* noop */
                            }
                            document.body.removeChild(ta);
                          }
                        }}
                        className="px-4 py-2 border border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors"
                        title="Скопировать ссылку и пароль для отправки участникам"
                      >
                        <i className="fas fa-copy mr-1"></i>Скопировать приглашение
                      </button>
                    )}
                    {vm.link && (
                      <a
                        href={buildJoinUrl(vm.link, vm.meetingPassword ?? extractPswFromAny(vm.link))}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <i className="fas fa-video mr-1"></i>Войти в конференцию
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Meetings List / Calendar */}
      {view === "calendar" ? (
        (() => {
          const MONTH_NAMES = [
            "Январь",
            "Февраль",
            "Март",
            "Апрель",
            "Май",
            "Июнь",
            "Июль",
            "Август",
            "Сентябрь",
            "Октябрь",
            "Ноябрь",
            "Декабрь",
          ];
          const isoOf = (d: Date) =>
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          const byDate = new Map<string, Meeting[]>();
          sortedMeetings.forEach((m) => {
            const arr = byDate.get(m.date) ?? [];
            arr.push(m);
            byDate.set(m.date, arr);
          });
          const todayIso = isoOf(new Date());
          const cells: { d: Date; inMonth: boolean }[] = [];
          if (calView === "month") {
            const first = new Date(calMonth.y, calMonth.m, 1);
            let startDow = first.getDay(); // 0 — воскресенье
            if (startDow === 0) startDow = 7;
            for (let i = startDow - 1; i >= 0; i--)
              cells.push({ d: new Date(first.getFullYear(), first.getMonth(), 1 - i), inMonth: false });
            const last = new Date(calMonth.y, calMonth.m + 1, 0);
            for (let day = 1; day <= last.getDate(); day++)
              cells.push({ d: new Date(calMonth.y, calMonth.m, day), inMonth: true });
            while (cells.length % 7 !== 0)
              cells.push({
                d: new Date(
                  calMonth.y,
                  calMonth.m,
                  last.getDate() +
                    (cells.length % 7 === 0 ? 7 : cells.length - Math.floor(cells.length / 7) * 7 - last.getDate() + 1)
                ),
                inMonth: false,
              });
          } else {
            const anchor = new Date(calMonth.y, calMonth.m, calMonth.d || new Date().getDate());
            let dow = anchor.getDay();
            if (dow === 0) dow = 7;
            const monday = new Date(anchor);
            monday.setDate(anchor.getDate() - (dow - 1));
            for (let i = 0; i < 7; i++) {
              const d = new Date(monday);
              d.setDate(monday.getDate() + i);
              cells.push({ d, inMonth: true });
            }
          }
          const shiftMonth = (delta: number) => {
            const nd = new Date(calMonth.y, calMonth.m + delta, 1);
            setCalMonth({ y: nd.getFullYear(), m: nd.getMonth(), d: 1 });
          };
          const shiftWeek = (delta: number) => {
            const base = new Date(calMonth.y, calMonth.m, calMonth.d || new Date().getDate());
            base.setDate(base.getDate() + delta * 7);
            setCalMonth({ y: base.getFullYear(), m: base.getMonth(), d: base.getDate() });
          };
          return (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => (calView === "month" ? shiftMonth(-1) : shiftWeek(-1))}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
                  >
                    <i className="fas fa-chevron-left"></i>
                  </button>
                  <h3 className="font-bold text-gray-800 dark:text-gray-100 min-w-[180px] text-center">
                    {calView === "month"
                      ? `${MONTH_NAMES[calMonth.m]} ${calMonth.y}`
                      : `Неделя ${new Date(calMonth.y, calMonth.m, calMonth.d || 1).toLocaleDateString("ru-RU")} — ${(() => {
                          const e = new Date(calMonth.y, calMonth.m, calMonth.d || 1);
                          e.setDate(e.getDate() + 6);
                          return e.toLocaleDateString("ru-RU");
                        })()}`}
                  </h3>
                  <button
                    onClick={() => (calView === "month" ? shiftMonth(1) : shiftWeek(1))}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
                  >
                    <i className="fas fa-chevron-right"></i>
                  </button>
                  <button
                    onClick={() => {
                      const n = new Date();
                      setCalMonth({ y: n.getFullYear(), m: n.getMonth(), d: n.getDate() });
                    }}
                    className="px-3 py-1.5 text-sm rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100"
                  >
                    Сегодня
                  </button>
                </div>
                <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
                  <button
                    onClick={() => setCalView("month")}
                    className={`px-3 py-1.5 text-sm ${calView === "month" ? "bg-blue-600 text-white" : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"}`}
                  >
                    Месяц
                  </button>
                  <button
                    onClick={() => setCalView("week")}
                    className={`px-3 py-1.5 text-sm ${calView === "week" ? "bg-blue-600 text-white" : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"}`}
                  >
                    Неделя
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((wd) => (
                  <div key={wd} className="py-1">
                    {wd}
                  </div>
                ))}
              </div>
              <div className={`grid grid-cols-7 gap-1 ${calView === "week" ? "" : "auto-rows-fr"}`}>
                {cells.map(({ d, inMonth }, idx) => {
                  const iso = isoOf(d);
                  const dayMeetings = (byDate.get(iso) ?? []).slice(0, 4);
                  const isToday = iso === todayIso;
                  return (
                    <div
                      key={idx}
                      className={`border rounded-lg p-1 min-h-[92px] text-left ${inMonth ? "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700" : "bg-gray-50 dark:bg-gray-900/40 border-gray-100 dark:border-gray-700/50"} ${isToday ? "ring-2 ring-blue-500" : ""}`}
                    >
                      <div
                        className={`text-xs font-medium mb-1 ${isToday ? "text-blue-600" : inMonth ? "text-gray-600 dark:text-gray-300" : "text-gray-400 dark:text-gray-500"}`}
                      >
                        {d.getDate()}
                      </div>
                      {dayMeetings.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setViewMeeting(m)}
                          title={`${m.title} ${m.startTime}`}
                          className={`block w-full truncate text-left text-[11px] px-1 py-0.5 rounded mb-0.5 ${
                            m.status === "cancelled"
                              ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 line-through"
                              : m.priority === "high"
                                ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300"
                                : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                          }`}
                        >
                          {m.startTime} {m.title}
                        </button>
                      ))}
                      {(byDate.get(iso) ?? []).length > 4 && (
                        <div className="text-[10px] text-gray-400">+{(byDate.get(iso) ?? []).length - 4} ещё</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()
      ) : error && sortedMeetings.length === 0 ? (
        <div className="text-center py-12 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-xl">
          <i className="fas fa-plug text-4xl text-yellow-500 mb-3"></i>
          <p className="text-yellow-800 dark:text-yellow-200 font-medium">Не удалось загрузить данные с сервера</p>
          <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
            Проверьте, что бэкенд запущен (<code>php artisan serve</code> или контейнер <code>vks-backend</code>) и
            выполнены миграции.
          </p>
          <button
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm"
          >
            <i className="fas fa-redo mr-1"></i> Повторить
          </button>
        </div>
      ) : (
        <div className={showAllPage ? "space-y-3 max-h-[70vh] overflow-y-auto pr-1" : "space-y-3"}>
          {showAllPage && (
            <div className="sticky top-0 z-10 flex items-center justify-between rounded-xl bg-blue-600 text-white px-4 py-3 shadow-sm">
              <h3 className="font-bold flex items-center gap-2">
                <i className="fas fa-layer-group"></i>
                Все конференции
              </h3>
              <span className="text-sm text-blue-100">
                Показано {Math.min(visibleCount, sortedMeetings.length)} из {sortedMeetings.length}
              </span>
            </div>
          )}
          {(() => {
            // В «умном» режиме вставляем заголовки групп (Сегодня / Завтра / …)
            let lastGroup = "";
            return sortedMeetings.slice(0, showAllPage ? visibleCount : Math.min(visibleCount, TEASER_COUNT)).map((meeting) => {
              const group = showGroups ? getMeetingGroup(meeting) : null;
              const header =
                group && group.key !== lastGroup ? (
                  <div key={`grp-${group.key}`} className="pt-2 pb-1 first:pt-0">
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-2">
                      <i
                        className={`fas ${group.key === "today" ? "fa-calendar-day text-blue-500" : group.key === "tomorrow" ? "fa-calendar text-indigo-500" : group.key === "past" ? "fa-history text-gray-400" : "fa-calendar-week text-purple-500"}`}
                      ></i>
                      {group.label}
                    </h3>
                  </div>
                ) : null;
              if (group) lastGroup = group.key;
              return (
                <React.Fragment key={meeting.id}>
                  {header}
                  <div
                    className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow ${compact ? "p-2.5" : "p-4"}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-2 self-start mt-1">
                        {/* Чекбокс для массовых действий */}
                        <input
                          type="checkbox"
                          checked={selected.has(String(meeting.id))}
                          onChange={() => toggleSelect(String(meeting.id))}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          title="Выделить для массовых действий"
                        />
                      </div>
                      <div className="flex-1">
                        <div className={`flex items-center gap-2 ${compact ? "" : "mb-2"}`}>
                          <button
                            onClick={() => setViewMeeting(meeting)}
                            className="font-bold text-gray-800 dark:text-gray-100 hover:text-blue-600 text-left"
                            title="Открыть конференцию"
                          >
                            {meeting.title}
                          </button>
                          {/* Избранное — звёздочка на карточке */}
                          <button
                            onClick={() => toggleFavoriteMeeting(String(meeting.id))}
                            className="text-lg leading-none"
                            title={favorites.has(String(meeting.id)) ? "Убрать из избранного" : "Добавить в избранное"}
                          >
                            <i
                              className={`fas fa-star ${favorites.has(String(meeting.id)) ? "text-yellow-400" : "text-gray-300 dark:text-gray-600 hover:text-yellow-300"}`}
                            ></i>
                          </button>
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              meeting.priority === "high"
                                ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                                : meeting.priority === "medium"
                                  ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
                                  : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                            }`}
                          >
                            {meeting.priority === "high"
                              ? "Высокий"
                              : meeting.priority === "medium"
                                ? "Средний"
                                : "Низкий"}
                          </span>
                        </div>
                        <p className={`${compact ? "text-xs" : "text-sm"} text-gray-600 dark:text-gray-400`}>
                          <i className="fas fa-calendar mr-1"></i>
                          {new Date(meeting.date).toLocaleDateString("ru-RU")}
                          <span className="mx-2">•</span>
                          <i className="fas fa-clock mr-1"></i>
                          {meeting.startTime} - {meeting.endTime}
                          {meeting.room && (
                            <>
                              <span className="mx-2">•</span>
                              <i className="fas fa-map-marker-alt mr-1"></i>
                              {meeting.room}
                            </>
                          )}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                          <i className="fas fa-user mr-1"></i>
                          Организатор: {getUserName(meeting.organizerId)}
                          <span className="mx-2">•</span>
                          <i className="fas fa-users mr-1"></i>
                          {meeting.participants.length} участников
                          {meeting.recurring !== "none" && (
                            <>
                              <span className="mx-2">•</span>
                              <i className="fas fa-sync-alt text-blue-500 mr-1"></i>
                              <span className="text-blue-600 dark:text-blue-400">
                                {meeting.recurring === "daily"
                                  ? "Ежедневно"
                                  : meeting.recurring === "weekly"
                                    ? "Еженедельно"
                                    : "Ежемесячно"}
                                {meeting.recurring === "custom" && meeting.rrule
                                  ? ` (${describeRRule(meeting.rrule)})`
                                  : ""}
                                {meeting.repeatUntil
                                  ? ` до ${new Date(meeting.repeatUntil).toLocaleDateString("ru-RU")}`
                                  : ""}
                              </span>
                            </>
                          )}
                        </p>
                        {meeting.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2 whitespace-pre-line">
                            {meeting.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Экспорт встречи в календарь (.ics — Outlook / Google Calendar) */}
                        <button
                          onClick={() => exportMeetingToIcs(meeting)}
                          className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-gray-700 rounded"
                          title="Скачать .ics для Outlook / Google Calendar"
                        >
                          <i className="fas fa-calendar-plus"></i>
                        </button>
                        <button
                          onClick={() => setViewMeeting(meeting)}
                          className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                          <i className="fas fa-eye mr-1"></i>Просмотр
                        </button>
                        {meeting.link && (
                          <a
                            href={buildJoinUrl(
                              meeting.link,
                              meeting.meetingPassword ?? extractPswFromAny(meeting.link)
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700 transition-colors"
                          >
                            <i className="fas fa-video mr-1"></i>Войти
                          </a>
                        )}
                        {isOrganizer(meeting) && (
                          <>
                            <button
                              onClick={() => handleEdit(meeting)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-700 rounded"
                            >
                              <i className="fas fa-edit"></i>
                            </button>
                            <button
                              onClick={() => handleDelete(meeting.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-gray-700 rounded"
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            });
          })()}

          {/* Панель/страница «Все конференции»: на главной видно только первые
              TEASER_COUNT карточек, остальные — на отдельной странице-панели */}
          {!showAllPage && sortedMeetings.length > TEASER_COUNT && (
            <div className="pt-2">
              <button
                onClick={() => {
                  setShowAllPage(true);
                  setVisibleCount(PAGE_SIZE);
                }}
                className="w-full bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-xl py-3 text-sm font-medium transition-colors"
              >
                <i className="fas fa-layer-group mr-2"></i>
                Показать все конференции (ещё {sortedMeetings.length - TEASER_COUNT})
              </button>
            </div>
          )}

          {showAllPage && (
            <div className="space-y-3 pt-2">
              {visibleCount < sortedMeetings.length ? (
                <button
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  className="w-full bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-xl py-3 text-sm font-medium transition-colors"
                >
                  <i className="fas fa-chevron-down mr-2"></i>
                  Показать ещё ({sortedMeetings.length - visibleCount})
                </button>
              ) : null}
              <button
                onClick={() => setShowAllPage(false)}
                className="w-full bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-xl py-3 text-sm transition-colors"
              >
                <i className="fas fa-arrow-left mr-2"></i>Назад к последним конференциям
              </button>
            </div>
          )}

          {sortedMeetings.length === 0 && (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
              <i className="fas fa-video text-4xl mb-3"></i>
              <p>Нет конференций</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
