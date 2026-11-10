"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLearningUi } from "../LanguageProvider";
import { FullTextSelect } from "../FullTextSelect";
import { askReaderAssistant } from "@/src/lib/readerAssistant";
import { analyzeSourceMaterialForLanguageLearning, toSegmentAnalysisRecord } from "@/src/lib/languageAnalysis";
import { useWorkspaceStore } from "@/src/lib/useWorkspaceStore";
import type { AiSendPlan, LearningSegment, SourceMaterial } from "@/src/lib/types";

const presetQuestions = {
  highlights: "提取这篇文章的主旨、关键观点和学习候选。",
  understanding: "请结合原文检查我的总结，指出理解准确的地方、遗漏和可能的误解，并提出一个后续问题。",
  selection: "请结合上下文解释当前选句，包括含义和用法。",
};
type Action = "custom" | "highlights" | "understanding" | "selection";
export function ReaderAssistant({ source, segments, note, selection, highlightRequest, highlights }: {
  source: SourceMaterial; segments: LearningSegment[]; note: string; selection: string;
  highlightRequest: number; highlights: ReactNode;
}) {
  const { t } = useLearningUi();
  const { workspace, updateWorkspace } = useWorkspaceStore();
  const [action, setAction] = useState<Action>("custom");
  const [question, setQuestion] = useState("");
  const [modelId, setModelId] = useState("");
  const [allowRemoteMaterial, setAllowRemoteMaterial] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const requestId = useRef(0);
  const output = useRef<HTMLDivElement>(null);
  const messages = workspace.readerMessages.filter(message => message.sourceMaterialId === source.id);
  const models = workspace.aiModels.filter(model => model.enabled && model.supportsText !== false && workspace.aiProviders.some(provider => provider.id === model.providerId && provider.enabled && provider.adapterProtocol !== "openai_images"));
  useEffect(() => {
    return () => { controller.current?.abort(); requestId.current += 1; };
  }, []);
  const [handledHighlightRequest, setHandledHighlightRequest] = useState(0);
  if (handledHighlightRequest !== highlightRequest) {
    setHandledHighlightRequest(highlightRequest);
    if (highlightRequest) { setAction("highlights"); setQuestion(t(presetQuestions.highlights)); }
  }
  useEffect(() => { if (output.current) output.current.scrollTop = output.current.scrollHeight; }, [messages.length, pending]);
  const confirmSend = (plan: AiSendPlan) => window.confirm(`${t("本次发送到：")}${plan.providerName} · ${plan.modelName}\n${t("内容：材料节选、我的笔记及当前问题；最多读取正文前 12,000 字符。")}`);
  const send = async () => {
    if (pending) return;
    const prompt = question.trim() || (action === "understanding" ? t("请结合原文检查我的总结，指出理解准确的地方、遗漏和可能的误解，并提出一个后续问题。") : action === "selection" ? t("请结合上下文解释当前选句，包括含义和用法。") : action === "highlights" ? t("提取这篇文章的主旨、关键观点和学习候选。") : "");
    if (!prompt) return;
    if (action === "understanding" && !note.trim()) { setError("先在我的笔记中写下你的总结，再来讨论。"); return; }
    if (action === "selection" && !selection.trim()) { setError("请先在原文中选中要讨论的文字。"); return; }
    const submittedQuestion = question;
    const currentId = ++requestId.current;
    const abort = new AbortController(); controller.current = abort;
    setPending(true); setError("");
    try {
      let text: string;
      if (action === "highlights") {
        const result = await analyzeSourceMaterialForLanguageLearning({ sourceMaterial: source, learningSegments: segments, userGoal: prompt, targetLanguage: source.language || workspace.languageSettings.targetLanguage, nativeLanguage: workspace.languageSettings.explanationLanguage, aiProviders: workspace.aiProviders, aiModels: workspace.aiModels, aiTaskRouting: workspace.aiTaskRouting, aiPrivacySettings: workspace.aiPrivacySettings, modelId: modelId || undefined, allowRemoteMaterial, signal: abort.signal, confirmSend });
        if (abort.signal.aborted || currentId !== requestId.current) return;
        if (!result.ok) throw new Error(result.error);
        const record = toSegmentAnalysisRecord(result.analysis, source);
        updateWorkspace(current => ({ segmentAnalyses: [record, ...current.segmentAnalyses] }));
        const overview = result.analysis.articleOverview;
        text = [overview.summaryZh || overview.summaryInTargetLanguage, ...overview.keyIdeas.map(idea => `• ${idea}`)].filter(Boolean).join("\n\n");
        if ((source.cleanedContent || source.originalContent).length > 12000) text += `\n\n${t("以上只依据正文前 12,000 字符。")}`;
      } else {
        const result = await askReaderAssistant({ workspace, source, question: prompt, note, selection, history: messages, modelId: modelId || undefined, allowRemoteMaterial, signal: abort.signal, confirmSend });
        text = result.text;
      }
      if (abort.signal.aborted || currentId !== requestId.current) return;
      const createdAt = new Date().toISOString();
      updateWorkspace(current => ({ readerMessages: [...current.readerMessages,
        { id: crypto.randomUUID(), sourceMaterialId: source.id, role: "user", text: prompt, createdAt },
        { id: crypto.randomUUID(), sourceMaterialId: source.id, role: "assistant", text, createdAt }] }));
      setQuestion(current => current === submittedQuestion ? "" : current);
    } catch (cause) { if (!abort.signal.aborted && currentId === requestId.current) setError(cause instanceof Error ? cause.message : "AI 生成失败。"); }
    finally { if (currentId === requestId.current) setPending(false); }
  };
  return <div className={`reader-chat flex min-h-0 flex-col gap-3 ${messages.length || pending ? "reader-chat-has-messages" : ""}`}>
    <section aria-label={t("AI 回复")}>
      <h2 className="mb-2 text-sm font-semibold text-stone-700">{t("AI 回复")}</h2>
      {messages.length || pending ? <div ref={output} role="log" aria-label={t("阅读对话记录")} className="reader-chat-log space-y-3 overflow-y-auto rounded-lg bg-stone-50 p-3 text-sm leading-7" aria-live="polite">
        {messages.map(message => <div key={message.id} className={message.role === "user" ? "ml-5 rounded-lg bg-white p-3" : "mr-2 py-2"}>
          <p className="mb-1 text-xs font-semibold text-stone-500">{message.role === "user" ? t("我") : "AI"}</p><p className="whitespace-pre-wrap">{message.text}</p>
        </div>)}
        {pending ? <p role="status">{t("AI 正在回复…")}</p> : null}
      </div> : <p className="text-xs leading-6 text-stone-500">{t("暂无回复。在下方输入问题并发送，AI 的回答会显示在这里。")}</p>}
      {highlights}
    </section>
    <details className="text-xs text-stone-600"><summary className="cursor-pointer">{t("模型与发送范围")}</summary>
      <label className="mt-2 block">{t("对话模型")}<FullTextSelect aria-label={t("对话模型")} value={modelId} onChange={event => setModelId(event.target.value)} className="mt-1 w-full rounded-lg border p-2"><option value="">{t("使用设置中的学习模型")}</option>{models.map(model => <option key={model.id} value={model.id}>{workspace.aiProviders.find(provider => provider.id === model.providerId)?.displayName} · {model.displayName || model.modelId}</option>)}</FullTextSelect></label>
      <p className="mt-2">{t("内容：材料节选、我的笔记及当前问题；最多读取正文前 12,000 字符。")}</p>
    </details>
    <label className="block text-sm">{t("快捷问题")}<FullTextSelect aria-label={t("快捷问题")} value={action} onChange={event => { const next = event.target.value as Action; setAction(next); setQuestion(next === "custom" ? "" : t(presetQuestions[next])); }} className="mt-1 w-full rounded-lg border p-2">
      <option value="custom">{t("自定义提问")}</option><option value="highlights">{t("提取文章重点")}</option><option value="understanding">{t("检查我的总结")}</option><option value="selection">{t("解释当前选句")}</option>
    </FullTextSelect></label>
    <label className="block text-sm font-semibold">{t("你的问题")}
      <textarea aria-label={t("向 AI 提问")} value={question} onChange={event => setQuestion(event.target.value)} rows={3} maxLength={3000} placeholder={t("输入问题，或选择上方的快捷问题后修改。可以继续追问。") } className="mt-1 w-full rounded-lg border border-stone-300 p-3 text-sm font-normal" />
    </label>
    <label className="flex items-start gap-2 text-xs leading-5"><input type="checkbox" checked={allowRemoteMaterial} onChange={event => setAllowRemoteMaterial(event.target.checked)} className="mt-1" />{t("允许本次发送材料正文给远程 AI；不会更改全局设置。")}</label>
    {error ? <p role="alert" className="text-sm text-rose-700">{t(error)}</p> : null}
    <div className="flex flex-wrap gap-2"><button type="button" disabled={pending || (action === "custom" && !question.trim())} onClick={() => void send()} className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{action === "highlights" ? t("提取重点") : t("发送")}</button>{pending ? <button type="button" onClick={() => { controller.current?.abort(); requestId.current += 1; setPending(false); }} className="text-sm underline">{t("取消")}</button> : null}</div>
  </div>;
}
