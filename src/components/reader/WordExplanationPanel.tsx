"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useLearningUi } from "@/src/components/LanguageProvider";
import { explainWordBilingually, type BilingualWordExplanation } from "@/src/lib/wordExplanation";
import type { ReaderTextSelection } from "@/src/lib/selectionAnalysis";
import type { WorkspaceState } from "@/src/lib/types";

export function WordExplanationPanel({ selection, language, workspace, confirmSend, onUse, explainOnOpen = false }: {
  selection: ReaderTextSelection;
  language: string;
  workspace: WorkspaceState;
  confirmSend: () => boolean;
  onUse: (result: BilingualWordExplanation) => void;
  explainOnOpen?: boolean;
}) {
  const { t } = useLearningUi();
  const [result, setResult] = useState<BilingualWordExplanation | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    return () => { request.current?.abort(); };
  }, []);
  const analyze = async () => {
    if (pending || !confirmSend()) return;
    const controller = new AbortController();
    request.current = controller;
    setPending(true); setError("");
    try {
      const next = await explainWordBilingually({ selection, language, workspace, signal: controller.signal });
      if (!controller.signal.aborted) setResult(next);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "AI 未返回完整的中英双语释义，请重试。");
    } finally {
      if (!controller.signal.aborted) setPending(false);
    }
  };
  const explain = useEffectEvent(() => { void analyze(); });
  useEffect(() => {
    if (!explainOnOpen) return;
    const frame = requestAnimationFrame(explain);
    return () => cancelAnimationFrame(frame);
  }, [explainOnOpen]);
  return <section className="space-y-3 rounded-lg border border-stone-200 p-4 text-sm leading-7" aria-live="polite">
    <h3 className="font-semibold">{t("AI 双语语境讲解")}</h3>
    <p className="text-xs text-stone-500">{t("只发送选中的词与所在句子，使用语言分析模型。AI 生成内容需核对，不属于词典原文。")}</p>
    <button type="button" onClick={analyze} disabled={pending} className="rounded-full border border-stone-300 px-4 py-2 disabled:opacity-40">
      {pending ? t("分析中…") : t("用 AI 中英双语解释")}
    </button>
    {pending ? <button type="button" onClick={() => { request.current?.abort(); setPending(false); }} className="ml-3 underline">{t("取消")}</button> : null}
    {error ? <p role="alert" className="text-rose-700">{t(error)}</p> : null}
    {result ? <>
      <p className="text-xs text-stone-500">{result.providerName} · {result.modelId}</p>
      <p lang="zh-CN"><strong>{t("中文释义：")}</strong>{result.meaningZh}</p>
      <p lang="en"><strong>{t("英文释义：")}</strong>{result.meaningEn}</p>
      <p lang="zh-CN">{result.contextZh}</p><p lang="en">{result.contextEn}</p>
      <p lang="en">{result.exampleEn}</p><p lang="zh-CN">{result.exampleZh}</p>
      <button type="button" onClick={() => onUse(result)} className="underline">{t("使用这份 AI 释义编辑词条")}</button>
    </> : null}
  </section>;
}
