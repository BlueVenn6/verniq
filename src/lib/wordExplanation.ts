import { resolveTaskRuntimeConfig } from "@/src/lib/llm/config";
import { routeLlmChat } from "@/src/lib/llm/router";
import { checkAiSendPolicy, createAiSendPlan, UNTRUSTED_SOURCE_GUARD } from "@/src/lib/llm/sendPlan";
import type { ReaderTextSelection } from "@/src/lib/selectionAnalysis";
import type { WorkspaceState } from "@/src/lib/types";

export type BilingualWordExplanation = {
  meaningZh: string;
  meaningEn: string;
  contextZh: string;
  contextEn: string;
  exampleZh: string;
  exampleEn: string;
  providerName: string;
  modelId: string;
};

export async function explainWordBilingually({ selection, language, workspace, signal }: {
  selection: ReaderTextSelection;
  language: string;
  workspace: Pick<WorkspaceState, "aiProviders" | "aiModels" | "aiTaskRouting" | "aiPrivacySettings">;
  signal?: AbortSignal;
}) {
  if (selection.selectionType !== "word" || !selection.selectedText.trim()) throw new Error("请先选中一个词或短语。");
  if (signal?.aborted) throw new Error("已取消本次分析。");
  const runtime = await resolveTaskRuntimeConfig({ task: "languageAnalysis", capability: "analysis", ...workspace });
  if (!runtime.ok) throw new Error(runtime.error);
  const content = JSON.stringify({ language, word: selection.selectedText, sentence: selection.containingSentence.slice(0, 2400) });
  const sendPlan = createAiSendPlan({ task: "languageAnalysis", provider: runtime.provider, model: runtime.model,
    contentScope: "current_segment_only", contentText: content, includesFullMaterial: false,
    includesSensitiveContent: false, privacySettings: workspace.aiPrivacySettings });
  const policy = checkAiSendPolicy(sendPlan, workspace.aiPrivacySettings);
  if (!policy.allowed) throw new Error(policy.reason || "当前设置只允许使用本地模型。");
  const response = await routeLlmChat({ ...runtime.request, signal, temperature: 0.2, maxTokens: 900,
    systemPrompt: [
      "You are a bilingual Chinese-English vocabulary tutor. Explain the selected word in its sentence, not the whole article.",
      UNTRUSTED_SOURCE_GUARD,
      "Return JSON only. All six fields must be nonempty strings: meaningZh, meaningEn, contextZh, contextEn, exampleZh, exampleEn.",
      "Every *Zh field must be in Simplified Chinese; every *En field must be in English, regardless of the interface or learning language.",
      "Give a concise definition, explain the sense and grammar in this exact context, and give one natural parallel example in both languages.",
      "If context is insufficient, say so in both context fields. Do not claim your generated explanation is a dictionary quotation or invent audio or IPA.",
    ].join("\n"), messages: [{ role: "user", content }] });
  if (signal?.aborted) throw new Error("已取消本次分析。");
  const start = response.text.indexOf("{"), end = response.text.lastIndexOf("}");
  let value: unknown;
  try { value = JSON.parse(response.text.slice(start, end + 1)); } catch { throw new Error("AI 未返回完整的中英双语释义，请重试。"); }
  const keys = ["meaningZh", "meaningEn", "contextZh", "contextEn", "exampleZh", "exampleEn"] as const;
  if (!value || typeof value !== "object" || keys.some((key) => typeof (value as Record<string, unknown>)[key] !== "string" || !(value as Record<string, string>)[key].trim())) {
    throw new Error("AI 未返回完整的中英双语释义，请重试。");
  }
  const fields = Object.fromEntries(keys.map((key) => [key, (value as Record<string, string>)[key].trim()])) as Pick<BilingualWordExplanation, typeof keys[number]>;
  return { ...fields, providerName: runtime.provider.displayName ?? runtime.provider.name, modelId: runtime.model.modelId.trim() };
}
