#!/bin/bash
# Починка .env без Python (Git Bash / MSYS на Windows, Linux).
# PowerShell дописывает/перезаписывает .env в UTF-16LE (нулевые байты) —
# docker compose падает: "unexpected character \x00". Пересобираем файл в UTF-8(LF).
set -e
cd "$(dirname "$0")"
[ -f .env ] || { echo "[fix-env] .env не найден"; exit 1; }

has_nulls() { [ "$(tr -d -c '\000' < "$1" | wc -c)" != "0" ]; }
if ! has_nulls .env; then
  # нулей нет — просто нормализуем CRLF и BOM
  sed -i -e 's/\r$//' -e '1s/^\xEF\xBB\xBF//' .env
  echo "[fix-env] .env уже без нулей — нормализованы только концы строк (LF)"
  exit 0
fi

bak=".env.bak.$(date +%s)"; cp .env "$bak"; echo "[fix-env] резервная копия: $bak"

# Позиция ПЕРВОГО нулевого байта через od (побайтово, без засоса awk по \n):
# всё до него — легитимный ASCII/UTF-8 (нули там невозможны), после — UTF-16LE.
NP=$(od -An -v -tu1 -w1 .env | tr -s ' \n' '\n' | grep -v '^$' | grep -nx '0' | head -1 | cut -d: -f1)
NP=$(( ${NP:-1} - 1 ))   # grep -n нумерует с 1 -> байтовое смещение

head -c "$NP" .env > .env.head
tail -c +"$((NP+1))" .env > .env.tail16

# Декодируем хвост из UTF-16LE в UTF-8 (iconv есть в Git Bash и Linux).
decode_tail() {
  if command -v iconv >/dev/null 2>&1; then
    iconv -f UTF-16LE -t UTF-8 .env.tail16 2>/dev/null | tr -d '\r' > .env.tail || : > .env.tail
  else
    tr -d '\000\r' < .env.tail16 > .env.tail
  fi
}
decode_tail

# Если хвост НЕ чётной длины или декодирование дало мусор/нули — сдвигаем
# границу на 1 байт назад (ноль мог принадлежать последнему символу UTF-16LE
# при нечётном «шуме») и пробуем снова.
if [ $(( $(wc -c < .env.tail16) % 2 )) -ne 0 ] || has_nulls .env.tail; then
  head -c "$((NP))" .env > /dev/null 2>&1 || true
  tail -c +1 .env > /dev/null 2>&1 || true
  # переоткрываем голову короче на 1 байт, хвост длиннее на 1
  NP=$((NP - 1))
  head -c "$NP" .env > .env.head
  tail -c +"$((NP+1))" .env > .env.tail16
  decode_tail
fi

# если хвост не заканчивается переводом строки — добавим, чтобы склейка была чистой
if [ -s .env.tail ] && [ "$(tail -c 1 .env.tail)" != "" ]; then printf '\n' >> .env.tail; fi
cat .env.head .env.tail > .env.tmp
rm -f .env.head .env.tail .env.tail16

# PowerShell "echo ... >> .env" часто НЕ добавляет перевод строки перед допиской —
# чиним склейку вида "...=0VITE_..." -> две отдельные строки.
sed -i -e 's/=[A-Za-z0-9_]*\(VITE_[A-Z_]*=\)/=\n\1/g' .env.tmp

# нормализация концов строк + BOM
sed -i -e 's/\r$//' -e '1s/^\xEF\xBB\xBF//' .env.tmp

# дедупликация переменных в два прохода (без GNU-расширений awk — работает
# и на mawk/busybox в Git Bash):
#   проход 1: для каждого ключа берётся ПОСЛЕДНЕЕ непустое значение
#            (поздняя дописка PowerShell = осознанное изменение значения);
#   проход 2: строка "KEY=val" заменяется на "KEY=<лучшее>", повторы удаляются.
awk -F= '
  !/^[[:space:]]*#/ && !/^[[:space:]]*$/ && index($0,"=")>0 {
    key=$1; sub(/^[[:space:]]+/,"",key); sub(/[[:space:]]+$/,"",key)
    val=substr($0, length($1)+2)
    if (val!="") best[key]=val
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
  echo "[fix-env] ОШИБКА: нули остались после конвертации. Восстановите из $bak"
  echo "[fix-env] и пересохраните .env в UTF-8 (Блокнот: Сохранить как -> Кодировка UTF-8)."
  exit 1
fi
mv .env.tmp .env
echo "[fix-env] OK: .env пересохранён в UTF-8 (LF), нулей нет, дубли переменных убраны."
echo "[fix-env] Проверьте содержимое: cat .env | tail -8"
