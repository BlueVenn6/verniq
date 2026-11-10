"use client";

import { useLayoutEffect, useRef } from "react";
import { useLearningUi } from "@/src/components/LanguageProvider";
import { PronunciationControl } from "@/src/components/reader/PronunciationControl";
import type { DictionaryLookupResult } from "@/src/lib/dictionary";
import type { ReaderTextSelection } from "@/src/lib/selectionAnalysis";
import type { SelectionAnalysisKind } from "@/src/lib/sentenceGrammarAnalysis";

export type SelectionAnchor = { left: number; right: number; top: number; bottom: number };

export function SelectionPopover({ selection, anchor, result, pending, error, language, onClose, onRecord, onExplain, onAnalyze, onRetry }: {
  selection: ReaderTextSelection;
  anchor: SelectionAnchor;
  result: DictionaryLookupResult | null;
  pending: boolean;
  error: string;
  language: string;
  onClose: () => void;
  onRecord: () => void;
  onExplain: () => void;
  onAnalyze: (kind: SelectionAnalysisKind) => void;
  onRetry: () => void;
}) {
  const { t } = useLearningUi();
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const position = () => {
      const box = element.getBoundingClientRect();
      const left = Math.max(12, Math.min(anchor.left, window.innerWidth - box.width - 12));
      const below = anchor.bottom + 8;
      const top = below + box.height <= window.innerHeight - 12 ? below : Math.max(12, anchor.top - box.height - 8);
      element.style.left = `${left}px`;
      element.style.top = `${top}px`;
    };
    position();
    const observer = new ResizeObserver(position);
    observer.observe(element);
    return () => observer.disconnect();
  }, [anchor, result, pending, error]);
  const word = selection.selectionType === "word";
  const kind = selection.selectionType === "phrase" ? "phrase" : selection.selectionType === "sentence" ? "sentence" : "paragraph";
  return <div ref={ref} role="dialog" aria-label={t("划词速查")} data-selection-popover
    className="fixed z-50 w-[340px] max-w-[calc(100vw-24px)] overflow-y-auto overscroll-contain rounded-xl border border-stone-300 bg-[#fffdf8] p-4 text-sm text-stone-800 shadow-xl"
    style={{ left: anchor.left, top: anchor.bottom + 8, maxHeight: "min(420px, calc(100dvh - 24px))" }}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0"><p className="whitespace-normal text-base font-semibold">{selection.selectedText}</p>
        {result?.phonetic ? <p className="mt-1 text-xs text-stone-500">{result.phonetic}</p> : null}</div>
      <button type="button" aria-label={t("关闭速查")} onClick={onClose} className="rounded px-2 py-1 text-stone-500 hover:bg-stone-100">×</button>
    </div>
    {word ? <div aria-live="polite" className="mt-3 space-y-2">
      {pending ? <p className="text-stone-500">{t("查词中…")}</p> : error ? <p role="alert">{t(error)}</p> : <>
        {result?.chineseDefinitions?.length ? <p lang="zh-CN" className="whitespace-pre-line">{result.chineseDefinitions[0]}</p> : null}
        {result?.definitions.slice(0, 2).map((entry, index) => <p key={index} lang="en" className="whitespace-pre-line text-stone-600">{entry.partOfSpeech ? `${entry.partOfSpeech} · ` : ""}{entry.definition}</p>)}
        {!result?.definitions.length && !result?.chineseDefinitions?.length ? <p className="text-stone-500">{t("内置词典暂无此词，可在深入学习中查询在线词典或使用 AI。")}</p> : null}
        {result ? <p className="text-xs text-stone-400">{result.source === "ecdict" ? "ECDICT · MIT" : result.source === "cc-cedict" ? "CC-CEDICT · CC BY-SA 4.0" : t("词典释义")}</p> : null}
      </>}
      <PronunciationControl compact text={selection.selectedText} language={language} audioUrl={result?.audioUrl} />
    </div> : <p className="mt-2 text-xs text-stone-500">{t("选中内容后，可记录表达或请求 AI 分析。")}</p>}
    <div className="mt-3 flex flex-wrap gap-2 border-t border-stone-200 pt-3">
      {word && error ? <button type="button" onClick={onRetry} className="rounded-lg border px-3 py-2">{t("重试查词")}</button> : null}
      <button type="button" onClick={onRecord} className="rounded-lg border border-stone-300 px-3 py-2 font-semibold">{word ? t("记录到生词本") : t("记录与学习")}</button>
      {word ? <button type="button" onClick={onExplain} className="rounded-lg bg-stone-900 px-3 py-2 font-semibold text-white">{t("AI 双语讲解")}</button> : null}
      {!word ? <button type="button" onClick={() => onAnalyze(kind)} className="rounded-lg bg-stone-900 px-3 py-2 font-semibold text-white">{t("AI 分析选区")}</button> : null}
    </div>
  </div>;
}
