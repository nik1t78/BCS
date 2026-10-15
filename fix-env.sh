#!/bin/bash
# Починка .env без Python (Git Bash / MSYS на Windows, Linux).
# PowerShell дописывает в конец .env кусок в UTF-16LE (нулевые байты) —
# docker compose падает: "unexpected character \\x00". Пересобираем файл в UTF-8(LF).
set -e
cd "$(dirname "$0")"
[ -f .env ] || { echo "[fix-env] .env не найден"; exit 1; }

has_nulls() { tr -d -c '\000' < "$1" | wc -c | grep -qv '^0$'; }
if ! has_nulls .env; then
  # нулей нет — просто нормализуем CRLF и BOM
  sed -i -e 's/\r$//' -e '1s/^\xEF\xBB\xBF//' .env
  echo "[fix-env] .env уже без нулей — нормализованы только концы строк (LF)"
  exit 0
fi

bak=".env.bak.$(date +%s)"; cp .env "$bak"; echo "[fix-env] резервная копия: $bak"

# Универсальный способ без Python: tr -d вырезает ВСЕ нулевые байты.
# Для UTF-16LE-кусков ("V\0I\0T\0E...") это даёт ровно правильный текст
# ("VITE_..."), а UTF-8 часть (где нулей нет) проходит без изменений.
# tr -d '\0' вырезает нулевые байты надёжно на всех awk/sed (MSYS/GNU).
tr -d '\000' < .env > .env.tmp

# PowerShell "echo ... >> .env" часто НЕ добавляет перевод строки перед
# допиской — чиним склейку вида "...=0VITE_..." -> две отдельные строки.
sed -i -e 's/=[A-Za-z0-9_]*\(VITE_[A-Z_]*=\)/=\n\1/g' .env.tmp

# нормализация концов строк + BOM
sed -i -e 's/\r$//' -e '1s/^\xEF\xBB\xBF//' .env.tmp

# дедупликация переменных: если ключ уже встречен со НЕПУСТЫМ значением —
# пропускаем повторное определение (поздние дописки PowerShell перекрывали
# боевые значения пустыми/мусорными)
# Дедупликация переменных в два прохода (без GNU-расширений awk — работает
# и на mawk/busybox в Git Bash):
#   проход 1: для каждого ключа берётся ПЕРВОЕ непустое значение;
#   проход 2: строка "KEY=val" заменяется на "KEY=<лучшее>", повторы удаляются.
awk -F= '
  !/^[[:space:]]*#/ && !/^[[:space:]]*$/ && index($0,"=")>0 {
    key=$1; sub(/^[[:space:]]+/,"",key); sub(/[[:space:]]+$/,"",key)
    val=substr($0, length($1)+2)
    if (!(key in best) && val!="") best[key]=val
  }
  { lines[NR]=$0 }
  END {
    for (i=1;i<=NR;i++) {
      $0=lines[i]
      if (/^[[:space:]]*#/ || /^[[:space:]]*$/ || index($0,"=")==0) { print; continue }
      key=$1; sub(/^[[:space:]]+/,"",key); sub(/[[:space:]]+$/,"",key)
      if (key in done) continue          # повторный ключ — выбрасываем строку
      done[key]=1
      v=(key in best)?best[key]:substr($0, length($1)+2)
      print key "=" v
    }
  }
' .env.tmp > .env.tmp2 && mv .env.tmp2 .env.tmp

if has_nulls .env.tmp; then
  echo "[fix-env] ОШИБКА: нули остались после конвертации"
  exit 1
fi
mv .env.tmp .env
echo "[fix-env] OK: .env пересохранён в UTF-8 (LF), нулей нет, дубли переменных убраны."
echo "[fix-env] Проверьте содержимое: cat .env | tail -8"
