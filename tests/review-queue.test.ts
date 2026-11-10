import { describe, expect, it } from "vitest";
import { buildReviewQueue } from "@/src/components/review/ReviewLocalSummary";
import { createDefaultWorkspaceState } from "@/src/lib/workspace/core";
import type { VocabularyItem } from "@/src/lib/types";

describe("review queue", () => {
  it("counts and retains all due items beyond the first page", () => {
    const workspace = createDefaultWorkspaceState();
    const item: VocabularyItem = {
      id: "", text: "word", lemma: "word", language: "en", partOfSpeech: "noun",
      meaningZh: "词", meaningEn: "word", sourceMaterialId: "source", segmentId: "segment",
      sentence: "A word.", status: "learning", stage: 0, tags: [],
      createdAt: "2020-01-01T00:00:00.000Z", updatedAt: "2020-01-01T00:00:00.000Z",
    };
    workspace.vocabularyItems = Array.from({ length: 25 }, (_, index) => ({ ...item, id: String(index) }));

    const queue = buildReviewQueue(workspace);
    expect(queue).toHaveLength(25);
    expect(queue.filter((entry) => entry.isDue)).toHaveLength(25);
  });
});
