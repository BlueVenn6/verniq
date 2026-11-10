import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { assertCurrentBuild } from "./build-identity.mjs";

// Checks the actual static server's bytes. This does not simulate browser interactions.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const commit = git("rev-parse", "HEAD");
const status = git("status", "--porcelain", "-uall");
if (status) throw new Error("Commit the reviewed source state before release verification.\n" + status);
const buildIdentity = await assertCurrentBuild();
const base = new URL(process.argv[2] || "http://127.0.0.1:3000");
if (!["127.0.0.1", "localhost", "[::1]"].includes(base.hostname)) throw new Error("Use the local production server.");
const out = join(root, "out");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const files = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else {
      const bytes = await readFile(path);
      files.push({ path: relative(out, path).replaceAll("\\", "/"), bytes: bytes.length, sha256: sha256(bytes) });
    }
  }
}
await walk(out);
files.sort((a, b) => a.path.localeCompare(b.path));
const routes = ["", "inbox", "reader", "review", "growth", "publish", "config-center", "studio", "publish-packages"];
const requests = new Set(["/dictionaries/cedict.txt.gz", "/icon.png", "/brand/verniq-mark-transparent.png", "/brand/verniq-logo-lockup-transparent.png"]);
const englishSource = JSON.parse(await readFile(join(root, "public/dictionaries/ecdict/source.json"), "utf8"));
requests.add("/dictionaries/ecdict/source.json");
requests.add("/dictionaries/ecdict/LICENSE.txt");
for (const entry of englishSource.files) {
  const filePath = `dictionaries/ecdict/${entry.file}`;
  if (files.find((file) => file.path === filePath)?.sha256 !== entry.sha256) throw new Error(`ECDICT source checksum mismatch: ${filePath}`);
  requests.add(`/${filePath}`);
}
const checks = [];
async function verify(pathname, filePath) {
  const response = await fetch(new URL(pathname, base), { cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${pathname}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const expected = files.find((entry) => entry.path === filePath);
  if (!expected || expected.sha256 !== sha256(bytes)) throw new Error(`Served bytes differ from out/${filePath}`);
  checks.push({ url: pathname, file: filePath, sha256: expected.sha256, status: response.status });
  return bytes.toString("utf8");
}
for (const route of routes) {
  const html = await verify(`/${route ? route + "/" : ""}`, `${route ? route + "/" : ""}index.html`);
  for (const match of html.matchAll(/<script[^>]+src="([^"]+)"/g)) requests.add(match[1].replaceAll("&amp;", "&"));
}
for (const path of requests) {
  const url = new URL(path, base);
  if (url.origin !== base.origin) throw new Error("Unexpected external script: " + url.origin);
  await verify(url.pathname, decodeURIComponent(url.pathname.slice(1)));
}
const dictionarySource = JSON.parse(await readFile(join(root, "public/dictionaries/cedict-source.json"), "utf8"));
if (files.find((file) => file.path === "dictionaries/cedict.txt.gz")?.sha256 !== dictionarySource.sha256) throw new Error("Dictionary source checksum mismatch.");
let archive;
if (process.argv[3]) {
  const path = resolve(process.argv[3]);
  const info = await stat(path);
  archive = { path, bytes: info.size, modifiedAt: info.mtime.toISOString(), sha256: sha256(await readFile(path)) };
}
const manifest = {
  repository: root, branch: git("branch", "--show-current"), commit, gitStatus: "clean",
  generatedAt: new Date().toISOString(), buildCommand: "npm run build", buildInput: "app/ and src/ via next.config.ts",
  output: out, server: base.origin, sourceEntry: "app/layout.tsx and app/**/page.tsx", buildIdentity,
  desktopPackagingInput: "src-tauri/tauri.conf.json: frontendDist ../out (desktop package not created)",
  state: "C", limitations: "HTTP bytes verified; browser interactions, real AI inference and desktop packaged application not verified.",
  archive, bundleTreeSha256: sha256(JSON.stringify(files)), files, checks,
};
await mkdir(join(root, "build"), { recursive: true });
const manifestPath = join(root, "build", `verniq-web-${commit.slice(0, 7)}.json`);
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify({ manifest: manifestPath, commit, files: files.length, httpChecks: checks.length, bundleTreeSha256: manifest.bundleTreeSha256, archive, state: manifest.state, limitations: manifest.limitations }, null, 2));
