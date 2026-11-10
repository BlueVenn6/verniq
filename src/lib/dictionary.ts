import { lookupEnglishDictionary } from "@/src/lib/englishDictionary";
import { lookupChineseDictionary } from "@/src/lib/chineseDictionary";

export type DictionaryDefinition = {
  partOfSpeech: string;
  definition: string;
  example?: string;
  synonyms: string[];
};

export type DictionaryLookupResult = {
  term: string;
  normalizedTerm: string;
  language: string;
  source: "free-dictionary-api" | "wiktionary" | "external-links" | "cc-cedict" | "ecdict";
  chineseDefinitions?: string[];
  notices?: string[];
  phonetic?: string;
  audioUrl?: string;
  definitions: DictionaryDefinition[];
  wiktionaryExtract?: string;
  externalLinks: Array<{
    label: string;
    url: string;
  }>;
};

type FreeDictionaryEntry = {
  word?: string;
  phonetic?: string;
  phonetics?: Array<{
    text?: string;
    audio?: string;
  }>;
  meanings?: Array<{
    partOfSpeech?: string;
    definitions?: Array<{
      definition?: string;
      example?: string;
      synonyms?: string[];
    }>;
  }>;
};

type WiktionaryResponse = {
  query?: {
    pages?: Record<
      string,
      {
        title?: string;
        extract?: string;
        missing?: boolean;
      }
    >;
  };
};

export async function lookupDictionary({
  term,
  language,
  includeOnline = false,
}: {
  term: string;
  language: string;
  includeOnline?: boolean;
}): Promise<DictionaryLookupResult> {
  const normalizedTerm = normalizeLookupTerm(term);
  const normalizedLanguage = language.trim().toLowerCase() || "en";

  if (!normalizedTerm) {
    throw new Error("请先选中一个词或短语。");
  }

  if (normalizedLanguage.startsWith("zh")) {
    const entries = await lookupChineseDictionary(normalizedTerm);
    return {
      term, normalizedTerm, language: normalizedLanguage,
      source: "cc-cedict",
      phonetic: entries.map((entry) => entry.pinyin).filter((value, index, values) => values.indexOf(value) === index).join(" / "),
      definitions: entries.flatMap((entry) => entry.meanings.map((definition) => ({
        partOfSpeech: "", definition, synonyms: [],
      }))),
      externalLinks: [
        { label: "CC-CEDICT · CC BY-SA 4.0 · MDBG", url: "https://www.mdbg.net/chinese/dictionary?page=cedict" },
        ...buildExternalDictionaryLinks(normalizedTerm, normalizedLanguage),
      ],
    };
  }

  if (isEnglish(normalizedLanguage)) {
    const [local, online] = await Promise.allSettled([
      lookupEnglishDictionary(normalizedTerm),
      includeOnline ? lookupFreeDictionary(normalizedTerm) : Promise.resolve(null),
    ]);
    const entry = local.status === "fulfilled" ? local.value : undefined;
    const freeDictionary = online.status === "fulfilled" ? online.value : null;
    if (entry || freeDictionary?.definitions.length) {
      const definitions = freeDictionary?.definitions.length ? freeDictionary.definitions : entry?.definition
        ? [{ partOfSpeech: entry.partOfSpeech || "", definition: entry.definition, synonyms: [] }] : [];
      return {
        term, normalizedTerm: entry?.word || freeDictionary?.normalizedTerm || normalizedTerm,
        language: normalizedLanguage,
        source: entry ? "ecdict" as const : "free-dictionary-api" as const,
        phonetic: freeDictionary?.phonetic || entry?.phonetic,
        audioUrl: freeDictionary?.audioUrl,
        definitions,
        chineseDefinitions: entry?.translation ? [entry.translation] : [],
        notices: [
          ...(local.status === "rejected" ? ["内置双语词库加载失败，可重试或查询在线词典。"] : []),
          ...(includeOnline && !freeDictionary?.definitions.length ? ["在线词典暂未返回释义或录音，内置词典结果仍可使用。"] : []),
        ],
        externalLinks: [
          ...(entry ? [{ label: "ECDICT · MIT", url: "https://github.com/skywind3000/ECDICT" }] : []),
          ...(freeDictionary?.definitions.length ? [{ label: "Free Dictionary API", url: "https://dictionaryapi.dev/" }] : []),
          ...buildExternalDictionaryLinks(normalizedTerm, normalizedLanguage),
        ],
      };
    }
    return { ...emptyDictionaryResult(normalizedTerm, "ecdict"), language: normalizedLanguage,
      externalLinks: buildExternalDictionaryLinks(normalizedTerm, normalizedLanguage),
      notices: local.status === "rejected" ? ["内置双语词库加载失败，可重试或查询在线词典。"] : [] };
  }

  const wiktionary = await lookupWiktionary(normalizedTerm);

  return {
    term,
    normalizedTerm,
    language: normalizedLanguage,
    source: wiktionary.wiktionaryExtract ? "wiktionary" : "external-links",
    definitions: wiktionary.wiktionaryExtract
      ? [
          {
            partOfSpeech: "Wiktionary",
            definition: wiktionary.wiktionaryExtract,
            synonyms: [],
          },
        ]
      : [],
    wiktionaryExtract: wiktionary.wiktionaryExtract,
    externalLinks: buildExternalDictionaryLinks(normalizedTerm, normalizedLanguage),
  };
}

