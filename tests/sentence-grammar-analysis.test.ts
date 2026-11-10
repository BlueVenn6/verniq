import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_AI_LOCAL_PROVIDER_ID,
  DEFAULT_AI_MODELS,
  DEFAULT_AI_PROVIDERS,
  DEFAULT_AI_TASK_ROUTING,
} from "@/src/lib/aiConfig";
import {
  analyzeReaderSelectionForLanguageLearning,
  buildSelectionAnalysisPrompt,
} from "@/src/lib/sentenceGrammarAnalysis";
import {
  classifyReaderSelection,
  createReaderTextSelection,
  splitIntoSentences,
  type ReaderTextSelection,
} from "@/src/lib/selectionAnalysis";
import {
  prepareExpressionAnalysisSave,
  prepareGrammarAnalysisSave,
} from "@/src/lib/readerSelectionRecords";
import type { SentenceGrammarAnalysisResult } from "@/src/lib/sentenceGrammarAnalysis";
import type {
  AiModelConfig,
  AiProviderConfig,
  AiTaskRouting,
  LearningSegment,
  SourceMaterial,
  ReadingSession,
} from "@/src/lib/types";

const routeLlmChatMock = vi.hoisted(() => vi.fn());

vi.mock("@/src/lib/llm/router", () => ({
  routeLlmChat: routeLlmChatMock,
}));

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function localProvider(): AiProviderConfig {
  return {
    ...clone(DEFAULT_AI_PROVIDERS.find((provider) => provider.id === DEFAULT_AI_LOCAL_PROVIDER_ID)!),
    enabled: true,
    authMode: "none",
    baseUrl: "http://localhost:1234/v1",
  };
}

function analysisModel(): AiModelConfig {
  return {
    ...clone(DEFAULT_AI_MODELS.find((model) => model.providerId === DEFAULT_AI_LOCAL_PROVIDER_ID)!),
    id: "reader-analysis-model",
    providerId: DEFAULT_AI_LOCAL_PROVIDER_ID,
    displayName: "Reader analysis display name",
    modelName: "Reader analysis display name",
    modelId: "relay-exact-grammar-model",
    enabled: true,
    supportsText: true,
    capabilities: ["analysis", "rewrite"],
  };
}

function routing(modelId = "reader-analysis-model"): AiTaskRouting {
  return {
    ...clone(DEFAULT_AI_TASK_ROUTING),
    languageAnalysis: {
      providerId: DEFAULT_AI_LOCAL_PROVIDER_ID,
      modelId,
      enabled: true,
      contentPolicy: "current_segment_only",
    },
    phraseAnalysis: undefined,
    sentenceGrammarAnalysis: {
      providerId: DEFAULT_AI_LOCAL_PROVIDER_ID,
      modelId,
      enabled: true,
      contentPolicy: "current_segment_only",
    },
  };
}

const segments: LearningSegment[] = [
  { id: "segment-1", sourceMaterialId: "source-1", index: 0, startOffset: 0, endOffset: 98, text: "The policy was revised after the team reviewed the evidence. It now applies to every regional office.", createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "segment-2", sourceMaterialId: "source-1", index: 1, startOffset: 99, endOffset: 155, text: "This change may affect how managers report progress.", createdAt: "2026-01-01T00:00:00.000Z" },
];

function sentenceSelection(): ReaderTextSelection {
  return createReaderTextSelection({
    selectedText: "The policy was revised after the team reviewed the evidence.",
    segment: segments[0],
    segments,
  });
}

const source = {
  id: "source-1",
  title: "Policy update",
  language: "en",
} as SourceMaterial;

const session: ReadingSession = {
  id: "session-1",
  sourceMaterialId: "source-1",
  goalId: "",
  startedAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  progress: 0,
  currentSegmentIndex: 0,
  savedVocabularyIds: [],
  savedExpressionIds: [],
  notes: "",
};

