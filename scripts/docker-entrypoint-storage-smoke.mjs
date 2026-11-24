import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, existsSync, writeFileSync, chmodSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const entrypoint = join(repoRoot, "backend", "docker-entrypoint.sh");
const tempRoot = mkdtempSync(join(tmpdir(), "bcs-entrypoint-smoke-"));
const appDir = join(tempRoot, "app");
const binDir = join(tempRoot, "bin");
mkdirSync(appDir, { recursive: true });
mkdirSync(binDir, { recursive: true });

// Stub ownership/permission commands: the test must never change host ownership.
for (const command of ["chown", "chmod"]) {
  const stub = join(binDir, command);
  writeFileSync(stub, "#!/bin/sh\nexit 0\n");
  chmodSync(stub, 0o755);
}

try {
  const result = spawnSync("sh", [entrypoint, "/bin/true"], {
    encoding: "utf8",
    env: {
      ...process.env,
      APP_DIR: appDir,
      PATH: binDir + ":" + process.env.PATH,
      BCS_RUN_AS_WWW_DATA: "0",
    },
  });

  assert.equal(result.status, 0, result.stderr || result.stdout || "entrypoint failed");

  for (const relativePath of [
    "storage/framework/cache/data",
    "storage/framework/sessions",
    "storage/framework/views",
    "storage/logs",
    "storage/app/heartbeat",
    "storage/app/public",
    "storage/app/private",
    "bootstrap/cache",
  ]) {
    assert.ok(existsSync(join(appDir, relativePath)), "entrypoint must create " + relativePath);
  }

  console.log("Docker entrypoint storage smoke checks passed.");
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
