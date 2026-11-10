import type { LearningSegment } from "@/src/lib/types";

export type ReaderSelectionType = "word" | "phrase" | "sentence" | "paragraph" | "invalid";

export type ReaderTextSelection = {
  selectedText: string;
  segmentId: string;
  segmentIndex: number;
  selectionType: ReaderSelectionType;
  containingSentence: string;
  previousSentence: string;
  nextSentence: string;
  isCompleteSentence: boolean;
};

const WORD_PATTERN = /^[A-Za-z]+(?:[’'-][A-Za-z]+)*$/;
const SENTENCE_END_PATTERN = /[.!?。！？][”"')\]」』]*\s*$/;
const MEANINGFUL_CHARACTER_PATTERN = /[\p{L}\p{N}]/u;

export function createReaderTextSelection({
  selectedText,
  segment,
  segments,
}: {
  selectedText: string;
  segment: LearningSegment;
  segments: LearningSegment[];
}): ReaderTextSelection {
  const normalizedSelection = normalizeSelectionText(selectedText);
  const orderedSegments = [...segments].sort((left, right) => left.index - right.index);
  const segmentSentences = splitIntoSentences(segment.text);
  const sentenceIndex = findContainingSentenceIndex(normalizedSelection, segmentSentences);
  const containingSentence =
    sentenceIndex >= 0
      ? segmentSentences[sentenceIndex]
      : normalizedSelection;
  const previousSentence = getAdjacentSentence(
    orderedSegments,
    segment.id,
    segmentSentences,
    sentenceIndex,
    "previous",
  );
  const nextSentence = getAdjacentSentence(
    orderedSegments,
    segment.id,
    segmentSentences,
    sentenceIndex,
    "next",
  );
  const isCompleteSentence = isCompleteSentenceSelection(
    normalizedSelection,
    containingSentence,
  );

  return {
    selectedText: normalizedSelection,
    segmentId: segment.id,
    segmentIndex: segment.index,
    selectionType: classifyReaderSelection({
      selectedText: normalizedSelection,
      containingSentence,
      isCompleteSentence,
    }),
    containingSentence,
    previousSentence,
    nextSentence,
    isCompleteSentence,
  };
}

export function classifyReaderSelection({
  selectedText,
  containingSentence = "",
  isCompleteSentence = false,
}: {
  selectedText: string;
  containingSentence?: string;
  isCompleteSentence?: boolean;
}): ReaderSelectionType {
  const text = normalizeSelectionText(selectedText);

  if (!text || !MEANINGFUL_CHARACTER_PATTERN.test(text) || text.length > 2400) {
    return "invalid";
  }

  if (WORD_PATTERN.test(text) || isChineseWord(text)) {
    return "word";
  }

  const wordCount = getWordCount(text);
  const sentenceCount = splitIntoSentences(text).length;
  const containsSentenceEnding = SENTENCE_END_PATTERN.test(text);

  if (sentenceCount > 1 || wordCount > 48 || text.length > 520) {
    return "paragraph";
  }

  if (
    isCompleteSentence ||
    (containsSentenceEnding && (wordCount >= 4 || /\p{Script=Han}/u.test(text))) ||
    (wordCount >= 6 && normalizeSelectionText(containingSentence).length >= text.length)
  ) {
    return "sentence";
  }

  return "phrase";
}

export function splitIntoSentences(value: string): string[] {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return [];

  const matches = text.match(/[^.!?。！？]+(?:[.!?。！？]+[”"')\]」』]*|$)/g) ?? [];
  const sentences = matches
    .map((item) => item.trim())
    .filter((item) => MEANINGFUL_CHARACTER_PATTERN.test(item));

  return sentences.length ? sentences : [text];
}

export function normalizeSelectionText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function findContainingSentenceIndex(selection: string, sentences: string[]) {
  if (!selection || !sentences.length) return -1;

  const normalizedSelection = normalizeForComparison(selection);
  const directIndex = sentences.findIndex((sentence) =>
    normalizeForComparison(sentence).includes(normalizedSelection),
  );

  if (directIndex >= 0) return directIndex;

  const selectionWords = new Set(getComparableWords(selection));
  let bestIndex = -1;
  let bestScore = 0;

  sentences.forEach((sentence, index) => {
    const words = getComparableWords(sentence);
    const score = words.filter((word) => selectionWords.has(word)).length;
    if (score > bestScore) {
      bestIndex = index;
      bestScore = score;
    }
  });

  return bestScore > 0 ? bestIndex : -1;
}

function getAdjacentSentence(
  segments: LearningSegment[],
  segmentId: string,
  sentences: string[],
  sentenceIndex: number,
  direction: "previous" | "next",
) {
  if (sentenceIndex >= 0) {
    const adjacentIndex = direction === "previous" ? sentenceIndex - 1 : sentenceIndex + 1;
    if (sentences[adjacentIndex]) return sentences[adjacentIndex];
  }

  const currentSegmentIndex = segments.findIndex((segment) => segment.id === segmentId);
  if (currentSegmentIndex < 0) return "";

  const adjacentSegment =
    direction === "previous"
      ? segments[currentSegmentIndex - 1]
      : segments[currentSegmentIndex + 1];
  const adjacentSentences = adjacentSegment ? splitIntoSentences(adjacentSegment.text) : [];

  return direction === "previous"
    ? adjacentSentences.at(-1) ?? ""
    : adjacentSentences[0] ?? "";
}

function isCompleteSentenceSelection(selection: string, containingSentence: string) {
  if (!selection || !containingSentence) return false;

  return (
    normalizeForComparison(selection) === normalizeForComparison(containingSentence) ||
    (SENTENCE_END_PATTERN.test(selection) && getWordCount(selection) >= 4)
  );
}

function normalizeForComparison(value: string) {
  return normalizeSelectionText(value).toLocaleLowerCase();
}

function getComparableWords(value: string) {
  return normalizeForComparison(value).match(/[a-z]+(?:[’'-][a-z]+)*/g) ?? [];
}

function getWordCount(value: string) {
  return getComparableWords(value).length;
}

function isChineseWord(text: string) {
  if (!/^\p{Script=Han}+$/u.test(text)) return false;
  // Use Unicode word segmentation rather than guessing words from character count.
  const words = [...new Intl.Segmenter("zh", { granularity: "word" }).segment(text)]
    .filter((part) => part.isWordLike);
  return words.length === 1;
}
