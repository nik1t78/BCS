import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../src/api/serverTime.ts", import.meta.url), "utf8");
const match = source.match(
  /export function serverDateTimeToEpoch\(date: string, hm: string\): number \{([\s\S]*?)\n\}/
);
assert.ok(match, "serverDateTimeToEpoch must remain an exported function");

function convert(date, hm, timezone) {
  const executableBody = match[1]
    .replace(/: Intl\.DateTimeFormat/g, "")
    .replace(/\(type: string\)/g, "(type)");
  const fn = vm.runInNewContext(
    `(date, hm) => { ${executableBody}\n}`,
    { getServerTimezone: () => timezone }
  );
  return fn(date, hm);
}

assert.equal(
  convert("2026-11-26", "10:00", "Europe/Moscow"),
  Date.UTC(2026, 10, 26, 7, 0),
  "Moscow server wall time must convert to UTC independently of browser timezone"
);
assert.equal(
  convert("2026-11-26", "10:00", "Europe/Berlin"),
  Date.UTC(2026, 10, 26, 9, 0),
  "Berlin server wall time must use the winter UTC+1 offset"
);
assert.equal(
  convert("2026-07-15", "10:00", "America/New_York"),
  Date.UTC(2026, 6, 15, 14, 0),
  "New York server wall time must respect daylight saving time"
);
assert.ok(Number.isNaN(convert("2026-02-31", "10:00", "Europe/Moscow")));
assert.ok(Number.isNaN(convert("2026-11-26", "25:90", "Europe/Moscow")));
assert.ok(
  Number.isNaN(convert("2026-03-29", "02:30", "Europe/Berlin")),
  "Nonexistent local times during the spring DST jump must be rejected"
);

const calendarMatch = source.match(
  /export function serverCalendarDate\(\): Date \{([\s\S]*?)\n\}/
);
assert.ok(calendarMatch, "serverCalendarDate must remain an exported function");
const calendarDate = vm.runInNewContext(
  `() => { ${calendarMatch[1]}\n}`,
  {
    serverTodayKey: () => "2026-11-26",
    serverNowHm: () => "10:05",
  }
)();
assert.deepEqual(
  [
    calendarDate.getFullYear(),
    calendarDate.getMonth() + 1,
    calendarDate.getDate(),
    calendarDate.getHours(),
    calendarDate.getMinutes(),
  ],
  [2026, 11, 26, 10, 5],
  "Dashboard calendar date must expose server wall-clock fields in any browser timezone"
);

console.log("Server timezone countdown regression checks passed.");
