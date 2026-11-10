"use client";

import { useEffect, useRef, useState } from "react";
import { useLearningUi } from "@/src/components/LanguageProvider";
import { FullTextSelect } from "@/src/components/FullTextSelect";
import { composePublishDraft } from "@/src/lib/publish/publishAi";
import type { PublishSource } from "@/src/lib/publish/publishSources";
import type { WorkspaceState } from "@/src/lib/types";
import type { PublishDraftSettings } from "@/src/lib/publish/publishPresets";

export function PublishAiComposer({ workspace, sources, topic, currentDraft, getRevision, onApply, options, onOptionsChange, onTopicChange }: {
  workspace: WorkspaceState; sources: PublishSource[]; topic: string; currentDraft: string;
  getRevision: () => number; onApply: (markdown: string, expectedRevision: number) => void;
  onTopicChange: (topic: string) => void; options: PublishDraftSettings; onOptionsChange: (patch: Partial<PublishDraftSettings>) => void;
}) {
  const { t } = useLearningUi();
  const modelId = options.aiModelId || "", language = options.outputLanguage || (workspace.languageSettings.targetLanguage === "zh" ? "zh" : "en");
  const reflection = options.aiReflection || "", instruction = options.aiInstruction || "";
  const setModelId = (aiModelId: string) => onOptionsChange({ aiModelId });
  const setLanguage = (outputLanguage: string) => onOptionsChange({ outputLanguage });
  const setReflection = (aiReflection: string) => onOptionsChange({ aiReflection });
  const setInstruction = (aiInstruction: string) => onOptionsChange({ aiInstruction });
  const [allowRemoteSources, setAllowRemoteSources] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const models = workspace.aiModels.filter(model => model.enabled && model.supportsText !== false && workspace.aiProviders.some(provider => provider.id === model.providerId && provider.enabled && provider.adapterProtocol !== "openai_images"));
  const generate = async (revise: boolean) => {
    if (pending) return;
    const controller = new AbortController(); request.current = controller;
    const revision = getRevision();
    setPending(true); setError("");
    try {
      const result = await composePublishDraft({ workspace, sources, topic, reflection, instruction, currentDraft: revise ? currentDraft : undefined, modelId: modelId || undefined, outputLanguage: language, allowRemoteSources, signal: controller.signal,
        confirmSend: plan => window.confirm(`${t("将所选材料、个人思考及本次反馈发送给：")}${plan.providerName} · ${plan.modelName}\n${t("字符数：")}${plan.estimatedContentLength}`) });
      if (!controller.signal.aborted) onApply(result.markdown, revision);
    } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "AI 生成失败。"); }
    finally { if (!controller.signal.aborted) setPending(false); }
  };
  return <section className="space-y-4 rounded-xl border border-stone-200 bg-white p-5">
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">{t("创作与整理")}</p>
    <h2 className="text-xl font-semibold">{t("AI 综合创作")}</h2>
    <p className="text-sm leading-7 text-stone-600">{t("围绕主题综合多篇材料，保留材料编号和个人思考。生成后可在右侧编辑，也可填写反馈让 AI 修改。")}</p>
    <label className="block text-sm">{t("创作主题")}<input aria-label={t("创作主题")} value={topic} onChange={event => onTopicChange(event.target.value)} className="mt-2 w-full rounded-lg border border-stone-300 p-3" /></label>
    <label className="block text-sm">{t("创作模型")}<FullTextSelect aria-label={t("创作模型")} value={modelId} onChange={event => setModelId(event.target.value)} className="mt-2 w-full rounded-lg border border-stone-300 p-3">
      <option value="">{t("使用设置中的发布模型")}</option>
      {models.map(model => <option key={model.id} value={model.id}>{workspace.aiProviders.find(provider => provider.id === model.providerId)?.displayName} · {model.displayName || model.modelId} ({model.modelId})</option>)}
    </FullTextSelect></label>
    <label className="block text-sm">{t("输出语言")}<FullTextSelect aria-label={t("输出语言")} value={language} onChange={event => setLanguage(event.target.value)} className="mt-2 w-full rounded-lg border border-stone-300 p-3"><option value="en">English</option><option value="zh">{t("简体中文")}</option></FullTextSelect></label>
    <label className="block text-sm">{t("我的思考（Reflection）")}<textarea aria-label={t("我的思考（Reflection）")} value={reflection} onChange={event => setReflection(event.target.value)} rows={3} className="mt-2 w-full rounded-lg border border-stone-300 p-3" /></label>
    <label className="block text-sm">{t("写作要求或修改反馈")}<textarea aria-label={t("写作要求或修改反馈")} value={instruction} onChange={event => setInstruction(event.target.value)} rows={3} className="mt-2 w-full rounded-lg border border-stone-300 p-3" /></label>
    <label className="flex items-start gap-2 text-xs leading-6"><input type="checkbox" checked={allowRemoteSources} onChange={event => setAllowRemoteSources(event.target.checked)} className="mt-1" />{t("允许本次将所选材料正文发送给远程模型；本地模式仍遵循全局设置。")}</label>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={pending || !sources.length || !topic.trim()} onClick={() => void generate(false)} className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{pending ? t("AI 创作中…") : t("综合材料生成文章")}</button>
      <button type="button" disabled={pending || !currentDraft.trim() || !instruction.trim() || !topic.trim()} onClick={() => void generate(true)} className="rounded-lg border border-stone-300 px-4 py-2 text-sm disabled:opacity-40">{t("按反馈修改当前草稿")}</button>
      {pending ? <button type="button" onClick={() => { request.current?.abort(); setPending(false); }} className="text-sm underline">{t("取消")}</button> : null}
    </div>
    {!topic.trim() ? <p className="text-xs text-stone-500">{t("先在上方标题中填写创作主题，再选择模型生成。")}</p> : null}
    {error ? <p role="alert" className="text-sm text-rose-700">{t(error)}</p> : null}
  </section>;
}
