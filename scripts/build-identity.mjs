import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
export async function sourceIdentity() {
  const paths = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean).sort();
  const files = [];
  for (const path of paths) {
    const full = join(root, path);
    try {
      if ((await stat(full)).isFile()) files.push({ path, sha256: hash(await readFile(full)) });
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return { commit: git("rev-parse", "HEAD"), sourceSha256: hash(JSON.stringify(files)), dirty: Boolean(git("status", "--porcelain", "-uall")), fileCount: files.length };
}
export async function assertCurrentBuild() {
  const built = JSON.parse(await readFile(join(root, "out/verniq-build.json"), "utf8"));
  const current = await sourceIdentity();
  if (built.commit !== current.commit || built.sourceSha256 !== current.sourceSha256) throw new Error("Production output does not match the current source. Run npm run build before verification.");
  return built;
}
if (resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  const snapshot = join(root, "build/source-snapshot.json");
  const current = await sourceIdentity();
  if (process.argv[2] === "capture") {
    await mkdir(join(root, "build"), { recursive: true });
    await writeFile(snapshot, JSON.stringify(current, null, 2));
  } else if (process.argv[2] === "stamp") {
    const before = JSON.parse(await readFile(snapshot, "utf8"));
    if (before.commit !== current.commit || before.sourceSha256 !== current.sourceSha256) throw new Error("Source changed while building. This output cannot be accepted as a verified build.");
    await writeFile(join(root, "out/verniq-build.json"), JSON.stringify({ ...current, builtAt: new Date().toISOString() }, null, 2));
  } else throw new Error("Use capture or stamp");
}
