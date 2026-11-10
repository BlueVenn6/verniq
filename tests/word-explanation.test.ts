import { beforeEach, expect, it, vi } from "vitest";
import { createDefaultWorkspaceState } from "@/src/lib/workspace/core";
import { explainWordBilingually } from "@/src/lib/wordExplanation";
import { resolveTaskRuntimeConfig } from "@/src/lib/llm/config";
import { routeLlmChat } from "@/src/lib/llm/router";
import { pronunciationVoice } from "@/src/components/reader/PronunciationControl";
import type { ReaderTextSelection } from "@/src/lib/selectionAnalysis";
import { translateUiText } from "@/src/lib/copy/en";
vi.mock("@/src/lib/llm/config", () => ({ resolveTaskRuntimeConfig: vi.fn() }));
vi.mock("@/src/lib/llm/router", () => ({ routeLlmChat: vi.fn() }));
const selection: ReaderTextSelection = { selectedText: "learn", selectionType: "word", segmentId: "p", segmentIndex: 0,
  containingSentence: "We learn English every day.", previousSentence: "PRIVATE PREVIOUS SENTENCE", nextSentence: "PRIVATE NEXT SENTENCE", isCompleteSentence: false };
const meanings = { meaningZh: "学习", meaningEn: "To acquire knowledge.", contextZh: "在这里表示学习英语。", contextEn: "Here it means studying English.", exampleZh: "我学习中文。", exampleEn: "I learn Chinese." };
const workspace = createDefaultWorkspaceState();
workspace.aiPrivacySettings = { ...workspace.aiPrivacySettings, allowRemoteAi: true, onlyUseLocalModels: false, allowFullMaterialToRemote: false };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(resolveTaskRuntimeConfig).mockResolvedValue({ ok: true, provider: { ...workspace.aiProviders[0], isLocal: false, isRemote: true }, model: { ...workspace.aiModels[0], modelId: "chosen-model" }, request: {} as never, modelLabel: "Chosen model" });
  vi.mocked(routeLlmChat).mockResolvedValue({ text: JSON.stringify(meanings) } as never);
});
it("requests both languages using only the selected word and containing sentence", async () => {
  const result = await explainWordBilingually({ selection, language: "en", workspace });
  expect(result).toMatchObject({ ...meanings, modelId: "chosen-model" });
  const request = vi.mocked(routeLlmChat).mock.calls[0][0];
  expect(request.messages?.[0].content).toContain(selection.containingSentence);
  expect(request.messages?.[0].content).not.toContain("PRIVATE");
  expect(request.systemPrompt).toContain("every *En field must be in English");
  expect(request.systemPrompt).toContain("untrusted");
});
it("honors local-only and AI-disabled privacy settings without issuing an AI request", async () => {
  await expect(explainWordBilingually({ selection, language: "en", workspace: { ...workspace, aiPrivacySettings: { ...workspace.aiPrivacySettings, onlyUseLocalModels: true } } })).rejects.toThrow();
  expect(routeLlmChat).not.toHaveBeenCalled();
});
it("rejects incomplete and invalid AI output instead of displaying a successful bilingual result", async () => {
  vi.mocked(routeLlmChat).mockResolvedValueOnce({ text: '{"meaningEn":"Only English"}' } as never);
  await expect(explainWordBilingually({ selection, language: "en", workspace })).rejects.toThrow("完整");
  vi.mocked(routeLlmChat).mockResolvedValueOnce({ text: "not JSON" } as never);
  await expect(explainWordBilingually({ selection, language: "en", workspace })).rejects.toThrow("完整");
});
it("does not accept a response after the user cancels or changes selection", async () => {
  const controller = new AbortController();
  vi.mocked(routeLlmChat).mockImplementationOnce(async () => { controller.abort(); return { text: JSON.stringify(meanings) } as never; });
  await expect(explainWordBilingually({ selection, language: "en", workspace, signal: controller.signal })).rejects.toThrow("取消");
});
it("selects a matching language voice and never substitutes an unrelated voice", () => {
  const voices = [{ lang: "zh-CN" }, { lang: "en-GB" }, { lang: "en-US" }] as SpeechSynthesisVoice[];
  expect(pronunciationVoice(voices, "en-US")).toBe(voices[2]);
  expect(pronunciationVoice(voices, "en")).toBe(voices[1]);
  expect(pronunciationVoice([voices[0]], "en")).toBeUndefined();
  expect(translateUiText("语言分析任务尚未选择模型，请在设置中配置。")).not.toMatch(/[\u3400-\u9fff]/);
});
