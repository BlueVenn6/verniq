import { describe, expect, it } from "vitest";
import { classifyReaderSelection, splitIntoSentences, createReaderTextSelection } from "@/src/lib/selectionAnalysis";
import { learningModeSettings, normalizeSupportedLanguageSettings } from "@/src/lib/languageSettings";
import type { LearningSegment } from "@/src/lib/types";

describe("Chinese learning", () => {
  it("keeps the Chinese target and English interface after loading settings", () => {
    expect(normalizeSupportedLanguageSettings(learningModeSettings("zh"))).toEqual({
      uiLanguage: "en", targetLanguage: "zh", explanationLanguage: "en",
    });
  });
  it("accepts Chinese words and splits Chinese punctuation into sentences", () => {
    expect(classifyReaderSelection({ selectedText: "学习" })).toBe("word");
    expect(classifyReaderSelection({ selectedText: "把书放在桌子上。" })).toBe("sentence");
    expect(splitIntoSentences("他喜欢阅读。你呢？我也喜欢！")).toEqual(["他喜欢阅读。", "你呢？", "我也喜欢！"]);
  });
  it("preserves the Chinese sentence and adjacent context for word lookup", () => {
    const segment = { id: "c", index: 0, text: "我在学习中文。每天读一点。" } as LearningSegment;
    const selection = createReaderTextSelection({ selectedText: "学习", segment, segments: [segment] });
    expect(selection.selectionType).toBe("word");
    expect(selection.containingSentence).toBe("我在学习中文。");
    expect(selection.nextSentence).toBe("每天读一点。");
  });
});
