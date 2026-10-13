import React, { useEffect, useMemo, useRef, useState } from "react";
import { Meeting, MeetingTask, User } from "../types";

// Глобальный поиск по встречам, задачам протоколов и пользователям.
// Вызывается сочетанием Ctrl+F / Cmd+F (учитывает русскую раскладку: клавиша «а»);
// данные берутся из уже загруженных списков (тянем сами через store-api лениво).

interface Props {
  user: User;
}

type ResultType = "meeting" | "task" | "user";

interface SearchResult {
  type: ResultType;
  id: string;
  title: string;
  subtitle: string;
  raw: any;
}

declare module "../types" {
  interface MeetingTask {
    /** служебное: название встречи-источника для результатов глобального поиска */
    _meetingTitle?: string;
  }
}

const TYPE_LABELS: Record<ResultType, string> = {
  meeting: "Конференции",
  task: "Задачи протоколов",
  user: "Сотрудники",
};

export default function GlobalSearch({ user }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [tasks, setTasks] = useState<MeetingTask[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Горячие клавиши: Ctrl/Cmd+F — открыть (F — латинская раскладка, а — русская,
  // физически одна клавиша), Esc — закрыть. preventDefault подавляет поиск браузера.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ["f", "а"].includes(e.key.toLowerCase())) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Данные подгружаем один раз при первом открытии (пока оверлей закрыт — не грузим)
  useEffect(() => {
    if (!open || meetings.length || loading) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const storeApi = await import("../store-api");
        const [ms, us] = await Promise.all([
          storeApi.getMeetings(),
          storeApi.getUsersForDisplay().catch(() => [] as User[]),
        ]);
        // Задачи action items собираем из протоколов ближайших встреч (не дороже N запросов)
        const taskList: MeetingTask[] = [];
        for (const m of ms.slice(0, 30)) {
          try {
            const tasksOfMeeting = await storeApi.getMeetingTasks(m.id);
            tasksOfMeeting.forEach((t) => taskList.push({ ...t, _meetingTitle: m.title } as MeetingTask));
          } catch {
            /* у кого нет доступа/задач — пропускаем */
          }
        }
        if (!cancelled) {
          setMeetings(ms);
          setUsers(us);
          setTasks(taskList);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else setQuery("");
  }, [open]);

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: SearchResult[] = [];

    for (const m of meetings) {
      const hay = `${m.title} ${m.description ?? ""}`.toLowerCase();
      const participantNames = (m.participants || [])
        .map((id) => users.find((u) => u.id === String(id))?.name ?? "")
        .join(" ")
        .toLowerCase();
      if (hay.includes(q) || participantNames.includes(q) || m.room?.toLowerCase().includes(q)) {
        out.push({
          type: "meeting",
          id: m.id,
          title: m.title,
          subtitle: `${m.date} ${m.startTime}–${m.endTime}${m.room ? ` · ${m.room}` : ""}`,
          raw: m,
        });
      }
    }

    for (const t of tasks) {
      if (`${t.title}`.toLowerCase().includes(q)) {
        out.push({
          type: "task",
          id: t.id,
          title: t.title,
          subtitle: `${(t as any)._meetingTitle ?? ""}${t.deadline ? ` · до ${t.deadline}` : ""} · ${
            t.status === "done" ? "выполнена" : t.status === "in_progress" ? "в работе" : "к выполнению"
          }`,
          raw: t,
        });
      }
    }

    for (const u of users) {
      if (
        u.id !== user.id &&
        (`${u.name}`.toLowerCase().includes(q) || `${u.department ?? ""} ${u.position ?? ""}`.toLowerCase().includes(q))
      ) {
        out.push({
          type: "user",
          id: u.id,
          title: u.name,
          subtitle: [u.position, u.department].filter(Boolean).join(", ") || "сотрудник",
          raw: u,
        });
      }
    }

    return out.slice(0, 30);
  }, [query, meetings, tasks, users, user.id]);

  const grouped = useMemo(() => {
    const g: Record<ResultType, SearchResult[]> = { meeting: [], task: [], user: [] };
    results.forEach((r) => g[r.type].push(r));
    return g;
  }, [results]);

  const flat = useMemo(() => {
    const order: SearchResult[] = [];
    (["meeting", "task", "user"] as ResultType[]).forEach((t) => order.push(...grouped[t]));
    return order;
  }, [grouped]);

  if (!open) {
    // Кнопка-подсказка в шапке
    return (
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 text-sm"
        title="Глобальный поиск"
      >
        <i className="fas fa-search" aria-hidden="true"></i>
        Поиск
        <kbd className="text-[10px] border border-gray-300 dark:border-gray-600 rounded px-1">Ctrl F</kbd>
      </button>
    );
  }

  const navigate = (r: SearchResult) => {
    setOpen(false);
    if (r.type === "meeting") {
      window.dispatchEvent(new CustomEvent("vks-open-meeting", { detail: r.id }));
    } else if (r.type === "task") {
      window.dispatchEvent(
        new CustomEvent("vks-open-meeting", { detail: (r.raw as any).meetingId ?? (r.raw as any).meeting_id })
      );
    } else {
      window.dispatchEvent(new CustomEvent("vks-open-user", { detail: r.id }));
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && flat[active]) {
      e.preventDefault();
      navigate(flat[active]);
    }
  };

  let index = -1;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-24 px-4"
      onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
    >
      <div className="w-full max-w-xl bg-white dark:bg-gray-900 rounded-xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="Поиск по конференциям, задачам, сотрудникам…"
          className="w-full px-4 py-3 text-base bg-transparent outline-none border-b border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
          aria-label="Глобальный поиск"
        />
        <div className="max-h-96 overflow-y-auto">
          {loading && (
            <div className="p-4 text-sm text-gray-500">
              <i className="fas fa-circle-notch fa-spin mr-2"></i>Загрузка данных…
            </div>
          )}
          {!loading && query.trim() && flat.length === 0 && (
            <div className="p-4 text-sm text-gray-500">Ничего не найдено по запросу «{query}»</div>
          )}
          {(["meeting", "task", "user"] as ResultType[]).map((type) =>
            grouped[type].length === 0 ? null : (
              <div key={type}>
                <div className="px-4 pt-3 pb-1 text-xs uppercase tracking-wide text-gray-400">{TYPE_LABELS[type]}</div>
                {grouped[type].map((r) => {
                  index++;
                  const isActive = index === active;
                  return (
                    <button
                      key={`${type}-${r.id}`}
                      onClick={() => navigate(r)}
                      onMouseEnter={() => setActive(index)}
                      className={`w-full text-left px-4 py-2 flex items-center gap-3 ${
                        isActive ? "bg-blue-50 dark:bg-blue-900/30" : ""
                      }`}
                    >
                      <i
                        className={
                          type === "meeting"
                            ? "fas fa-video text-blue-500"
                            : type === "task"
                              ? "fas fa-tasks text-amber-500"
                              : "fas fa-user text-emerald-500"
                        }
                        aria-hidden="true"
                      ></i>
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-sm text-gray-900 dark:text-gray-100">{r.title}</span>
                        <span className="block truncate text-xs text-gray-500">{r.subtitle}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )
          )}
        </div>
        <div className="px-4 py-2 text-[11px] text-gray-400 border-t border-gray-200 dark:border-gray-700 flex gap-4">
          <span>↑↓ — навигация</span>
          <span>Enter — открыть</span>
          <span>Esc — закрыть</span>
        </div>
      </div>
    </div>
  );
}
