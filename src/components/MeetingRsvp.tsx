import React, { useState, useEffect, useCallback } from 'react';
import { Meeting, User, RsvpData, RsvpResponse } from '../types';
import { getMeetingRsvp, respondRsvp } from '../store-api';

const OPTIONS: { value: RsvpResponse; label: string; icon: string; activeCls: string }[] = [
  { value: 'yes', label: 'Приду', icon: 'fa-check', activeCls: 'bg-green-600 text-white border-green-600' },
  { value: 'maybe', label: 'Под вопросом', icon: 'fa-question', activeCls: 'bg-amber-500 text-white border-amber-500' },
  { value: 'no', label: 'Не приду', icon: 'fa-times', activeCls: 'bg-red-600 text-white border-red-600' },
];

interface Props {
  meeting: Meeting;
  user: User;
}

/**
 * RSVP-блок модалки просмотра встречи:
 * — участник видит 3 кнопки ответа (приду / под вопросом / не приду);
 * — организатор видит сводку и список ответов участников.
 */
export default function MeetingRsvp({ meeting, user }: Props) {
  const [data, setData] = useState<RsvpData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isOrganizer = Number(meeting.organizerId) === Number(user.id);
  const isParticipant = (meeting.participants ?? []).some((p) => Number(p) === Number(user.id));
  const canRespond = !isOrganizer && isParticipant && meeting.status !== 'cancelled' && meeting.status !== 'completed';

  const load = useCallback(async () => {
    if (!isOrganizer && !isParticipant) { setData(null); setLoading(false); return; }
    setLoading(true);
    setData(await getMeetingRsvp(meeting.id));
    setLoading(false);
  }, [meeting.id, isOrganizer, isParticipant]);

  useEffect(() => { load(); }, [load]);

  const handleRespond = async (response: RsvpResponse) => {
    setSaving(true);
    const ok = await respondRsvp(meeting.id, response);
    setSaving(false);
    if (ok) setData(await getMeetingRsvp(meeting.id));
  };

  if (loading) {
    return <div className="text-xs text-gray-400 py-2"><i className="fas fa-spinner fa-spin mr-1"></i>Загрузка RSVP…</div>;
  }
  if (!isOrganizer && !isParticipant) return null;

  const myResponse = data?.myResponse ?? null;
  const summary = data?.summary;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          <i className="fas fa-hand-paper text-blue-500 mr-1.5"></i>Подтверждение участия (RSVP)
        </h4>
        {summary && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            <span className="text-green-600 font-medium">✓ {summary.yes}</span>{' · '}
            <span className="text-amber-600 font-medium">? {summary.maybe}</span>{' · '}
            <span className="text-red-600 font-medium">✗ {summary.no}</span>{' · '}
            <span>не ответили {summary.pending}</span>
          </span>
        )}
      </div>

      {canRespond && (
        <div className="flex flex-wrap gap-2">
          {OPTIONS.map((opt) => {
            const active = myResponse === opt.value;
            return (
              <button
                key={opt.value}
                disabled={saving}
                onClick={() => handleRespond(opt.value)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-50 ${
                  active ? opt.activeCls : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <i className={`fas ${opt.icon} mr-1`}></i>{opt.label}
              </button>
            );
          })}
          {myResponse && <span className="text-xs text-gray-400 self-center">ответ можно изменить</span>}
        </div>
      )}

      {isOrganizer && (
        <ul className="space-y-1 max-h-40 overflow-y-auto">
          {(data?.rsvps ?? []).length === 0 && (
            <li className="text-xs text-gray-400">Пока никто не ответил на приглашение.</li>
          )}
          {(data?.rsvps ?? []).map((r) => (
            <li key={r.userId} className="flex items-center justify-between text-xs">
              <span className="text-gray-700 dark:text-gray-200">{r.name || `Участник #${r.userId}`}</span>
              <span className={
                r.response === 'yes' ? 'text-green-600' : r.response === 'no' ? 'text-red-600' : 'text-amber-600'
              }>
                <i className={`fas ${r.response === 'yes' ? 'fa-check-circle' : r.response === 'no' ? 'fa-times-circle' : 'fa-question-circle'} mr-1`}></i>
                {r.response === 'yes' ? 'придёт' : r.response === 'no' ? 'не придёт' : 'под вопросом'}
              </span>
            </li>
          ))}
          {summary && summary.pending > 0 && (
            <li className="text-xs text-gray-400 italic">+ {summary.pending} без ответа</li>
          )}
        </ul>
      )}
    </div>
  );
}
