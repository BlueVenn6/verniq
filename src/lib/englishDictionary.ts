export type EnglishDictionaryEntry = { word: string; phonetic: string; definition: string; translation: string; partOfSpeech: string };

export function normalizeEnglishDictionaryTerm(term: string) {
  return term.trim().toLowerCase().replaceAll("’", "'").normalize("NFC");
}

export function englishDictionaryShard(term: string) {
  let hash = 2166136261;
  for (const character of normalizeEnglishDictionaryTerm(term)) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  return (hash % 64).toString(16).padStart(2, "0");
}

export function parseEnglishDictionaryShard(value: unknown) {
  if (!Array.isArray(value)) throw new Error("Invalid ECDICT shard");
  const index = new Map<string, EnglishDictionaryEntry>();
  for (const row of value) {
    if (!Array.isArray(row) || typeof row[0] !== "string" || !Array.isArray(row[1]) || row[1].length !== 5 || row[1].some((part: unknown) => typeof part !== "string")) throw new Error("Invalid ECDICT entry");
    const [word, phonetic, definition, translation, partOfSpeech] = row[1] as string[];
    index.set(row[0], { word, phonetic, definition, translation, partOfSpeech });
  }
  return index;
}

const cache = new Map<string, Promise<Map<string, EnglishDictionaryEntry>>>();
export async function lookupEnglishDictionary(term: string) {
  const key = normalizeEnglishDictionaryTerm(term), shard = englishDictionaryShard(key);
  let pending = cache.get(shard);
  if (!pending) {
    pending = (async () => {
      const response = await fetch(`/dictionaries/ecdict/${shard}.json.gz`);
      if (!response.ok || !response.body) throw new Error("内置双语词库加载失败，可重试或查询在线词典。");
      const stream = response.body.pipeThrough(new DecompressionStream("gzip"));
      return parseEnglishDictionaryShard(await new Response(stream).json());
    })().catch((error) => { cache.delete(shard); throw error; });
    cache.set(shard, pending);
    // Load only the requested shard and retain at most four, not the whole database.
    if (cache.size > 4) cache.delete(cache.keys().next().value!);
  }
  return (await pending).get(key);
}
