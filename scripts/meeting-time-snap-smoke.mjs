import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const dateKeySource = readFileSync(new URL("../src/utils/dateKey.ts", import.meta.url), "utf8");
const userPanelSource = readFileSync(new URL("../src/components/UserPanel.tsx", import.meta.url), "utf8");

// Execute the actual pure helper body from TypeScript after removing only its
// parameter/return annotations. This keeps the test tied to production logic.
const helper = dateKeySource.match(
  /export const snapHmTo30 = \(hm: string\): string => \{([\s\S]*?)\n\};/
);
assert.ok(helper, "snapHmTo30 must remain an exported arrow function");
const snapHmTo30 = vm.runInNewContext(`(hm) => { ${helper[1]}\n}`);

const cases = [
  ["10:05", "10:00"],
  ["10:14", "10:00"],
  ["10:15", "10:30"],
  ["10:20", "10:30"],
  ["10:45", "11:00"],
  ["23:59", "23:30"],
  ["00:15", "00:30"],
  ["invalid", "invalid"],
];
for (const [input, expected] of cases) {
  assert.equal(snapHmTo30(input), expected, `snapHmTo30(${input})`);
}

assert.equal(
  (userPanelSource.match(/step=\{1800\}/g) ?? []).length,
  2,
  "both meeting time inputs must use 30-minute native steps"
);
assert.match(
  userPanelSource,
  /const startTime = snapHmTo30\(e\.target\.value\);[\s\S]{0,180}endTime: addMinToHm\(startTime, 30\)/,
  "changing the start must snap it and move the end forward by 30 minutes"
);
assert.match(
  userPanelSource,
  /const endTime = snapHmTo30\(e\.target\.value\);[\s\S]{0,180}startTime: addMinToHm\(endTime, -30\)/,
  "changing the end must snap it and move the start back by 30 minutes"
);

console.log("Meeting time 30-minute snap regression checks passed.");
