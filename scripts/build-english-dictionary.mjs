import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { resolve } from "node:path";

// Data only: npm pack ecdict@0.0.4 --ignore-scripts --pack-destination build,
// then extract package/assets/ecdict.csv, LICENSE and README.md with tar.
const input = process.argv[2];
if (!input) throw new Error("Pass the extracted ECDICT CSV path. No package code is executed.");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const bytes = readFileSync(input);
if (sha(bytes) !== "d0ce61e560b50d9905d20de3173aa3ca80950ce235bedd21c53e025cf9f38cb0") throw new Error("ECDICT source checksum mismatch; use the pinned ecdict@0.0.4 CSV.");
const output = resolve("public/dictionaries/ecdict");
const shards = Array.from({ length: 64 }, () => new Map());
function shardFor(term) {
  let hash = 2166136261;
  for (const character of term) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  return hash % 64;
}
function* rows(text) {
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (c === "," || c === "\n")) {
      row.push(field.replace(/\r$/, "")); field = "";
      if (c === "\n") { yield row; row = []; }
    } else field += c;
  }
  if (quoted) throw new Error("Truncated CSV: unterminated quote");
  if (field || row.length) { row.push(field.replace(/\r$/, "")); yield row; }
}
const csv = rows(bytes.toString("utf8"));
const header = csv.next().value;
if (header?.slice(0, 5).join(",") !== "word,phonetic,definition,translation,pos") throw new Error("Unexpected ECDICT CSV schema");
let rowsRead = 0;
for (const row of csv) {
  if (row.length !== header.length) throw new Error(`Invalid CSV row ${rowsRead + 2}`);
  rowsRead++;
  const [word, phonetic, definition, translation, pos] = row.map((value) => value.replaceAll("\\n", "\n").trim());
  if (!word || (!definition && !translation)) continue;
  const normalized = word.toLowerCase().replaceAll("’", "'").normalize("NFC");
  const bucket = shards[shardFor(normalized)];
  // Preserve the most complete entry when case variants share a key.
  const previous = bucket.get(normalized);
  if (!previous || definition.length + translation.length > previous[2].length + previous[3].length) bucket.set(normalized, [word, phonetic, definition, translation, pos]);
}
if (rowsRead < 700000) throw new Error("Incomplete ECDICT source");
mkdirSync(output, { recursive: true });
const files = shards.map((entries, index) => {
  const body = [...entries].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  const compressed = gzipSync(JSON.stringify(body), { level: 9 });
  const file = `${index.toString(16).padStart(2, "0")}.json.gz`;
  writeFileSync(resolve(output, file), compressed);
  return { file, entries: entries.size, bytes: compressed.length, sha256: sha(compressed) };
});
const manifest = {
  name: "ECDICT", upstream: "https://github.com/skywind3000/ECDICT", license: "MIT",
  distribution: "https://registry.npmjs.org/ecdict/-/ecdict-0.0.4.tgz", version: "ecdict@0.0.4 (2022 distribution)",
  distributionIntegrity: "sha512-nFlK3dCARkW9/RbJSqFGVbXwKMX88dqBNf7C3GXpWsGX0omsHkfrYm2L+aNyD+ocK/3J85xrZaplh3oA6uG0Zg==",
  sourceCsvSha256: sha(bytes), sourceCsvBytes: bytes.length, rowsRead,
  entries: files.reduce((total, file) => total + file.entries, 0), shardCount: 64,
  format: "JSON [normalized key, [word, phonetic, English definition, Chinese translation, part of speech]] pairs, gzip. FNV-1a(key) % 64.", files,
};
writeFileSync(resolve(output, "source.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify({ entries: manifest.entries, rowsRead, compressedBytes: files.reduce((sum, f) => sum + f.bytes, 0), sourceCsvSha256: manifest.sourceCsvSha256 }));
