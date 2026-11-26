import { useCallback, useEffect, useState } from "react";
import { meetingPollsAPI } from "../api/client";

type PollOption = { label: string; votes: number };
type MeetingPoll = {
  id: number;
  question: string;
  options: PollOption[];
  total_votes: number;
  my_vote: number | null;
  is_closed: boolean;
  closed_at: string | null;
};

export default function MeetingPolls({ meetingId, canManage }: { meetingId: string | number; canManage: boolean }) {
  const [polls, setPolls] = useState<MeetingPoll[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);

  const load = useCallback(async () => {
    try {
      const response = await meetingPollsAPI.list(meetingId);
      setPolls(Array.isArray(response?.data) ? response.data : []);
      setError("");
    } catch (e: any) {
      setError(e?.message || "Не удалось загрузить голосования");
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    load();
  }, [load]);

  const createPoll = async () => {
    const cleanOptions = options.map((item) => item.trim()).filter(Boolean);
    if (!question.trim() || cleanOptions.length < 2) {
      setError("Укажите вопрос и не менее двух вариантов ответа");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await meetingPollsAPI.create(meetingId, { question: question.trim(), options: cleanOptions });
      setQuestion("");
      setOptions(["", ""]);
      await load();
    } catch (e: any) {
      setError(e?.message || "Не удалось создать голосование");
    } finally {
      setSaving(false);
    }
  };

  const vote = async (poll: MeetingPoll, optionIndex: number) => {
    setSaving(true);
    setError("");
    try {
      const response = await meetingPollsAPI.vote(meetingId, poll.id, optionIndex);
      const updated = response?.data as MeetingPoll | undefined;
      if (updated) setPolls((current) => current.map((item) => (item.id === poll.id ? updated : item)));
      else await load();
    } catch (e: any) {
      setError(e?.message || "Не удалось сохранить голос");
    } finally {
      setSaving(false);
    }
  };

  const closePoll = async (poll: MeetingPoll) => {
    if (!window.confirm("Закрыть голосование? После этого участники не смогут менять голос.")) return;
    setSaving(true);
    setError("");
    try {
      const response = await meetingPollsAPI.close(meetingId, poll.id);
      const updated = response?.data as MeetingPoll | undefined;
      if (updated) setPolls((current) => current.map((item) => (item.id === poll.id ? updated : item)));
      else await load();
    } catch (e: any) {
      setError(e?.message || "Не удалось закрыть голосование");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-semibold text-gray-800 dark:text-gray-100">
          <i className="fas fa-check-to-slot text-blue-500 mr-2"></i>Голосования
        </h4>
        <button
          type="button"
          onClick={load}
          disabled={loading || saving}
          className="text-xs text-blue-600 dark:text-blue-400 disabled:opacity-50"
        >
          Обновить
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Загрузка голосований...</p>
      ) : polls.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Пока нет голосований по этой встрече.</p>
      ) : (
        <div className="space-y-3">
          {polls.map((poll) => (
            <div key={poll.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-gray-800 dark:text-gray-100">{poll.question}</p>
                <span
                  className={`shrink-0 text-xs rounded-full px-2 py-1 ${poll.is_closed ? "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300" : "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300"}`}
                >
                  {poll.is_closed ? "Закрыто" : "Открыто"}
                </span>
              </div>
              {poll.options.map((option, index) => {
                const percent = poll.total_votes > 0 ? Math.round((option.votes / poll.total_votes) * 100) : 0;
                const selected = poll.my_vote === index;
                return (
                  <div key={index} className="space-y-1">
                    <button
                      type="button"
                      disabled={poll.is_closed || saving}
                      onClick={() => vote(poll, index)}
                      className={`w-full text-left rounded-md border px-3 py-2 text-sm transition-colors disabled:cursor-default ${selected ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-200 dark:border-gray-700 hover:border-blue-300"}`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span>
                          {option.label}
                          {selected ? " · Ваш выбор" : ""}
                        </span>
                        <span className="text-xs text-gray-500">
                          {option.votes} ({percent}%)
                        </span>
                      </span>
                    </button>
                    <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-xs text-gray-500">Всего голосов: {poll.total_votes}</span>
                {canManage && !poll.is_closed && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => closePoll(poll)}
                    className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
                  >
                    Закрыть голосование
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <div className="rounded-lg bg-gray-50 dark:bg-gray-900/40 p-3 space-y-2">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-100">Создать голосование</p>
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={255}
            placeholder="Вопрос для участников"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          />
          {options.map((option, index) => (
            <div key={index} className="flex gap-2">
              <input
                value={option}
                onChange={(event) =>
                  setOptions((current) => current.map((item, i) => (i === index ? event.target.value : item)))
                }
                maxLength={120}
                placeholder={`Вариант ${index + 1}`}
                className="min-w-0 flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              />
              {options.length > 2 && (
                <button
                  type="button"
                  onClick={() => setOptions((current) => current.filter((_, i) => i !== index))}
                  className="px-2 text-gray-500 hover:text-red-600"
                  aria-label="Удалить вариант"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          {options.length < 10 && (
            <button
              type="button"
              onClick={() => setOptions((current) => [...current, ""])}
              className="text-xs text-blue-600 dark:text-blue-400"
            >
              + Добавить вариант
            </button>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={createPoll}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Сохранение..." : "Создать"}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}
