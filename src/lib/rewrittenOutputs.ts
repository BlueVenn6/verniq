import type { RewrittenOutputEntry, RewrittenOutputs } from "@/src/lib/types";

export type RewrittenDraftKey =
  | "wordpressEnDraft"
  | "mediumEnDraft"
  | "substackEnDraft"
  | "xThreadDraft"
  | "linkedInDraft"
  | "youtubeDraft";

const LEGACY_KEY_MAP: Record<RewrittenDraftKey, keyof RewrittenOutputs> = {
  wordpressEnDraft: "wordpressEn",
  mediumEnDraft: "mediumEn",
  substackEnDraft: "substackEn",
  xThreadDraft: "xThreadEn",
  linkedInDraft: "linkedInEn",
  youtubeDraft: "youtubeShortsEn",
};

export function normalizeRewrittenOutputs(
  outputs: RewrittenOutputs | undefined,
): RewrittenOutputs | undefined {
  if (!outputs) {
    return undefined;
  }

  return {
    ...outputs,
    wordpressEnDraft: outputs.wordpressEnDraft ?? outputs.wordpressEn,
    mediumEnDraft: outputs.mediumEnDraft ?? outputs.mediumEn,
    substackEnDraft: outputs.substackEnDraft ?? outputs.substackEn,
    xThreadDraft: outputs.xThreadDraft ?? outputs.xThreadEn,
    linkedInDraft: outputs.linkedInDraft ?? outputs.linkedInEn,
    youtubeDraft: outputs.youtubeDraft ?? outputs.youtubeShortsEn,
  };
}

export function getRewrittenDraftEntry(
  outputs: RewrittenOutputs | undefined,
  key: RewrittenDraftKey,
): RewrittenOutputEntry | undefined {
  const normalized = normalizeRewrittenOutputs(outputs);

  return normalized?.[key] ?? normalized?.[LEGACY_KEY_MAP[key]];
}

export function getPrimaryEnglishDraft(outputs: RewrittenOutputs | undefined) {
  return (
    getRewrittenDraftEntry(outputs, "wordpressEnDraft") ??
    getRewrittenDraftEntry(outputs, "mediumEnDraft") ??
    getRewrittenDraftEntry(outputs, "substackEnDraft") ??
    getRewrittenDraftEntry(outputs, "linkedInDraft") ??
    getRewrittenDraftEntry(outputs, "xThreadDraft") ??
    getRewrittenDraftEntry(outputs, "youtubeDraft")
  );
}
