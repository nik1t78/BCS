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

# Граница «UTF-8 часть | UTF-16LE хвост»: позиция первого из 4+ подряд нулей.
pos=$(od -An -v -tu1 .env | tr -s ' \n' '\n' | awk '
  { b[NR]=$1 }
  END {
    for (i=1;i<=NR;i++) {
      if (b[i]==0 && b[i+1]==0 && b[i+2]==0 && b[i+3]==0) { print i-1; exit }
    }
    print -1
  }')
[ "$pos" -ge 0 ] || { echo "[fix-env] не нашёл границу гибрида"; exit 1; }

# сдвигаем границу назад до последнего \n внутри UTF-8-части (иначе отрежем полстроки)
cut=$pos
while [ "$cut" -gt 0 ]; do
  lastc=$(dd if=.env bs=1 skip=$((cut-1)) count=1 2>/dev/null | od -An -tx1 | tr -d ' \n')
  if [ "$lastc" = "0a" ]; then break; fi
  cut=$((cut-1))
done
tail_start=$cut
total=$(wc -c < .env)
tail_len=$((total - tail_start))
# длина хвоста для UTF-16LE должна быть чётной
if [ $((tail_len % 2)) -ne 0 ]; then tail_len=$((tail_len-1)); fi

# UTF-8 часть (первые tail_start байт) + декодированный UTF-16LE хвост.
dd if=.env bs=1 count=$tail_start 2>/dev/null > .env.tmp
if [ "$tail_len" -gt 0 ]; then
  dd if=.env bs=1 skip=$tail_start count=$tail_len 2>/dev/null \
    | iconv -f UTF-16LE -t UTF-8//IGNORE >> .env.tmp || true
fi

# финальная зачистка на всякий случай: все нули/управляющие байты, CR, BOM
tr -d '\000\001\002\003\004\005\006\007' < .env.tmp > .env.tmp2 && mv .env.tmp2 .env.tmp
sed -i -e 's/\r$//' -e '1s/^\xEF\xBB\xBF//' .env.tmp

if grep -q $'\x00' .env.tmp 2>/dev/null; then
  echo "[fix-env] ОШИБКА: нули остались после конвертации"
  exit 1
fi
mv .env.tmp .env
echo "[fix-env] OK: .env пересохранён в UTF-8 (LF), нулей нет."
echo "[fix-env] Проверьте содержимое: cat .env | tail -8"
