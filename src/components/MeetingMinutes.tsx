import React, { useState, useEffect } from "react";
import { MeetingMinute, MeetingTask, TaskComment, User } from "../types";
import {
  getMinutes,
  addMinute,
  updateMinuteApi,
  deleteMinuteApi,
  getMeetingTasks,
  addMeetingTask,
  updateMeetingTaskApi,
  deleteMeetingTaskApi,
  addTaskCommentApi,
  deleteTaskCommentApi,
} from "../store-api";

interface MeetingMinutesProps {
  meetingId: string;
  user: User;
  users: User[]; // для выбора ответственного за задачу
  canWrite: boolean; // организатор/участник/админ — совпадает с правами бэкенда
}

const STATUS_LABELS: Record<MeetingTask["status"], string> = {
  pending: "К выполнению",
  in_progress: "В работе",
  done: "Выполнено",
};

const STATUS_BADGE: Record<MeetingTask["status"], string> = {
  pending: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  done: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
};

/**
 * Протокол встречи (обсуждение / решения / ответственные)
 * и чеклист задач (action items) с ответственными и дедлайнами.
 */
export default function MeetingMinutes({ meetingId, user, users, canWrite }: MeetingMinutesProps) {
  const [tab, setTab] = useState<"minutes" | "tasks">("minutes");
  const [minutes, setMinutes] = useState<MeetingMinute[]>([]);
  const [tasks, setTasks] = useState<MeetingTask[]>([]);
  const [loading, setLoading] = useState(true);

  // Форма новой записи протокола
  const [discussion, setDiscussion] = useState("");
  const [decisions, setDecisions] = useState("");
  const [responsible, setResponsible] = useState("");
  const [editingMinute, setEditingMinute] = useState<MeetingMinute | null>(null);

  // Форма новой задачи (множественные ответственные — чекбоксы)
  const [taskTitle, setTaskTitle] = useState("");
  const [taskAssignees, setTaskAssignees] = useState<string[]>([]);
  const [taskDeadline, setTaskDeadline] = useState<string>("");
  const [assigneesOpen, setAssigneesOpen] = useState(false);

  // Комментарии к задачам
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]);

  const loadAll = async () => {
    setLoading(true);
    const [m, t] = await Promise.all([getMinutes(meetingId), getMeetingTasks(meetingId)]);
    setMinutes(m);
    setTasks(t);
    setLoading(false);
  };

  // ===== ПРОТОКОЛ =====
  const handleAddMinute = async () => {
    if (!discussion.trim() && !decisions.trim() && !responsible.trim()) return;
    const created = await addMinute(meetingId, {
      discussion: discussion.trim() || undefined,
      decisions: decisions.trim() || undefined,
      responsible: responsible.trim() || undefined,
    });
    if (created) {
      setMinutes([created, ...minutes]);
      setDiscussion("");
      setDecisions("");
      setResponsible("");
    } else {
      alert("Не удалось добавить запись протокола");
    }
  };

  const startEditMinute = (m: MeetingMinute) => {
    setEditingMinute({ ...m });
  };

  const handleSaveEditMinute = async () => {
    if (!editingMinute) return;
    const saved = await updateMinuteApi(meetingId, editingMinute.id, {
      discussion: editingMinute.discussion ?? "",
      decisions: editingMinute.decisions ?? "",
      responsible: editingMinute.responsible ?? "",
    });
    if (saved) {
      setMinutes(minutes.map((m) => (m.id === saved.id ? saved : m)));
      setEditingMinute(null);
    } else {
      alert("Не удалось обновить запись");
    }
  };

  const handleDeleteMinute = async (id: string) => {
    if (!confirm("Удалить запись протокола?")) return;
    const ok = await deleteMinuteApi(meetingId, id);
    if (ok) setMinutes(minutes.filter((m) => m.id !== id));
  };

  // ===== ЗАДАЧИ =====
  const handleAddTask = async () => {
    if (!taskTitle.trim()) return;
    const created = await addMeetingTask(meetingId, {
      title: taskTitle.trim(),
      assigneeIds: taskAssignees,
      deadline: taskDeadline || null,
    });
    if (created) {
      setTasks([...tasks, created]);
      setTaskTitle("");
      setTaskAssignees([]);
      setTaskDeadline("");
    } else {
      alert("Не удалось создать задачу");
    }
  };

  const cycleTaskStatus = async (t: MeetingTask) => {
    const next: MeetingTask["status"] =
      t.status === "pending" ? "in_progress" : t.status === "in_progress" ? "done" : "pending";
    const saved = await updateMeetingTaskApi(meetingId, t.id, { status: next });
    if (saved) setTasks(tasks.map((x) => (x.id === saved.id ? saved : x)));
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm("Удалить задачу?")) return;
    const ok = await deleteMeetingTaskApi(meetingId, id);
    if (ok) setTasks(tasks.filter((t) => t.id !== id));
  };

  const toggleAssignee = (uid: string) => {
    setTaskAssignees((prev) => (prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]));
  };

  const toggleComments = (taskId: string) => {
    setOpenComments((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const handleAddComment = async (taskId: string) => {
    const body = (commentDrafts[taskId] ?? "").trim();
    if (!body) return;
    const created = await addTaskCommentApi(meetingId, taskId, body);
    if (created) {
      setTasks(tasks.map((t) => (t.id === taskId ? { ...t, comments: [created, ...(t.comments ?? [])] } : t)));
      setCommentDrafts({ ...commentDrafts, [taskId]: "" });
    } else {
      alert("Не удалось добавить комментарий");
    }
  };

  const handleDeleteComment = async (taskId: string, commentId: string) => {
    if (!confirm("Удалить комментарий?")) return;
    const ok = await deleteTaskCommentApi(meetingId, taskId, commentId);
    if (ok)
      setTasks(
        tasks.map((t) =>
          t.id === taskId ? { ...t, comments: (t.comments ?? []).filter((c) => c.id !== commentId) } : t
        )
      );
  };

  const isOverdue = (t: MeetingTask) =>
    !!t.deadline && t.status !== "done" && t.deadline < new Date().toISOString().slice(0, 10);

  const doneCount = tasks.filter((t) => t.status === "done").length;

  const inputCls =
    "w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none";

  return (
    <div className="mt-4 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      {/* Табы */}
      <div className="flex bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setTab("minutes")}
          className={`px-4 py-2 text-sm font-medium ${tab === "minutes" ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}
        >
          <i className="fas fa-clipboard-list mr-1"></i>Протокол ({minutes.length})
        </button>
        <button
          onClick={() => setTab("tasks")}
          className={`px-4 py-2 text-sm font-medium ${tab === "tasks" ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}
        >
          <i className="fas fa-tasks mr-1"></i>Задачи ({doneCount}/{tasks.length})
        </button>
        {/* Экспорт протокола в PDF: window.print() + print-CSS (@media print в index.css).
            Печатается только контейнер .print-area (протокол + задачи), остальной UI скрыт. */}
        <button
          onClick={() => window.print()}
          className="ml-auto px-4 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 print:hidden"
          title="Печать / сохранить в PDF"
        >
          <i className="fas fa-print mr-1"></i>Печать/PDF
        </button>
      </div>

      <div className="p-4">
        {/* Область печати: @media print скрывает всё остальное (см. index.css) */}
        <div className="print-area">
          <div className="print-only mb-4">
            <h1 className="text-xl font-bold">Протокол встречи</h1>
            <p className="text-sm text-gray-600">
              {new Date().toLocaleDateString("ru-RU")} · сформирован в «ВКС Расписание»
            </p>
          </div>
          {loading ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
              <i className="fas fa-spinner fa-spin mr-1"></i>Загрузка...
            </p>
          ) : tab === "minutes" ? (
            <div className="space-y-4">
              {canWrite && (
                <div className="space-y-2 p-3 bg-gray-50 dark:bg-gray-700/40 rounded-lg">
                  <textarea
                    value={discussion}
                    onChange={(e) => setDiscussion(e.target.value)}
                    placeholder="Что обсуждали..."
                    rows={2}
                    className={inputCls}
                  />
                  <textarea
                    value={decisions}
                    onChange={(e) => setDecisions(e.target.value)}
                    placeholder="Какие решения приняли..."
                    rows={2}
                    className={inputCls}
                  />
                  <input
                    value={responsible}
                    onChange={(e) => setResponsible(e.target.value)}
                    placeholder="Ответственные (текстом)"
                    className={inputCls}
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={handleAddMinute}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <i className="fas fa-plus mr-1"></i>Добавить запись
                    </button>
                  </div>
                </div>
              )}

              {minutes.length === 0 && !canWrite && (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-2">Протокол пуст</p>
              )}
              {minutes.length === 0 && canWrite && (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-2">
                  Пока нет записей — добавьте первую выше
                </p>
              )}

              {minutes.map((m) => {
                const editable = canWrite && (String(m.userId) === String(user.id) || editingMinute?.id === m.id);
                return (
                  <div key={m.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                    {editingMinute?.id === m.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editingMinute.discussion ?? ""}
                          onChange={(e) => setEditingMinute({ ...editingMinute, discussion: e.target.value })}
                          rows={2}
                          className={inputCls}
                        />
                        <textarea
                          value={editingMinute.decisions ?? ""}
                          onChange={(e) => setEditingMinute({ ...editingMinute, decisions: e.target.value })}
                          rows={2}
                          className={inputCls}
                        />
                        <input
                          value={editingMinute.responsible ?? ""}
                          onChange={(e) => setEditingMinute({ ...editingMinute, responsible: e.target.value })}
                          className={inputCls}
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setEditingMinute(null)}
                            className="px-3 py-1 text-sm rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            Отмена
                          </button>
                          <button
                            onClick={handleSaveEditMinute}
                            className="px-3 py-1 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                          >
                            Сохранить
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1 min-w-0">
                            {m.discussion && (
                              <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-line">
                                <span className="font-medium text-gray-500 dark:text-gray-400">Обсудили:</span>{" "}
                                {m.discussion}
                              </p>
                            )}
                            {m.decisions && (
                              <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-line">
                                <span className="font-medium text-gray-500 dark:text-gray-400">Решили:</span>{" "}
                                {m.decisions}
                              </p>
                            )}
                            {m.responsible && (
                              <p className="text-sm text-gray-700 dark:text-gray-200">
                                <span className="font-medium text-gray-500 dark:text-gray-400">Ответственные:</span>{" "}
                                {m.responsible}
                              </p>
                            )}
                          </div>
                          {canWrite && (
                            <div className="flex gap-1 shrink-0">
                              <button
                                onClick={() => startEditMinute(m)}
                                title="Редактировать"
                                className="p-1 text-xs text-gray-400 hover:text-blue-600"
                              >
                                <i className="fas fa-edit"></i>
                              </button>
                              <button
                                onClick={() => handleDeleteMinute(m.id)}
                                title="Удалить"
                                className="p-1 text-xs text-gray-400 hover:text-red-600"
                              >
                                <i className="fas fa-trash"></i>
                              </button>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                          {m.authorName || "Участник"} · {new Date(m.createdAt).toLocaleString("ru-RU")}
                        </p>
                        {!editable && null}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* ===== ЗАДАЧИ ===== */
            <div className="space-y-3">
              {canWrite && (
                <div className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-gray-700/40 rounded-lg">
                  <input
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder="Новая задача (action item)..."
                    className={`${inputCls} flex-1 min-w-[180px]`}
                    onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
                  />
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setAssigneesOpen(!assigneesOpen)}
                      className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 whitespace-nowrap"
                    >
                      <i className="fas fa-users mr-1"></i>
                      {taskAssignees.length ? `Отв.: ${taskAssignees.length}` : "Ответственные"}
                      <i className={`fas fa-chevron-${assigneesOpen ? "up" : "down"} ml-1 text-xs`}></i>
                    </button>
                    {assigneesOpen && (
                      <div className="absolute z-20 mt-1 w-56 max-h-48 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-2">
                        {users.length === 0 && <p className="text-xs text-gray-400 p-1">Нет доступных пользователей</p>}
                        {users.map((u) => (
                          <label
                            key={u.id}
                            className="flex items-center gap-2 px-1.5 py-1 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-gray-700 dark:text-gray-200"
                          >
                            <input
                              type="checkbox"
                              checked={taskAssignees.includes(u.id)}
                              onChange={() => toggleAssignee(u.id)}
                            />
                            <span className="truncate">{u.name}</span>
                          </label>
                        ))}
                        {taskAssignees.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setTaskAssignees([])}
                            className="mt-1 w-full text-xs text-red-500 hover:underline"
                          >
                            Сбросить
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <input
                    type="date"
                    value={taskDeadline}
                    onChange={(e) => setTaskDeadline(e.target.value)}
                    className={`${inputCls} w-auto`}
                  />
                  <button
                    onClick={handleAddTask}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <i className="fas fa-plus mr-1"></i>Добавить
                  </button>
                </div>
              )}

              {tasks.length === 0 && (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-2">Задач пока нет</p>
              )}

              {tasks.map((t) => (
                <div
                  key={t.id}
                  className={`flex items-start gap-3 p-2.5 rounded-lg border ${isOverdue(t) ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"}`}
                >
                  {canWrite ? (
                    <button
                      onClick={() => cycleTaskStatus(t)}
                      title={`Статус: ${STATUS_LABELS[t.status]} (клик — сменить)`}
                      className={`shrink-0 w-6 h-6 rounded-md border flex items-center justify-center text-xs transition-colors ${
                        t.status === "done"
                          ? "bg-green-600 border-green-600 text-white"
                          : t.status === "in_progress"
                            ? "bg-blue-600 border-blue-600 text-white"
                            : "border-gray-300 dark:border-gray-600 text-transparent hover:border-blue-500"
                      }`}
                    >
                      <i
                        className={`fas ${t.status === "done" ? "fa-check" : t.status === "in_progress" ? "fa-play" : "fa-circle"}`}
                      ></i>
                    </button>
                  ) : (
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs ${STATUS_BADGE[t.status]}`}>
                      {STATUS_LABELS[t.status]}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm ${t.status === "done" ? "line-through text-gray-400 dark:text-gray-500" : "text-gray-800 dark:text-gray-100"}`}
                    >
                      {t.title}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                      {(t.assigneeNames?.length ? t.assigneeNames : t.assigneeName ? [t.assigneeName] : []).map(
                        (name, i) => (
                          <span key={i}>
                            <i className="fas fa-user mr-1"></i>
                            {name}
                            {i === 0 && (t.assigneeNames?.length ?? 0) > 1 ? " и др." : ""}
                          </span>
                        )
                      )}
                      {t.deadline && (
                        <span className={isOverdue(t) ? "text-red-500 font-medium" : ""}>
                          <i className="far fa-calendar mr-1"></i>
                          {new Date(t.deadline).toLocaleDateString("ru-RU")}
                          {isOverdue(t) && " · просрочено"}
                        </span>
                      )}
                      <span className={`px-1.5 py-0.5 rounded ${STATUS_BADGE[t.status]}`}>
                        {STATUS_LABELS[t.status]}
                      </span>
                      <button
                        onClick={() => toggleComments(t.id)}
                        className="px-1.5 py-0.5 rounded text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <i className="far fa-comment mr-1"></i>
                        {(t.comments ?? []).length}
                      </button>
                    </p>
                    {openComments[t.id] && (
                      <div className="mt-2 pl-2 border-l-2 border-gray-200 dark:border-gray-700 space-y-2">
                        {(t.comments ?? []).length === 0 && (
                          <p className="text-xs text-gray-400 dark:text-gray-500">Комментариев пока нет</p>
                        )}
                        {(t.comments ?? []).map((c: TaskComment) => (
                          <div key={c.id} className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs text-gray-700 dark:text-gray-200 whitespace-pre-line break-words">
                                {c.body}
                              </p>
                              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                                {c.userName || "Участник"} · {new Date(c.createdAt).toLocaleString("ru-RU")}
                              </p>
                            </div>
                            {canWrite && (
                              <button
                                onClick={() => handleDeleteComment(t.id, c.id)}
                                title="Удалить комментарий"
                                className="p-0.5 text-[11px] text-gray-400 hover:text-red-600 shrink-0"
                              >
                                <i className="fas fa-times"></i>
                              </button>
                            )}
                          </div>
                        ))}
                        {canWrite && (
                          <div className="flex gap-2">
                            <input
                              value={commentDrafts[t.id] ?? ""}
                              onChange={(e) => setCommentDrafts({ ...commentDrafts, [t.id]: e.target.value })}
                              onKeyDown={(e) => e.key === "Enter" && handleAddComment(t.id)}
                              placeholder="Комментарий к задаче..."
                              className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <button
                              onClick={() => handleAddComment(t.id)}
                              className="px-2 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                              <i className="fas fa-paper-plane"></i>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {canWrite && (
                    <button
                      onClick={() => handleDeleteTask(t.id)}
                      title="Удалить задачу"
                      className="p-1 text-xs text-gray-400 hover:text-red-600 shrink-0"
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
