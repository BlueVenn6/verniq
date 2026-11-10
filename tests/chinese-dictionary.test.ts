import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCedict } from "@/src/lib/chineseDictionary";
import { dictionaryResultToVocabularyFields } from "@/src/lib/dictionary";

describe("bundled CC-CEDICT", () => {
  it("loads the actual bundled dictionary, including both scripts and pinyin", () => {
    const text = gunzipSync(readFileSync("public/dictionaries/cedict.txt.gz")).toString("utf8");
    expect(text).toContain("creativecommons.org/licenses/by-sa/4.0");
    const dictionary = parseCedict(text);
    expect(dictionary.size).toBeGreaterThan(100000);
    expect(dictionary.get("学习")).toEqual(dictionary.get("學習"));
    expect(dictionary.get("学习")?.[0].pinyin).toBe("xue2 xi2");
    expect(dictionary.get("学习")?.[0].meanings.join(" ")).toContain("learn");
  });
  it("keeps pronunciation when creating vocabulary fields", () => {
    const fields = dictionaryResultToVocabularyFields({ term: "学习", normalizedTerm: "学习", language: "zh", source: "cc-cedict", phonetic: "xue2 xi2", definitions: [{ partOfSpeech: "", definition: "to learn", synonyms: [] }], externalLinks: [] });
    expect(fields.pronunciation).toBe("xue2 xi2");
    expect(fields.meaningEn).toBe("to learn");
  });
});
