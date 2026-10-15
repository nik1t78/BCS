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

# Универсальный способ без Python: делим файл по ПЕРВОМУ нулевому байту.
# Всё до него — легитимная UTF-8-часть (нули в UTF-8 для ASCII-текста невозможны);
# всё после — кусок, записанный PowerShell в UTF-16LE: вырезаем из него нули
# (tr -d), получаем ровно правильный текст ("V\0I\0T\0E..." -> "VITE_...").
# Важно: позиция считается побайтово через index()+ORS='' (awk не печатает \0,
# поэтому индекс берём из stdout отдельно).
# ORS='' ОБЯЗАТЕЛЕН: иначе awk добавляет перевод строки к числу, а $() его
# отбрасывает — смещение оказывается на 1 байт больше и «съедает» первый символ
# UTF-16-хвоста (V -> "ITE_..."), оставляя валидный KEY= с мусорным значением.
NP=$(awk '{p=index($0,"\0"); if(p>0){print (NR-1)*length($0)+p-1; exit}}' ORS='' .env)
if [ -n "$NP" ]; then
  head -c "$NP" .env > .env.head
  tail -c +"$((NP+1))" .env | tr -d '\000\r' > .env.tail
  # если хвост не заканчивается переводом строки — добавим, чтобы склейка была чистой
  [ -s .env.tail ] && [ "$(tail -c 1 .env.tail)" != "" ] && echo >> .env.tail
  cat .env.head .env.tail > .env.tmp
  rm -f .env.head .env.tail
else
  # запасной вариант: просто вырезать все нули
  tr -d '\000' < .env > .env.tmp
fi

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