function analysisResult(): SentenceGrammarAnalysisResult {
  return {
    kind: "sentence",
    selectedText: sentenceSelection().selectedText,
    containingSentence: sentenceSelection().containingSentence,
    overallMeaning: "政策在审阅证据后被修改。",
    sentenceCore: [],
    structureBreakdown: [{ label: "主句", text: "The policy was revised", explanation: "被动语态。" }],
    grammarPoints: [{ title: "被动语态", explanation: "强调结果。" }],
    fixedExpressions: [{ text: "review the evidence", type: "collocation", meaning: "审阅证据", roleInContext: "说明前置动作", usageNote: "正式语境", example: "They reviewed the evidence.", recommendedForSaving: true }],
    pitfalls: [],
    simplifiedRewrite: "The team reviewed the evidence and changed the policy.",
    similarExamples: [],
    ambiguityNotes: [],
    modelLabel: "Local · exact",
    providerName: "Local",
    modelId: "relay-exact-grammar-model",
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

beforeEach(() => {
  routeLlmChatMock.mockReset();
});

describe("reader selection classification", () => {
  it("classifies words, phrases, complete sentences, paragraphs, and invalid text", () => {
    expect(classifyReaderSelection({ selectedText: "revised" })).toBe("word");
    expect(classifyReaderSelection({ selectedText: "apply to" })).toBe("phrase");
    expect(classifyReaderSelection({ selectedText: "The policy was revised after the team reviewed the evidence." })).toBe("sentence");
    expect(classifyReaderSelection({ selectedText: "One sentence ends here. A second sentence follows." })).toBe("paragraph");
    expect(classifyReaderSelection({ selectedText: "…?!" })).toBe("invalid");
  });

  it("keeps complete sentence context and reads adjacent sentences across segments", () => {
    const selection = sentenceSelection();

    expect(selection.selectionType).toBe("sentence");
    expect(selection.containingSentence).toBe("The policy was revised after the team reviewed the evidence.");
    expect(selection.nextSentence).toBe("It now applies to every regional office.");
    expect(splitIntoSentences(segments[0].text)).toHaveLength(2);

    const lastSentence = createReaderTextSelection({
      selectedText: "It now applies to every regional office.",
      segment: segments[0],
      segments,
    });
    expect(lastSentence.nextSentence).toBe("This change may affect how managers report progress.");
  });

  it("marks clause-length partial selections as incomplete sentences", () => {
    const selection = createReaderTextSelection({
      selectedText: "after the team reviewed the evidence",
      segment: segments[0],
      segments,
    });

    expect(selection.selectionType).toBe("sentence");
    expect(selection.isCompleteSentence).toBe(false);
    expect(selection.containingSentence).toContain("The policy was revised");
  });
});

describe("sentence and phrase AI analysis", () => {
  it("uses the dedicated sentence route, sends the exact model ID, and includes local context", async () => {
    routeLlmChatMock.mockResolvedValue({
      text: JSON.stringify({
        overallMeaning: "政策在团队审阅证据后被修改。",
        sentenceCore: [{ role: "subject", text: "The policy", explanation: "动作的承受者。" }],
        structureBreakdown: [{ label: "主句", text: "The policy was revised", explanation: "使用被动语态。" }],
        grammarPoints: [{ title: "被动语态", explanation: "强调政策被修改这一结果。" }],
        fixedExpressions: [{ text: "review the evidence", type: "collocation", meaning: "审阅证据", roleInContext: "说明修改发生前的动作", usageNote: "常用于正式语境", example: "The panel reviewed the evidence.", recommendedForSaving: true }],
        pitfalls: ["不要把 after 误解为原因。"],
        simplifiedRewrite: "The team reviewed the evidence, and then they changed the policy.",
        similarExamples: ["The report was updated after the audit finished."],
        ambiguityNotes: [],
      }),
    });

    const result = await analyzeReaderSelectionForLanguageLearning({
      kind: "sentence",
      selection: sentenceSelection(),
      sourceMaterial: source,
      targetLanguage: "en",
      explanationLanguage: "zh-CN",
      aiProviders: [localProvider()],
      aiModels: [analysisModel()],
      aiTaskRouting: routing(),
    });

    expect(result.ok).toBe(true);
    expect(routeLlmChatMock).toHaveBeenCalledTimes(1);
    const request = routeLlmChatMock.mock.calls[0][0];
    expect(request.model).toBe("relay-exact-grammar-model");
    expect(request.model).not.toBe("Reader analysis display name");
    expect(request.messages[0].content).toContain("Explanation language: zh-CN");
    expect(request.messages[0].content).toContain("Previous sentence: Not available");
    if (result.ok) {
      expect(result.analysis.fixedExpressions[0].text).toBe("review the evidence");
      expect(result.analysis.modelId).toBe("relay-exact-grammar-model");
    }
  });

  it("falls back from an unconfigured phrase route to languageAnalysis without switching models", async () => {
    routeLlmChatMock.mockResolvedValue({
      text: JSON.stringify({
        overallMeaning: "适用于。",
        sentenceCore: [],
        structureBreakdown: [],
        grammarPoints: [],
        fixedExpressions: [],
        pitfalls: [],
        simplifiedRewrite: "apply to",
        similarExamples: [],
        ambiguityNotes: [],
      }),
    });
    const selection = createReaderTextSelection({ selectedText: "apply to", segment: segments[0], segments });
    const result = await analyzeReaderSelectionForLanguageLearning({
      kind: "phrase",
      selection,
      sourceMaterial: source,
      targetLanguage: "en",
      explanationLanguage: "zh-CN",
      aiProviders: [localProvider()],
      aiModels: [analysisModel()],
      aiTaskRouting: routing(),
    });

    expect(result.ok).toBe(true);
    expect(routeLlmChatMock.mock.calls[0][0].model).toBe("relay-exact-grammar-model");
  });

  it("keeps analysis as a read-only result until the reader explicitly saves an item", async () => {
    const prompt = buildSelectionAnalysisPrompt({
      kind: "sentence",
      selection: sentenceSelection(),
      sourceMaterial: source,
      targetLanguage: "en",
      explanationLanguage: "zh-CN",
      aiProviders: [],
      aiModels: [],
      aiTaskRouting: routing(),
    });

    expect(prompt).toContain("Selected text:");
    expect(prompt).toContain("Containing complete sentence:");
    expect(prompt).toContain("Next sentence:");
  });

  it("returns a clear error when a response is not parseable JSON", async () => {
    routeLlmChatMock.mockResolvedValue({ text: "not structured output" });

    const result = await analyzeReaderSelectionForLanguageLearning({
      kind: "sentence",
      selection: sentenceSelection(),
      sourceMaterial: source,
      targetLanguage: "en",
      explanationLanguage: "zh-CN",
      aiProviders: [localProvider()],
      aiModels: [analysisModel()],
      aiTaskRouting: routing(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("格式无法解析");
    }
  });

  it("does not send a request after the user cancels analysis", async () => {
    const controller = new AbortController();
    controller.abort();

    const result = await analyzeReaderSelectionForLanguageLearning({
      kind: "sentence",
      selection: sentenceSelection(),
      sourceMaterial: source,
      targetLanguage: "en",
      explanationLanguage: "zh-CN",
      aiProviders: [localProvider()],
      aiModels: [analysisModel()],
      aiTaskRouting: routing(),
      signal: controller.signal,
    });

    expect(result).toEqual({ ok: false, error: "已取消本次分析。" });
    expect(routeLlmChatMock).not.toHaveBeenCalled();
  });
});

describe("reader selection record saves", () => {
  it("saves an analyzed expression as an ExpressionItem only after an explicit save action", () => {
    const analysis = analysisResult();
    const saved = prepareExpressionAnalysisSave({
      workspace: { expressionItems: [], grammarNotes: [], readingSessions: [session] },
      source,
      session,
      selection: sentenceSelection(),
      expression: analysis.fixedExpressions[0],
      now: "2026-01-01T00:00:00.000Z",
    });

    expect(saved.expressionItems).toHaveLength(1);
    expect(saved.expressionItems[0]).toMatchObject({
      text: "review the evidence",
      type: "collocation",
      sentence: sentenceSelection().containingSentence,
    });
    expect(saved.readingSessions[0].savedExpressionIds).toContain(saved.expressionItems[0].id);
  });

  it("saves a grammar explanation as a GrammarNote without making an FSRS card", () => {
    const saved = prepareGrammarAnalysisSave({
      workspace: { expressionItems: [], grammarNotes: [], readingSessions: [session] },
      source,
      selection: sentenceSelection(),
      analysis: analysisResult(),
      now: "2026-01-01T00:00:00.000Z",
    });

    expect(saved.grammarNotes).toHaveLength(1);
    expect(saved.grammarNotes[0]).toMatchObject({
      title: "被动语态",
      sentence: sentenceSelection().containingSentence,
    });
    expect("srs" in saved.grammarNotes[0]).toBe(false);
  });
});
