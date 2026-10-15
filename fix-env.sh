#!/bin/bash
# Починка .env без Python (Git Bash / MSYS на Windows, Linux).
# PowerShell дописывает в конец .env кусок в UTF-16LE (нулевые байты) —
# docker compose падает: "unexpected character \\x00". Пересобираем файл в UTF-8(LF).
set -e
cd "$(dirname "$0")"
[ -f .env ] || { echo "[fix-env] .env не найден"; exit 1; }

if ! grep -q $'\x00' .env 2>/dev/null; then
  # нулей нет — просто нормализуем CRLF и BOM
  sed -i -e 's/\r$//' -e '1s/^\xEF\xBB\xBF//' .env
  echo "[fix-env] .env уже без нулей — нормализованы только концы строк (LF)"
  exit 0
fi

bak=".env.bak.$(date +%s)"; cp .env "$bak"; echo "[fix-env] резервная копия: $bak"

# Универсальный способ без Python: awk с RS="\0" вырезает ВСЕ нулевые байты.
# Для UTF-16LE-кусков ("V\0I\0T\0E...") это даёт ровно правильный текст
# ("VITE_..."), а UTF-8 часть (где нулей нет) проходит без изменений.
awk 'BEGIN{RS="\0"; ORS=""} {print}' .env > .env.tmp

# PowerShell "echo ... >> .env" часто НЕ добавляет перевод строки перед
# допиской — чиним склейку вида "...=0VITE_..." -> две отдельные строки.
sed -i -e 's/=[A-Za-z0-9_]*\(VITE_[A-Z_]*=\)/=\n\1/g' .env.tmp

# нормализация концов строк + BOM
sed -i -e 's/\r$//' -e '1s/^\xEF\xBB\xBF//' .env.tmp

# дедупликация переменных: если ключ уже встречен со НЕПУСТЫМ значением —
# пропускаем повторное определение (поздние дописки PowerShell перекрывали
# боевые значения пустыми/мусорными)
awk '
  /^[[:space:]]*#/ || /^[[:space:]]*$/ { out[n++]=($0=="")?"":$0; next }
  {
    eq = index($0, "=")
    if (eq > 0) {
      key = substr($0, 1, eq-1)
      val = substr($0, eq+1)
      if (key in seen && seen[key] != "") { next }        # уже задано непустым — игнор
      if (!(key in seen) || seen[key]=="") { seen[key]=val }
    }
    out[n++]=$0
  }
  END { for (i=0;i<n;i++) print out[i] "\n" }
' .env.tmp > .env.tmp2 && mv .env.tmp2 .env.tmp

if grep -q $'\x00' .env.tmp 2>/dev/null; then
  echo "[fix-env] ОШИБКА: нули остались после конвертации"
  exit 1
fi
mv .env.tmp .env
echo "[fix-env] OK: .env пересохранён в UTF-8 (LF), нулей нет, дубли переменных убраны."
echo "[fix-env] Проверьте содержимое: cat .env | tail -8"
