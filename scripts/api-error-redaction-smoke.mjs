import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const client = readFileSync(new URL("../src/api/client.ts", import.meta.url), "utf8");

assert.ok(client.includes("if (response.status >= 500)"), "5xx responses must use the safe error path");
assert.ok(client.includes("Внутренняя ошибка сервера"), "5xx responses must show a generic message");
assert.ok(client.includes("error.error_id"), "the UI should show the server correlation identifier");
assert.ok(!client.includes("error.detail"), "the UI must not render backend exception detail");
assert.ok(!client.includes("error.exception"), "the UI must not render exception class names");
assert.ok(!client.includes("response.clone().text()"), "the UI must not parse raw 5xx response bodies");

console.log("Frontend API error redaction smoke checks passed.");
