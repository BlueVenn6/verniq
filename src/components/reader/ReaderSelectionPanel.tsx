"use client";


import { useLearningUi } from "@/src/components/LanguageProvider";
import type { ReactNode } from "react";
import { GrammarAnalysisPanel } from "@/src/components/reader/GrammarAnalysisPanel";
import type { SentenceGrammarAnalysisResult, SelectionAnalysisKind } from "@/src/lib/sentenceGrammarAnalysis";
import type { ReaderTextSelection } from "@/src/lib/selectionAnalysis";

type ReaderSelectionPanelProps = {
  selection: ReaderTextSelection | null;
  sourceTitle: string;
  dictionaryPanel: ReactNode;
  dictionaryPending: boolean;
  analysisPending: boolean;
  analysisError: string;
  analysis: SentenceGrammarAnalysisResult | null;
  meaning: string;
  meaningZh: string;
  wordExplanationPanel: ReactNode;
  onMeaningChange: (meaning: string) => void;
  onMeaningZhChange: (meaning: string) => void;
  onLookupWord: () => void;
  onSaveVocabulary: () => void;
  onSaveExpression: () => void;
  onAnalyze: (kind: SelectionAnalysisKind) => void;
  onCancelAnalysis: () => void;
  onSaveAnalyzedExpression: (expressionIndex: number) => void;
  onSaveGrammarNote: () => void;
};

const selectionTypeLabels = {
  word: "单词",
  phrase: "短语",
  sentence: "句子",
  paragraph: "段落",
  invalid: "无效选区",
} as const;

export function ReaderSelectionPanel({
  selection,
  sourceTitle,
  dictionaryPanel,
  dictionaryPending,
  analysisPending,
  analysisError,
  analysis,
  meaning,
  meaningZh,
  wordExplanationPanel,
  onMeaningChange,
  onMeaningZhChange,
  onLookupWord,
  onSaveVocabulary,
  onSaveExpression,
  onAnalyze,
  onCancelAnalysis,
  onSaveAnalyzedExpression,
  onSaveGrammarNote,
}: ReaderSelectionPanelProps) {
  const { t } = useLearningUi();
  if (!selection) {
    return (
      <section className="rounded-lg border border-stone-200 p-4">
        <p className="text-xs font-semibold text-stone-500">{t("当前选择")}</p>
        <p className="mt-3 text-sm leading-7 text-stone-500">{t("在正文中选择单词、短语、句子或段落。")}</p>
      </section>
    );
  }

  const isWord = selection.selectionType === "word";
  const isPhrase = selection.selectionType === "phrase";
  const isSentence = selection.selectionType === "sentence";
  const isParagraph = selection.selectionType === "paragraph";

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-stone-200 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold text-stone-500">{t("当前选择")}</p>
          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600">
            {t(selectionTypeLabels[selection.selectionType])}
          </span>
        </div>
        <p className="mt-3 rounded-lg bg-stone-100 p-3 text-sm leading-7 text-stone-800">
          {selection.selectedText || t("未选择有效文本")}
        </p>
        <div className="mt-3 space-y-1 text-xs leading-6 text-stone-500">
          <p>{t("材料：")}{sourceTitle}</p>
          <p>{t("段落：")}{selection.segmentIndex + 1}</p>
        </div>
        {selection.selectionType === "invalid" ? (
          <p className="mt-3 text-sm leading-6 text-amber-700">{t("请选择包含文字的有效选区后再试。")}</p>
        ) : null}
      </section>

      {isWord ? (
        <>
          <details className="rounded-lg border border-stone-200 p-3">
            <summary className="cursor-pointer text-sm font-semibold">{t("完整词典与发音")}</summary>
            <div className="mt-3">{dictionaryPanel}</div>
          </details>
          <label className="block text-sm text-stone-600">
            {t("中文释义（可编辑）")}<textarea aria-label={t("中文释义（可编辑）")} lang="zh-CN" value={meaningZh} onChange={(event) => onMeaningZhChange(event.target.value)}
              className="mt-2 w-full rounded-lg border border-stone-300 p-3" />
          </label>
          <label className="block text-sm text-stone-600">
            {t("英文释义（可编辑）")}<textarea aria-label={t("英文释义（可编辑）")} lang="en" value={meaning} onChange={(event) => onMeaningChange(event.target.value)}
              className="mt-2 w-full rounded-lg border border-stone-300 p-3" />
          </label>
          <div className="grid gap-2">
            {!meaning && !meaningZh ? <button
              type="button"
              onClick={onLookupWord}
              disabled={dictionaryPending}
              className="rounded-full border border-stone-200 bg-[#fbfaf7] px-4 py-2 text-sm font-semibold text-stone-700 disabled:cursor-not-allowed disabled:text-stone-300"
            >
              {dictionaryPending ? t("查词中…") : t("查词")}
            </button> : null}
            <button
              type="button"
              onClick={onSaveVocabulary}
              className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white"
            >
              {t("保存为词汇")}</button>
          </div>
          {wordExplanationPanel}
        </>
      ) : null}

      {isPhrase ? (
        <>
          <label className="block text-sm text-stone-600">
            {t("释义（可编辑）")}<textarea aria-label={t("释义（可编辑）")} value={meaning} onChange={(event) => onMeaningChange(event.target.value)}
              className="mt-2 w-full rounded-lg border border-stone-300 p-3" />
          </label>
          <div className="grid gap-2">
            <button type="button" onClick={() => onAnalyze("phrase")} className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white">
              {t("解释表达")}</button>
            <button type="button" onClick={onSaveExpression} className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700">
              {t("保存表达")}</button>
          </div>
          <GrammarAnalysisPanel
            selection={selection}
            analysis={analysis}
            pending={analysisPending}
            error={analysisError}
            onCancel={onCancelAnalysis}
            onRetry={() => onAnalyze("phrase")}
            onSaveExpression={onSaveAnalyzedExpression}
            onSaveGrammar={onSaveGrammarNote}
          />
        </>
      ) : null}

      {isSentence ? (
        <>
          <div className="grid gap-2">
            <button type="button" onClick={() => onAnalyze("sentence")} className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white">
              {t("分析句意、语法与表达")}</button>
          </div>
          <GrammarAnalysisPanel
            selection={selection}
            analysis={analysis}
            pending={analysisPending}
            error={analysisError}
            onCancel={onCancelAnalysis}
            onRetry={() => onAnalyze("sentence")}
            onSaveExpression={onSaveAnalyzedExpression}
            onSaveGrammar={onSaveGrammarNote}
          />
        </>
      ) : null}

      {isParagraph ? (
        <>
          <div className="grid gap-2">
            <button type="button" onClick={() => onAnalyze("paragraph")} className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white">
              {t("分析段落与重点表达")}</button>
          </div>
          <GrammarAnalysisPanel
            selection={selection}
            analysis={analysis}
            pending={analysisPending}
            error={analysisError}
            onCancel={onCancelAnalysis}
            onRetry={() => onAnalyze("paragraph")}
            onSaveExpression={onSaveAnalyzedExpression}
            onSaveGrammar={onSaveGrammarNote}
          />
        </>
      ) : null}

    </div>
  );
}
