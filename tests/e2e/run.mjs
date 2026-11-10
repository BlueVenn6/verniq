import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { once } from "node:events";
import { assertCurrentBuild } from "../../scripts/build-identity.mjs";

console.log("Production source identity:", await assertCurrentBuild());
await mkdir("build", { recursive: true });
const port = process.env.VERNIQ_TEST_PORT || "3177";
const base = `http://127.0.0.1:${port}`;
let occupied = false;
try { occupied = (await fetch(base, { signal: AbortSignal.timeout(700) })).ok; } catch { /* A free port is required. */ }
if (occupied) throw new Error("Test port is in use. Choose VERNIQ_TEST_PORT; an existing user's server will not be reused or stopped.");
const server = spawn(process.execPath, ["scripts/serve-out.mjs"], { env: { ...process.env, PORT: port, HOST: "127.0.0.1" }, stdio: "inherit" });
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error("Production server exited before tests");
    try { ready = (await fetch(base, { signal: AbortSignal.timeout(700) })).ok; } catch { /* Wait for this server only. */ }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  if (!ready) throw new Error("Production server did not start");
  for (const script of ["storage-faults", "import-ui", "image-input", "documents", "workbench", "selection-errors", "learning-loop", "setup-help", "card", "responsive"]) {
    const child = spawn(process.execPath, [`tests/e2e/${script}.mjs`], { env: { ...process.env, VERNIQ_TEST_URL: base }, stdio: "inherit" });
    const [code] = await once(child, "exit");
    if (code !== 0) throw new Error(`${script} failed (exit ${code})`);
  }
} finally {
  server.kill();
}
