# ============================================================
#  ФИКСЫ ВКС: окна «Свободные залы» / «Расписание аудиторий»
#  больше не закрываются сами; защита от двойного клика.
#  Запуск: cd D:\server ; powershell -ExecutionPolicy Bypass -File .\apply_fixes.ps1
# ============================================================
$ErrorActionPreference = "Stop"
$enc = New-Object System.Text.UTF8Encoding($false)

function Edit-File($path, $pairs) {
  $t = [IO.File]::ReadAllText($path, [Text.Encoding]::UTF8)
  foreach ($p in $pairs) {
    $old = $p[0]; $new = $p[1]
    if ($t.Contains($old)) {
      $t = $t.Replace($old, $new)
      Write-Host "OK   : заменено в $([IO.Path]::GetFileName($path))"
    } elseif ($t.Contains($new)) {
      Write-Host "SKIP : уже применено в $([IO.Path]::GetFileName($path))"
    } else {
      Write-Host "FAIL : фрагмент НЕ НАЙДЕН в $path ::" $old.Substring(0,[Math]::Min(60,$old.Length))
    }
  }
  [IO.File]::WriteAllText($path, $t, $enc)
}

# ---------- 1) src/components/RoomBookingModal.tsx ----------
Edit-File "src\components\RoomBookingModal.tsx" @(
  ,@('  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>',
'  // Закрытие модалки по Escape — как в нативных диалогах.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onMouseDown={(e) => { (e.target as HTMLElement).setAttribute("data-backdown", "1"); }}
      onClick={(e) => {
        // Закрываем ТОЛЬКО если и mousedown, и mouseup были на самом фоне.
        // Иначе всплывающие клики по шкале времени мгновенно закрывали окно.
        const t = e.target as HTMLElement;
        if (t.getAttribute("data-backdown") === "1") onClose();
      }}
    >')
)

# ---------- 2) src/components/UserPanel.tsx ----------
Edit-File "src\components\UserPanel.tsx" @(
  @('import React, { useState, useEffect } from "react";',
    'import React, { useState, useEffect, useRef } from "react";'),
  @('  /** Вызывается после успешного создания конференции (для закрытия модалки) */
  onCreated?: () => void;',
    '  /** Вызывается после успешного создания конференции (для закрытия модалки) */
  onCreated?: () => void;
  /** Закрытие формы без сохранения (в режиме formOnly — закрыть модалку на главной) */
  onClose?: () => void;'),
  @('export default function UserPanel({ user, onNavigate, initialPrefill, onPrefillConsumed, formOnly, onCreated }: UserPanelProps) {',
    'export default function UserPanel({ user, onNavigate, initialPrefill, onPrefillConsumed, formOnly, onCreated, onClose }: UserPanelProps) {'),
  @('  const [loading, setLoading] = useState(true);',
    '  // formOnly: НЕ начинаем с loading=true — иначе при каждом обновлении
  // списка встреч панель размонтируется и форма закрывается сама.
  const [loading, setLoading] = useState(!formOnly);'),
  # ВАЖНО: formData должен содержать prefill СРАЗУ на первом рендере,
  # иначе окно «быстро закрывается» и выбрать ничего нельзя.
  @('  const [formData, setFormData] = useState<Meeting>(emptyMeeting);',
    '  const [formData, setFormData] = useState<Meeting>(() => {
    if (initialPrefill) {
      return {
        ...emptyMeeting,
        date: initialPrefill.date ?? emptyMeeting.date,
        startTime: initialPrefill.startTime ?? emptyMeeting.startTime,
        endTime: initialPrefill.endTime ?? emptyMeeting.endTime,
        room: initialPrefill.room || emptyMeeting.room,
        link: initialPrefill.autoLink ? "" : initialPrefill.link || "",
      };
    }
    return emptyMeeting;
  });'),
  @('    setShowForm(true);
    onPrefillConsumed?.();',
    '    setShowForm(true);
    // formOnly: НЕ сбрасываем prefill у родителя — иначе Dashboard делает
    // setCreatePrefill(null) и панель мгновенно закрывается.
    if (!formOnly) onPrefillConsumed?.();'),
  @('  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.date || !formData.startTime || !formData.endTime) {',
    '  // Защита от двойного submit (двойной клик по «Создать»)
  const savingRef = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    try { await handleSubmitInner(); } finally { savingRef.current = false; }
  };

  const handleSubmitInner = async () => {
    if (!formData.title || !formData.date || !formData.startTime || !formData.endTime) {'),
  @('  if (formOnly) {
    return showForm ? (',
    '  if (formOnly) {
    // Единое закрытие панели: обязательно уведомляем родителя.
    const closePanel = () => {
      setShowForm(false);
      setConflicts([]);
      setConflictChecked(false);
      setForceSave(false);
      onClose?.();
    };
    return showForm ? ('),
  @('            <button
              onClick={() => {
                setShowForm(false);
                setConflicts([]);
                setConflictChecked(false);
                setForceSave(false);
                onCreated?.();
              }}
              className="text-gray-400 hover:text-gray-600"
            >',
    '            <button
              onClick={closePanel}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Закрыть"
            >'),
  @('            onCancel={() => {
              setShowForm(false);
              setConflicts([]);
              setConflictChecked(false);
              setForceSave(false);
            }}',
    '            onCancel={closePanel}')
)

# ---------- 3) src/components/Dashboard.tsx ----------
Edit-File "src\components\Dashboard.tsx" @(
  @('        <div className="fixed inset-0 z-[60] bg-black/50 flex items-start justify-center p-4 overflow-auto" onClick={() => setCreatePrefill(null)}>',
    '        <div
          className="fixed inset-0 z-[60] bg-black/50 flex items-start justify-center p-4 overflow-auto"
          onMouseDown={(e) => { (e.target as HTMLElement).setAttribute("data-backdown", "1"); }}
          onClick={(e) => {
            const t = e.target as HTMLElement;
            if (t.getAttribute("data-backdown") === "1") setCreatePrefill(null);
          }}
        >'),
  @('                formOnly
                initialPrefill={createPrefill}',
    '                formOnly
                onClose={() => setCreatePrefill(null)}
                initialPrefill={createPrefill}')
)

Write-Host ""
Write-Host "Готово. Сборка и запуск:"
Write-Host "  docker compose build frontend"
Write-Host "  docker compose up -d frontend nginx"
Write-Host "Затем откройте сайт с Ctrl+F5."
