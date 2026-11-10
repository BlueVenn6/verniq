import { afterEach, expect, it, vi } from "vitest";
import { readFeynmanDraft, writeFeynmanDraft } from "@/src/lib/feynmanDraftStorage";

afterEach(() => vi.unstubAllGlobals());

it("recovers unsaved edits independently by source and session and rejects malformed drafts", () => {
  const data = new Map<string, string>();
  vi.stubGlobal("window", { localStorage: { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) } });
  const draft = { mainIdea: "My own idea", ownWordsExplanation: "Unfinished", personalConnection: "", questions: "", nextSteps: "" };
  expect(writeFeynmanDraft("article-1:session-1", draft)).toBe(true);
  expect(readFeynmanDraft("article-1:session-1")).toEqual(draft);
  expect(readFeynmanDraft("article-2:session-2")).toBeNull();
  data.set("verniq:feynman-draft:broken", "{bad JSON");
  expect(readFeynmanDraft("broken")).toBeNull();
  expect(readFeynmanDraft("article-1:session-1", "2099-01-01T00:00:00.000Z")).toBeNull();
});

it("reports unavailable browser storage without claiming a draft was saved", () => {
  vi.stubGlobal("window", { localStorage: { setItem: () => { throw new Error("Quota exceeded"); } } });
  expect(writeFeynmanDraft("id", { mainIdea: "", ownWordsExplanation: "", personalConnection: "", questions: "", nextSteps: "" })).toBe(false);
});
