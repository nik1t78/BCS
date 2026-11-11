import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api/client";
import { User } from "../types";

type Approval = {
  id: number; title: string; purpose?: string; preferred_start?: string;
  duration_minutes: number; status: "pending" | "approved" | "rejected";
  review_comment?: string; requester?: { name: string }; created_at: string;
};

type Room = { id: number; name: string; capacity?: number; location?: string; equipment?: string[] | Record<string, unknown>; is_active?: boolean };

const statusLabel: Record<string, string> = { pending: "На согласовании", approved: "Одобрена", rejected: "Отклонена" };

export default function Workbench({ user, onNavigate }: { user: User; onNavigate: (page: string) => void }) {
  const [tab, setTab] = useState<"overview" | "requests" | "rooms" | "assistant" | "audit">("overview");
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [purpose, setPurpose] = useState("");
  const [when, setWhen] = useState("");
  const [duration, setDuration] = useState("60");
  const [comment, setComment] = useState("");
  const [activeReview, setActiveReview] = useState<number | null>(null);
  const [assistantText, setAssistantText] = useState("");
  const [assistantAnswer, setAssistantAnswer] = useState("");
  const [auditRows, setAuditRows] = useState<any[]>([]);
  const isManager = user.role === "admin" || user.role === "moderator";
  const canViewAudit = user.role === "admin";

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [a, r] = await Promise.all([
        apiRequest("/approvals"),
        apiRequest("/rooms"),
      ]);
      setApprovals(a.data ?? a ?? []);
      setRooms(r.data ?? r ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось загрузить данные"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (tab !== "audit" || !canViewAudit) return;
    apiRequest("/admin/audit-logs").then((r) => setAuditRows(r.data ?? r ?? [])).catch(() => setAuditRows([]));
  }, [tab, canViewAudit]);

  const stats = useMemo(() => ({
    pending: approvals.filter(x => x.status === "pending").length,
    approved: approvals.filter(x => x.status === "approved").length,
    rooms: rooms.filter(x => x.is_active !== false).length,
  }), [approvals, rooms]);

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    try {
      await apiRequest("/approvals", { method: "POST", body: JSON.stringify({
        title, purpose, preferred_start: when || null, duration_minutes: Number(duration),
      }) });
      setTitle(""); setPurpose(""); setWhen(""); setDuration("60"); setTab("requests"); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось отправить заявку"); }
  };

  const review = async (id: number, status: "approved" | "rejected") => {
    try {
      await apiRequest(`/approvals/${id}/review`, { method: "PATCH", body: JSON.stringify({ status, review_comment: comment }) });
      setActiveReview(null); setComment(""); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось сохранить решение"); }
  };

  const askAssistant = () => {
    const q = assistantText.trim();
    if (!q) return;
    const hints = [
      "Сформулируйте тему и цель встречи — это поможет подобрать подходящий зал и продолжительность.",
      "Перед созданием проверьте свободный интервал и отсутствие пересечений в расписании.",
      "Если участвуют несколько подразделений, добавьте ответственных и отправьте заявку на согласование.",
    ];
    const lower = q.toLowerCase();
    const answer = lower.includes("зал") || lower.includes("оборуд")
      ? `В системе доступно активных залов: ${stats.rooms}. Сравните вместимость и оснащение в разделе «Залы и оборудование». ${hints[0]}`
      : lower.includes("перенос") || lower.includes("время") || lower.includes("свобод")
        ? `Для переноса сначала проверьте свободные интервалы в расписании. Шаг времени проекта — 30 минут. ${hints[1]}`
        : lower.includes("соглас")
          ? `Новая заявка появится в разделе «Заявки». ${isManager ? "Вы можете рассмотреть ожидающие заявки." : "Ответственный администратор сможет одобрить или отклонить её."}`
          : `Я помогу подготовить заявку и выбрать следующий шаг. ${hints.join(" ")}`;
    setAssistantAnswer(answer);
  };

  const tabs = [
    ["overview", "Обзор"], ["requests", "Заявки"], ["rooms", "Залы и оборудование"],
    ["assistant", "Помощник"], ...(canViewAudit ? [["audit", "Журнал действий"]] : []),
  ] as [string, string][];

  return <section className="max-w-7xl mx-auto space-y-6">
    <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-900 p-6 sm:p-8 text-white shadow-xl">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
        <div className="max-w-2xl">
          <div className="text-blue-200 text-xs font-semibold tracking-[.2em] uppercase">BCS · рабочее пространство</div>
          <h1 className="text-3xl sm:text-4xl font-bold mt-2">Центр управления ВКС</h1>
          <p className="text-blue-100/80 mt-3">Заявки, залы, согласования и быстрые инструменты — в одном месте.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => onNavigate("meetings")} className="rounded-xl bg-white text-slate-900 px-4 py-2.5 text-sm font-semibold hover:bg-blue-50">＋ Создать ВКС</button>
          <button onClick={() => onNavigate("schedule")} className="rounded-xl border border-white/30 px-4 py-2.5 text-sm font-semibold hover:bg-white/10">Открыть расписание</button>
        </div>
      </div>
    </div>

    <div className="flex gap-2 overflow-x-auto pb-1">
      {tabs.map(([id, label]) => <button key={id} onClick={() => setTab(id as any)}
        className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition ${tab === id ? "bg-blue-600 text-white shadow" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-blue-300"}`}>{label}</button>)}
    </div>

    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}
    {loading && <div className="text-sm text-gray-500 py-3">Загружаем рабочие данные…</div>}

    {tab === "overview" && <>
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          ["Ожидают решения", stats.pending, "bg-amber-50 text-amber-700"],
          ["Одобрено", stats.approved, "bg-emerald-50 text-emerald-700"],
          ["Активные залы", stats.rooms, "bg-blue-50 text-blue-700"],
        ].map(([label, value, color]) => <div key={String(label)} className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-5 shadow-sm">
          <div className="text-sm text-gray-500 dark:text-gray-400">{label}</div><div className="text-3xl font-bold mt-2 text-gray-900 dark:text-white">{value}</div>
        </div>)}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <button onClick={() => setTab("requests")} className="text-left rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5 hover:border-blue-300 hover:shadow-md transition">
          <div className="text-2xl">📨</div><h3 className="font-bold text-gray-900 dark:text-white mt-3">Заявки на ВКС</h3><p className="text-sm text-gray-500 mt-1">Создание и согласование проведения конференций.</p>
        </button>
        <button onClick={() => setTab("assistant")} className="text-left rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5 hover:border-blue-300 hover:shadow-md transition">
          <div className="text-2xl">✨</div><h3 className="font-bold text-gray-900 dark:text-white mt-3">Помощник организатора</h3><p className="text-sm text-gray-500 mt-1">Подсказки по подготовке, залам и расписанию.</p>
        </button>
      </div>
      <form onSubmit={submitRequest} className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5 space-y-3">
        <div><h3 className="font-bold text-gray-900 dark:text-white">Быстрая заявка на конференцию</h3><p className="text-sm text-gray-500">Заявка будет сохранена в системе и отправлена на рассмотрение.</p></div>
        <input required value={title} onChange={e=>setTitle(e.target.value)} placeholder="Тема конференции" className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2.5 text-sm dark:text-white"/>
        <div className="grid sm:grid-cols-2 gap-3">
          <input type="datetime-local" value={when} onChange={e=>setWhen(e.target.value)} className="rounded-xl border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2.5 text-sm dark:text-white"/>
          <select value={duration} onChange={e=>setDuration(e.target.value)} className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm dark:text-white"><option value="30">30 минут</option><option value="60">1 час</option><option value="90">1,5 часа</option><option value="120">2 часа</option><option value="180">3 часа</option></select>
        </div>
        <textarea value={purpose} onChange={e=>setPurpose(e.target.value)} placeholder="Цель и дополнительные сведения" rows={2} className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2.5 text-sm dark:text-white"/>
        <button className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 text-sm font-semibold">Отправить на согласование</button>
      </form>
    </>}

    {tab === "requests" && <div className="space-y-3">
      {approvals.length === 0 && <div className="rounded-2xl bg-white dark:bg-gray-800 p-8 text-center text-gray-500">Заявок пока нет. Создайте первую заявку на проведение ВКС.</div>}
      {approvals.map(item => <article key={item.id} className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-bold text-gray-900 dark:text-white">{item.title}</h3><p className="text-xs text-gray-500 mt-1">{item.requester?.name ?? "Вы"} · {new Date(item.created_at).toLocaleString("ru-RU")}</p></div>
          <span className={`h-fit rounded-full px-3 py-1 text-xs font-semibold ${item.status==="pending"?"bg-amber-100 text-amber-800":item.status==="approved"?"bg-emerald-100 text-emerald-800":"bg-rose-100 text-rose-800"}`}>{statusLabel[item.status]}</span></div>
        {item.purpose && <p className="text-sm text-gray-600 dark:text-gray-300 mt-3">{item.purpose}</p>}
        <p className="text-xs text-gray-500 mt-2">{item.preferred_start ? new Date(item.preferred_start).toLocaleString("ru-RU") : "Дата не указана"} · {item.duration_minutes} мин.</p>
        {item.review_comment && <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">Комментарий: {item.review_comment}</p>}
        {isManager && item.status==="pending" && <div className="mt-4 flex flex-wrap gap-2"><button onClick={()=>{setActiveReview(item.id);setComment("");}} className="rounded-lg bg-blue-600 text-white px-3 py-2 text-sm">Рассмотреть</button>
          {activeReview===item.id && <div className="w-full flex flex-wrap gap-2"><input value={comment} onChange={e=>setComment(e.target.value)} placeholder="Комментарий (необязательно)" className="flex-1 min-w-48 rounded-lg border px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600"/><button onClick={()=>review(item.id,"approved")} className="rounded-lg bg-emerald-600 text-white px-3 py-2 text-sm">Одобрить</button><button onClick={()=>review(item.id,"rejected")} className="rounded-lg bg-rose-600 text-white px-3 py-2 text-sm">Отклонить</button></div>}</div>}
      </article>)}
    </div>}

    {tab === "rooms" && <div className="space-y-4"><div className="flex justify-between items-center gap-3"><p className="text-sm text-gray-500">Сведения об оснащении загружаются из карточек залов.</p>{isManager && <button onClick={() => onNavigate("admin")} className="rounded-xl bg-blue-600 text-white px-4 py-2 text-sm font-semibold">Управлять залами</button>}</div><div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
      {rooms.map(room => <article key={room.id} className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex justify-between gap-2"><h3 className="font-bold text-gray-900 dark:text-white">{room.name}</h3><span className={`text-xs rounded-full px-2 py-1 h-fit ${room.is_active===false?"bg-gray-100 text-gray-500":"bg-emerald-100 text-emerald-700"}`}>{room.is_active===false?"Неактивен":"Активен"}</span></div>
        <p className="text-sm text-gray-500 mt-2">{room.location || "Местоположение не указано"}{room.capacity ? ` · до ${room.capacity} человек` : ""}</p>
        <div className="mt-4 text-xs text-gray-500 uppercase tracking-wide">Оснащение</div>
        <div className="flex flex-wrap gap-1.5 mt-2">{(Array.isArray(room.equipment)?room.equipment:Object.values(room.equipment||{})).filter(Boolean).map((x,i)=><span key={i} className="rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200 px-2 py-1 text-xs">{String(x)}</span>)}
        {(!room.equipment || Object.keys(room.equipment).length===0) && <span className="text-sm text-gray-400">Не указано</span>}</div>
      </article>)}
      {rooms.length===0 && <div className="text-gray-500">Нет доступных залов.</div>}
    </div></div>}

    {tab === "assistant" && <div className="max-w-3xl rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5 sm:p-7">
      <div className="text-3xl">✨</div><h2 className="text-xl font-bold text-gray-900 dark:text-white mt-2">Помощник организатора</h2>
      <p className="text-sm text-gray-500 mt-2">Помогает подготовить заявку и подсказывает, какие шаги проверить. Пока работает на встроенных правилах и не отправляет данные во внешние ИИ-сервисы.</p>
      <textarea value={assistantText} onChange={e=>setAssistantText(e.target.value)} placeholder="Например: как перенести конференцию или подобрать зал с видеосвязью?" rows={4} className="w-full mt-5 rounded-xl border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-3 text-sm dark:text-white"/>
      <button onClick={askAssistant} className="mt-3 rounded-xl bg-indigo-600 text-white px-5 py-2.5 text-sm font-semibold">Получить подсказку</button>
      {assistantAnswer && <div className="mt-5 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 p-4 text-sm text-indigo-950 dark:text-indigo-100">{assistantAnswer}</div>}
      <div className="grid sm:grid-cols-2 gap-2 mt-5">{["Подобрать зал","Подготовить заявку","Проверить перенос","Как согласовать ВКС"].map(q=><button key={q} onClick={()=>{setAssistantText(q);setAssistantAnswer("");}} className="text-left rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:border-indigo-300">{q} →</button>)}</div>
    </div>}

    {tab === "audit" && canViewAudit && <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="p-4 border-b dark:border-gray-700 font-semibold text-gray-900 dark:text-white">Последние действия пользователей</div>
      {auditRows.length===0 ? <p className="p-6 text-sm text-gray-500">Журнал пока пуст или недоступен для текущей роли.</p> : auditRows.slice(0,50).map((row:any)=><div key={row.id} className="px-4 py-3 border-b dark:border-gray-700 flex justify-between gap-3 text-sm"><span className="text-gray-700 dark:text-gray-200">{row.action} · {row.user?.name || "Система"}</span><span className="text-xs text-gray-400 whitespace-nowrap">{new Date(row.created_at).toLocaleString("ru-RU")}</span></div>)}
    </div>}
  </section>;
}
