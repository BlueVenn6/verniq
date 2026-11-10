import { writeFile, readFile, mkdir } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";

const source = "https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz";
const localIndex = process.argv.indexOf("--from");
let data;
if (localIndex >= 0) {
  if (!process.argv[localIndex + 1]) throw new Error("Supply a downloaded CC-CEDICT gzip file after --from.");
  data = await readFile(process.argv[localIndex + 1]);
} else {
  const response = await fetch(source, { signal: AbortSignal.timeout(600000) });
  if (!response.ok) throw new Error(`CC-CEDICT download failed: ${response.status}`);
  data = Buffer.from(await response.arrayBuffer());
}
const text = gunzipSync(data).toString("utf8");
if (!text.includes("creativecommons.org/licenses/by-sa/4.0")) throw new Error("Unexpected dictionary license; review before updating.");
const entries = text.split("\n").filter((line) => line && !line.startsWith("#")).length;
if (entries < 100000) throw new Error("Incomplete dictionary download.");
const output = new URL("../public/dictionaries/", import.meta.url);
await mkdir(output, { recursive: true });
await writeFile(new URL("cedict.txt.gz", output), data);
await writeFile(new URL("cedict-source.json", output), JSON.stringify({
  name: "CC-CEDICT", source, license: "CC BY-SA 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  attribution: "CC-CEDICT contributors; distributed by MDBG",
  downloadedAt: new Date().toISOString(), entries,
  sha256: createHash("sha256").update(data).digest("hex"),
}, null, 2) + "\n");
console.log(`Saved ${entries} CC-CEDICT entries (${data.length} compressed bytes).`);
