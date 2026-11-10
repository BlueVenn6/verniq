import type { FeynmanDraftInput } from "@/src/lib/feynman";

const prefix = "verniq:feynman-draft:";
const fields = ["mainIdea", "ownWordsExplanation", "personalConnection", "questions", "nextSteps"] as const;

export function readFeynmanDraft(key: string, savedAt?: string): FeynmanDraftInput | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = JSON.parse(window.localStorage.getItem(prefix + key) ?? "null") as { draft?: unknown; editedAt?: unknown } | null;
    if (!cached || typeof cached.editedAt !== "string" || !Number.isFinite(Date.parse(cached.editedAt))) return null;
    if (savedAt && Date.parse(savedAt) >= Date.parse(cached.editedAt)) return null;
    const value = cached.draft;
    if (!value || typeof value !== "object" || !fields.every((field) => typeof (value as Record<string, unknown>)[field] === "string")) return null;
    return value as FeynmanDraftInput;
  } catch { return null; }
}

export function writeFeynmanDraft(key: string, draft: FeynmanDraftInput): boolean {
  try {
    window.localStorage.setItem(prefix + key, JSON.stringify({ draft, editedAt: new Date().toISOString() }));
    return true;
  } catch { return false; }
}
