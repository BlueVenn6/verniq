import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { englishDictionaryShard, parseEnglishDictionaryShard } from "@/src/lib/englishDictionary";
import { dictionaryResultToVocabularyFields, lookupDictionary, normalizeDictionaryAudioUrl } from "@/src/lib/dictionary";

const manifest = JSON.parse(readFileSync("public/dictionaries/ecdict/source.json", "utf8")) as { entries: number; files: Array<{ file: string; entries: number; sha256: string }> };
const bytes = (file: string) => readFileSync(`public/dictionaries/ecdict/${file}`);
const shard = (term: string) => parseEnglishDictionaryShard(JSON.parse(gunzipSync(bytes(`${englishDictionaryShard(term)}.json.gz`)).toString("utf8")));
afterEach(() => vi.unstubAllGlobals());

it.each(manifest.files)("verifies the actual bundled ECDICT shard $file", (file) => {
  const compressed = bytes(file.file);
  expect(createHash("sha256").update(compressed).digest("hex")).toBe(file.sha256);
  const entries = parseEnglishDictionaryShard(JSON.parse(gunzipSync(compressed).toString("utf8")));
  expect(entries.size).toBe(file.entries);
  for (const [term] of entries) expect(`${englishDictionaryShard(term)}.json.gz`).toBe(file.file);
});

it("contains real English and Chinese definitions and phonetics, including inflections", () => {
  expect(manifest.entries).toBeGreaterThan(700000);
  const entry = shard("learn").get("learn")!;
  expect(entry.translation).toMatch(/[学]/);
  expect(entry.definition).toMatch(/learn|knowledge|skills/i);
  expect(entry.phonetic).toBeTruthy();
  expect(shard("running").get("running")?.translation).toMatch(/[\p{Script=Han}]/u);
});

it("returns bilingual offline meanings without sending the selected word to any external site", async () => {
  const fetcher = vi.fn(async (url: string) => {
    expect(url).toMatch(/^\/dictionaries\/ecdict\/[0-9a-f]{2}\.json\.gz$/);
    return new Response(bytes(url.split("/").pop()!));
  });
  vi.stubGlobal("fetch", fetcher);
  const result = await lookupDictionary({ term: "learn", language: "en" });
  expect(result.source).toBe("ecdict");
  const fields = dictionaryResultToVocabularyFields(result);
  expect(fields.meaningZh).toMatch(/学/);
  expect(fields.meaningEn).toBeTruthy();
  expect(fields.pronunciation).toBeTruthy();
  expect(fetcher).toHaveBeenCalledOnce();
});

it("preserves Chinese definitions when online audio is absent or the API fails", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => url.startsWith("/")
    ? new Response(bytes(url.split("/").pop()!)) : new Response("{}", { status: 503 })));
  const result = await lookupDictionary({ term: "learner", language: "en", includeOnline: true });
  expect(result.chineseDefinitions?.join(" ")).toMatch(/[\p{Script=Han}]/u);
  expect(result.audioUrl).toBeUndefined();
  expect(result.notices?.length).toBeGreaterThan(0);
});

it("combines an online definition and HTTPS recording with local Chinese meanings", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => url.startsWith("/") ? new Response(bytes(url.split("/").pop()!))
    : Response.json([{ word: "learn", phonetics: [{ text: "/lɜːn/", audio: "//api.dictionaryapi.dev/media/learn.mp3" }], meanings: [{ partOfSpeech: "verb", definitions: [{ definition: "To acquire knowledge." }] }] }])));
  const result = await lookupDictionary({ term: "learn", language: "en", includeOnline: true });
  expect(result.definitions[0].definition).toBe("To acquire knowledge.");
  expect(result.chineseDefinitions?.join(" ")).toMatch(/学/);
  expect(result.audioUrl).toBe("https://api.dictionaryapi.dev/media/learn.mp3");
  expect(normalizeDictionaryAudioUrl("javascript:bad()")).toBeUndefined();
  expect(normalizeDictionaryAudioUrl("http://example.com/file.mp3")).toBeUndefined();
});
