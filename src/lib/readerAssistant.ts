import { resolveTaskRuntimeConfig } from "./llm/config";
import { routeLlmChat } from "./llm/router";
import { checkAiSendPolicy, createAiSendPlan, UNTRUSTED_SOURCE_GUARD } from "./llm/sendPlan";
import type { AiSendPlan, ReaderMessage, SourceMaterial, WorkspaceState } from "./types";

export async function askReaderAssistant({ workspace, source, question, note, selection, history, modelId, allowRemoteMaterial, confirmSend, signal }: {
  workspace: WorkspaceState; source: SourceMaterial; question: string; note: string; selection: string;
  history: ReaderMessage[]; modelId?: string; allowRemoteMaterial: boolean;
  confirmSend: (plan: AiSendPlan) => boolean; signal?: AbortSignal;
}) {
  if (!question.trim()) throw new Error("请先输入问题。");
  const model = workspace.aiModels.find(item => item.id === modelId);
  if (modelId && !model) throw new Error("所选模型已不存在，请重新选择。");
  const routing = model ? { ...workspace.aiTaskRouting, languageAnalysis: { providerId: model.providerId, modelId: model.id } } : workspace.aiTaskRouting;
  const runtime = await resolveTaskRuntimeConfig({ ...workspace, aiTaskRouting: routing, task: "languageAnalysis", capability: "analysis" });
  if (!runtime.ok) throw new Error(runtime.error);
  const material = source.cleanedContent || source.originalContent;
  const recent = history.filter(message => message.sourceMaterialId === source.id).slice(-8);
  const content = JSON.stringify({ material: { title: source.title, text: material.slice(0, 12000), truncated: material.length > 12000 }, note: note.slice(0, 6000), selection: selection.slice(0, 3000), question: question.slice(0, 3000) });
  const privacy = { ...workspace.aiPrivacySettings, allowFullMaterialToRemote: allowRemoteMaterial || workspace.aiPrivacySettings.allowFullMaterialToRemote };
  const plan = createAiSendPlan({ task: "languageAnalysis", provider: runtime.provider, model: runtime.model, contentScope: "source_material_full_or_truncated", contentText: content + recent.map(message => message.text.slice(0, 2000)).join("\n"), includesFullMaterial: true, includesSensitiveContent: false, privacySettings: privacy });
  const policy = checkAiSendPolicy(plan, privacy);
  if (!policy.allowed) throw new Error(policy.reason);
  if (plan.requiresUserConfirmation && !confirmSend(plan)) throw new Error("已取消本次分析。");
  if (signal?.aborted) throw new Error("已取消本次分析。");
  const result = await routeLlmChat({ ...runtime.request, signal, maxTokens: 2400,
    systemPrompt: ["You are a reading discussion partner. Answer the user's question using the supplied material, their own notes and the conversation. Distinguish the author's claims from the reader's reflection. Explain uncertainty and missing evidence; do not invent citations. Never overwrite the reader's note.", UNTRUSTED_SOURCE_GUARD,
      `Respond in ${workspace.languageSettings.explanationLanguage.startsWith("zh") ? "Simplified Chinese" : "English"}. Use concise, readable paragraphs. If material.truncated is true, make clear that your answer uses only the supplied opening portion.`].join("\n"),
    messages: [...recent.map(message => ({ role: message.role, content: message.text.slice(0, 2000) })), { role: "user", content }],
  });
  if (signal?.aborted) throw new Error("已取消本次分析。");
  if (!result.text.trim()) throw new Error("模型没有返回可读取的内容。");
  return { text: result.text.trim(), modelLabel: runtime.modelLabel };
}
