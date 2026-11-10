import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_AI_MODELS,
  DEFAULT_AI_PRIVACY_SETTINGS,
  DEFAULT_AI_PROVIDERS,
  DEFAULT_AI_TASK_ROUTING,
} from "@/src/lib/aiConfig";
import { analyzeLearningSegmentForLanguageLearning, analyzeSourceMaterialForLanguageLearning } from "@/src/lib/languageAnalysis";
import { resolveTaskRuntimeConfig } from "@/src/lib/llm/config";
import { routeLlmChat } from "@/src/lib/llm/router";
import { buildLanguageAnalysisSystemPrompt } from "@/src/lib/languageAnalysis";
import { translateUiText } from "@/src/lib/copy/en";
import type { LearningSegment, SourceMaterial } from "@/src/lib/types";

vi.mock("@/src/lib/llm/config", () => ({ resolveTaskRuntimeConfig: vi.fn() }));
vi.mock("@/src/lib/llm/router", () => ({ routeLlmChat: vi.fn() }));

const source: SourceMaterial = {
  id: "source", goalId: "", title: "Short article", sourceType: "text", language: "en",
  originalContent: "First paragraph.\n\nSecond paragraph.",
  cleanedContent: "First paragraph.\n\nSecond paragraph.", metadata: {},
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
};
const segments: LearningSegment[] = ["First paragraph.", "Second paragraph."].map((text, index) => ({
  id: `segment-${index}`, sourceMaterialId: source.id, index, text,
  startOffset: 0, endOffset: text.length, createdAt: source.createdAt,
}));
const context = {
  sourceMaterial: source, learningSegments: segments, targetLanguage: "en", nativeLanguage: "zh",
  aiProviders: DEFAULT_AI_PROVIDERS, aiModels: DEFAULT_AI_MODELS, aiTaskRouting: DEFAULT_AI_TASK_ROUTING,
  aiPrivacySettings: { ...DEFAULT_AI_PRIVACY_SETTINGS, allowRemoteAi: true, onlyUseLocalModels: false, allowFullMaterialToRemote: false },
};

describe("language analysis privacy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveTaskRuntimeConfig).mockResolvedValue({
      ok: true, provider: { ...DEFAULT_AI_PROVIDERS[0], isLocal: false, isRemote: true },
      model: DEFAULT_AI_MODELS[0], request: {} as never, modelLabel: "test model",
    });
    vi.mocked(routeLlmChat).mockResolvedValue({ text: "{}" } as never);
  });

  it("blocks whole-material analysis even when the article is split into segments", async () => {
    const result = await analyzeSourceMaterialForLanguageLearning(context);

    expect(result.ok).toBe(false);
    expect(result.sendPlan).toMatchObject({ includesFullMaterial: true, contentScope: "source_material_full_or_truncated" });
    expect(routeLlmChat).not.toHaveBeenCalled();
  });

  it("still permits explicitly requested single-segment analysis", async () => {
    const result = await analyzeLearningSegmentForLanguageLearning({ ...context, segment: segments[0] });

    expect(result.sendPlan).toMatchObject({ includesFullMaterial: false, contentScope: "current_segment_only" });
    expect(routeLlmChat).toHaveBeenCalledOnce();
  });
  it("extracts real highlights beyond the first twelve paragraphs", async () => {
    vi.mocked(routeLlmChat).mockResolvedValueOnce({ text: JSON.stringify({ articleOverview: { summaryZh: "文章主旨", summaryInTargetLanguage: "Main idea", keyIdeas: ["关键观点"] } }) } as never);
    const manySegments = Array.from({ length: 15 }, (_, index) => ({ ...segments[0], id: `p-${index}`, index, text: `Paragraph ${index}.` }));
    const result = await analyzeSourceMaterialForLanguageLearning({ ...context, learningSegments: manySegments,
      aiPrivacySettings: { ...context.aiPrivacySettings, allowFullMaterialToRemote: true } });
    expect(result.ok).toBe(true);
    expect(result.analysis.articleOverview.keyIdeas).toEqual(["关键观点"]);
    expect(vi.mocked(routeLlmChat).mock.calls[0][0].messages?.[0].content).toContain("Paragraph 14.");
  });
  it("rejects an empty response instead of substituting an excerpt as an AI summary", async () => {
    const result = await analyzeSourceMaterialForLanguageLearning({ ...context,
      aiPrivacySettings: { ...context.aiPrivacySettings, allowFullMaterialToRemote: true } });
    expect(result.ok).toBe(false);
    expect(result.analysis.status).toBe("failed");
  });
  it.each(["Here is a summary, but not JSON.", "{\"articleOverview\": broken}"])("rejects malformed model output with translated recovery guidance: %s", async text => {
    vi.mocked(routeLlmChat).mockResolvedValueOnce({ text } as never);
    const result = await analyzeSourceMaterialForLanguageLearning({ ...context, allowRemoteMaterial: true });
    expect(result.ok).toBe(false);
    expect(result.analysis.status).toBe("failed");
    expect(result.error).toContain("原有分析已保留");
    expect(translateUiText(result.error!)).not.toMatch(/[\u3400-\u9fff]/);
    expect(routeLlmChat).toHaveBeenCalledOnce();
  });
  it("keeps saved vocabulary bilingual while allowing an English article overview", () => {
    const prompt = buildLanguageAnalysisSystemPrompt();
    expect(prompt).toContain("articleOverview.summaryZh field uses the selected explanation language");
    expect(prompt).toContain("meaningZh/explanationZh must be Chinese");
    expect(prompt).toContain("meaningEn/explanationEn must be English");
    expect(prompt).not.toContain("not necessarily Chinese");
  });
  it("permits one confirmed request without changing global material permissions, and reports the actual excerpt size", async () => {
    vi.mocked(routeLlmChat).mockResolvedValueOnce({ text: JSON.stringify({ articleOverview: { summaryZh: "主旨", keyIdeas: ["观点"] } }) } as never);
    const confirmSend = vi.fn(() => true);
    const result = await analyzeSourceMaterialForLanguageLearning({ ...context, learningSegments: [], sourceMaterial: { ...source, cleanedContent: "a".repeat(25000) }, allowRemoteMaterial: true, confirmSend });
    expect(result.ok).toBe(true); expect(result.sendPlan?.estimatedContentLength).toBe(12000);
    expect(confirmSend).toHaveBeenCalledOnce(); expect(context.aiPrivacySettings.allowFullMaterialToRemote).toBe(false);
    const prompt = vi.mocked(routeLlmChat).mock.calls[0][0].messages[0].content;
    expect(prompt).toContain("a".repeat(12000)); expect(prompt).not.toContain("a".repeat(12001));
  });
  it("does not send a material analysis after the user cancels confirmation", async () => {
    const result = await analyzeSourceMaterialForLanguageLearning({ ...context, allowRemoteMaterial: true, confirmSend: () => false });
    expect(result.ok).toBe(false); expect(routeLlmChat).not.toHaveBeenCalled();
  });
});