export function dictionaryResultToVocabularyFields(result: DictionaryLookupResult) {
  const primaryDefinition = result.definitions[0];

  return {
    lemma: result.normalizedTerm,
    pronunciation: result.phonetic,
    partOfSpeech: primaryDefinition?.partOfSpeech || "unknown",
    meaningZh: (result.chineseDefinitions ?? []).join(" / "),
    meaningEn: result.definitions
      .slice(0, 3)
      .map((definition) => definition.definition)
      .filter(Boolean)
      .join(" / "),
    tags: [`dict:${result.source}`],
  };
}

function normalizeLookupTerm(term: string) {
  return term
    .replace(/\s+/g, " ")
    .replace(/^[^\p{L}\p{N}'-]+|[^\p{L}\p{N}'-]+$/gu, "")
    .trim();
}

async function lookupFreeDictionary(term: string): Promise<DictionaryLookupResult> {
  try {
    const response = await fetchWithTimeout(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(term)}`,
      {
        headers: {
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      return emptyDictionaryResult(term, "free-dictionary-api");
    }

    const entries = (await response.json()) as FreeDictionaryEntry[];
    const firstEntry = entries[0] ?? {};
    const definitions = entries.flatMap((entry) =>
      (entry.meanings ?? []).flatMap((meaning) =>
        (meaning.definitions ?? []).map((definition) => ({
          partOfSpeech: meaning.partOfSpeech || "unknown",
          definition: definition.definition || "",
          example: definition.example,
          synonyms: definition.synonyms ?? [],
        })),
      ),
    ).filter((definition) => definition.definition);
    const firstAudio = entries
      .flatMap((entry) => entry.phonetics ?? [])
      .find((phonetic) => phonetic.audio)?.audio;
    const firstPhonetic =
      firstEntry.phonetic ||
      entries.flatMap((entry) => entry.phonetics ?? []).find((phonetic) => phonetic.text)?.text;

    return {
      term,
      normalizedTerm: firstEntry.word || term,
      language: "en",
      source: "free-dictionary-api",
      phonetic: firstPhonetic,
      audioUrl: normalizeDictionaryAudioUrl(firstAudio),
      definitions: definitions.slice(0, 8),
      externalLinks: [],
    };
  } catch {
    return emptyDictionaryResult(term, "free-dictionary-api");
  }
}

async function lookupWiktionary(term: string) {
  try {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      origin: "*",
      prop: "extracts",
      explaintext: "1",
      exintro: "1",
      redirects: "1",
      titles: term,
    });
    const response = await fetchWithTimeout(`https://en.wiktionary.org/w/api.php?${params.toString()}`, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return {};
    }

    const data = (await response.json()) as WiktionaryResponse;
    const page = Object.values(data.query?.pages ?? {}).find((item) => !item.missing);
    const extract = page?.extract?.replace(/\n{3,}/g, "\n\n").trim();

    return {
      wiktionaryExtract: extract ? trimText(extract, 900) : undefined,
    };
  } catch {
    return {};
  }
}

function buildExternalDictionaryLinks(term: string, language: string) {
  const encoded = encodeURIComponent(term);
  const links = [
    {
      label: "Wiktionary",
      url: `https://en.wiktionary.org/wiki/${encoded}`,
    },
  ];

  if (language.startsWith("ja")) {
    links.push({ label: "Jisho", url: `https://jisho.org/search/${encoded}` });
  }

  if (language.startsWith("ko")) {
    links.push({ label: "Naver Dictionary", url: `https://en.dict.naver.com/#/search?query=${encoded}` });
  }

  if (language.startsWith("zh")) {
    links.push({ label: "MDBG", url: `https://www.mdbg.net/chinese/dictionary?page=worddict&wdrst=0&wdqb=${encoded}` });
  }

  return links;
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs = 8000,
) {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

function isEnglish(language: string) {
  return language === "en" || language.startsWith("en-");
}

function emptyDictionaryResult(
  term: string,
  source: DictionaryLookupResult["source"],
): DictionaryLookupResult {
  return {
    term,
    normalizedTerm: term,
    language: "en",
    source,
    definitions: [],
    externalLinks: [],
  };
}

function trimText(value: string, maxLength: number) {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength).trim()}...`;
}
export function normalizeDictionaryAudioUrl(value?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value.startsWith("//") ? `https:${value}` : value);
    return url.protocol === "https:" ? url.href : undefined;
  } catch { return undefined; }
}
