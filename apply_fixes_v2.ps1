# =====================================================================
# apply_fixes_v2.ps1  —  фиксы ВКС для кода на origin/main (39bb6688)
#   1) RoomBookingModal: окно «Выбор зала» мгновенно закрывалось от
#      любого click с всплытием (шкала времени/скролл) — нельзя выбрать.
#   2) Dashboard: backdrop панели «Создание ВКС» — та же проблема.
#   3) UserPanel(formOnly): loading=true -> панель исчезала после
#      сохранения; крестик вызывал onCreated (ложный сценарий);
#      onCancel не уведомлял родителя; двойной клик дублировал встречу.
# Запуск из папки D:\server:  powershell -ExecutionPolicy Bypass -File .\apply_fixes_v2.ps1
# =====================================================================
$ErrorActionPreference = "Stop"

function Edit-File([string]$path, [array]$pairs) {
    $text = [IO.File]::ReadAllText($path)
    foreach ($p in $pairs) {
        $old = $p[0]; $new = $p[1]
        if (-not $text.Contains($old)) { Write-Host "  ПРОПУСК (не найдено): $($old.Substring(0,[Math]::Min(70,$old.Length)))..." -ForegroundColor Yellow; continue }
        $text = $text.Replace($old, $new)
        Write-Host "  OK: заменено $($p[0].Substring(0,[Math]::Min(60,$old.Length)))..." -ForegroundColor Green
    }
    [IO.File]::WriteAllText($path, $text)
}

# ---------- 1) src/components/RoomBookingModal.tsx ----------
Write-Host "`n=== RoomBookingModal.tsx ===" -ForegroundColor Cyan
Edit-File "src\components\RoomBookingModal.tsx" @(
 @('    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>',
'    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onMouseDown={(e) => { (e.target as HTMLElement).setAttribute("data-backdown", "1"); }}
      onClick={(e) => {
        // Закрываем ТОЛЬКО если и mousedown, и mouseup произошли на самом фоне.
        // Раньше закрытие шло по любому click с «всплытием» из скролла/drag
        // шкалы времени — модалка мгновенно закрывалась, нельзя было выбрать.
        const t = e.target as HTMLElement;
        if (t.getAttribute("data-backdown") === "1") onClose();
      }}
    >')
)

# ---------- 2) src/components/Dashboard.tsx ----------
Write-Host "`n=== Dashboard.tsx ===" -ForegroundColor Cyan
Edit-File "src\components\Dashboard.tsx" @(
 @('<div className="fixed inset-0 z-[60] bg-black/50 flex items-start justify-center p-4 overflow-auto" onClick={() => setCreatePrefill(null)}>',
'<div
          className="fixed inset-0 z-[60] bg-black/50 flex items-start justify-center p-4 overflow-auto"
          onMouseDown={(e) => { (e.target as HTMLElement).setAttribute("data-backdown", "1"); }}
          onClick={(e) => {
            const t = e.target as HTMLElement;
            if (t.getAttribute("data-backdown") === "1") setCreatePrefill(null);
          }}
        >'),
 @('                initialPrefill={createPrefill}',
'                initialPrefill={createPrefill}
                onClose={() => setCreatePrefill(null)}')
)

# ---------- 3) src/components/UserPanel.tsx ----------
Write-Host "`n=== UserPanel.tsx ===" -ForegroundColor Cyan
Edit-File "src\components\UserPanel.tsx" @(
 # 3.1 props: добавить onClose
 @('  /** Вызывается после успешного создания конференции (для закрытия модалки) */
  onCreated?: () => void;',
'  /** Вызывается после успешного создания конференции (для закрытия модалки) */
  onCreated?: () => void;
  /** Закрытие панели создания (formOnly) без создания — уведомить родителя */
  onClose?: () => void;'),
 # 3.2 сигнатура компонента
 @('export default function UserPanel({ user, onNavigate, initialPrefill, onPrefillConsumed, formOnly, onCreated }: UserPanelProps) {',
'export default function UserPanel({ user, onNavigate, initialPrefill, onPrefillConsumed, formOnly, onCreated, onClose }: UserPanelProps) {'),
 # 3.3 loading: в formOnly НЕ начинать с true (иначе панель размонтируется при loadData)
 @('  const [loading, setLoading] = useState(true);',
'  const [loading, setLoading] = useState(!formOnly);'),
 # 3.4 хэндлер закрытия панели + мьютекс двойной отправки
 @('    loadData();
    setShowForm(false);
    setEditingMeeting(null);
    setFormData(emptyMeeting);
    setConflicts([]);
    setConflictChecked(false);
    setForceSave(false);
    onCreated?.();
  };',
'    loadData();
    setShowForm(false);
    setEditingMeeting(null);
    setFormData(emptyMeeting);
    setConflicts([]);
    setConflictChecked(false);
    setForceSave(false);
    onCreated?.();
  };

  // Единое корректное закрытие панели создания (крестик / Отмена).
  // Раньше крестик вызывал onCreated?.() — ложный сценарий «создано»,
  // а onCancel вообще не уведомлял родителя (панель могла «восставать»).
  const closePanel = () => {
    setShowForm(false);
    setConflicts([]);
    setConflictChecked(false);
    setForceSave(false);
    onClose?.();
  };

  // Защита от двойного клика «Создать»: вторая отправка игнорируется.
  const savingRef = useRef(false);'),
 # 3.5 guard в начале handleSubmit (до генерации ссылки ВКС)
 @('      setSavingNote("Создаём ссылку ВКС на salutejazz.ru…");',
'      if (savingRef.current) return;
      savingRef.current = true;
      setSavingNote("Создаём ссылку ВКС на salutejazz.ru…");'),
 # 3.6 сброс мьютекса в finally вокруг create/update
 @('    const saved = editingMeeting ? await updateMeeting(editingMeeting.id, payload) : await createMeeting(payload);',
'    let saved;
    try {
      saved = editingMeeting ? await updateMeeting(editingMeeting.id, payload) : await createMeeting(payload);
    } finally {
      savingRef.current = false;
    }'),
 # 3.7 крестик формы -> closePanel (а не onCreated)
 @('              onClick={() => {
                setShowForm(false);
                setConflicts([]);
                setConflictChecked(false);
                setForceSave(false);
                onCreated?.();
              }}',
'              onClick={closePanel}'),
 # 3.8 кнопка «Отмена» внутри формы -> closePanel
 @('            onCancel={() => {
              setShowForm(false);
              setConflicts([]);
              setConflictChecked(false);
              setForceSave(false);
            }}',
'            onCancel={closePanel}')
)

# ---------- проверка useRef в импортах ----------
Write-Host "`n=== Проверка импортов React ===" -ForegroundColor Cyan
$t = [IO.File]::ReadAllText("src\components\UserPanel.tsx")
if ($t -match 'import\s*\{[^}]*useRef[^}]*\}\s*from\s*"react"') {
    Write-Host "  useRef уже импортирован" -ForegroundColor Green
} else {
    $t = $t -replace 'import\s*\{([^}]*)\}\s*from\s*"react"', 'import {$1, useRef} from "react"'
    [IO.File]::WriteAllText("src\components\UserPanel.tsx", $t)
    Write-Host "  useRef добавлен в импорт react" -ForegroundColor Green
}

Write-Host "`nГОТОВО. Теперь:" -ForegroundColor Yellow
Write-Host "  docker compose build frontend"
Write-Host "  docker compose up -d frontend nginx"
Write-Host "  и Ctrl+F5 в браузере"
