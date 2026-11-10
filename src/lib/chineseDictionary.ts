export type ChineseEntry = { traditional: string; simplified: string; pinyin: string; meanings: string[] };

export function parseCedict(text: string) {
  const index = new Map<string, ChineseEntry[]>();
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("#")) continue;
    const match = line.match(/^(\S+) (\S+) \[([^\]]+)\] \/(.+)\/$/);
    if (!match) continue;
    const entry = { traditional: match[1], simplified: match[2], pinyin: match[3], meanings: match[4].split("/") };
    for (const word of new Set([entry.simplified, entry.traditional])) {
      const values = index.get(word) ?? [];
      values.push(entry);
      index.set(word, values);
    }
  }
  return index;
}

let dictionary: Promise<Map<string, ChineseEntry[]>> | undefined;
export async function lookupChineseDictionary(term: string) {
  if (!dictionary) {
    dictionary = (async () => {
      const response = await fetch("/dictionaries/cedict.txt.gz");
      if (!response.ok || !response.body) throw new Error("Unable to load the bundled Chinese dictionary.");
      const stream = response.body.pipeThrough(new DecompressionStream("gzip"));
      const index = parseCedict(await new Response(stream).text());
      if (!index.size) throw new Error("The Chinese dictionary is empty or invalid.");
      return index;
    })().catch((error) => { dictionary = undefined; throw error; });
  }
  return (await dictionary).get(term) ?? [];
}
