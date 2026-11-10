"use client";


import { useLearningUi } from "@/src/components/LanguageProvider";
import type { ReactNode } from "react";
import type { SentenceGrammarAnalysisResult } from "@/src/lib/sentenceGrammarAnalysis";
import type { ReaderTextSelection } from "@/src/lib/selectionAnalysis";

type GrammarAnalysisPanelProps = {
  selection: ReaderTextSelection;
  analysis: SentenceGrammarAnalysisResult | null;
  pending: boolean;
  error: string;
  onCancel: () => void;
  onRetry: () => void;
  onSaveExpression: (expressionIndex: number) => void;
  onSaveGrammar: () => void;
};

const selectionTypeLabels = {
  phrase: "短语分析",
  sentence: "句子语法分析",
  paragraph: "段落分析",
  word: "",
  invalid: "",
} as const;

const coreRoleLabels = {
  subject: "主语",
  predicate: "谓语",
  object: "宾语",
  predicative: "表语",
  complement: "补语",
} as const;

export function GrammarAnalysisPanel({
  selection,
  analysis,
  pending,
  error,
  onCancel,
  onRetry,
  onSaveExpression,
  onSaveGrammar,
}: GrammarAnalysisPanelProps) {
  const { t } = useLearningUi();
  const title = selectionTypeLabels[selection.selectionType];

  if (!title) return null;

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-stone-500">{t(title)}</p>
          {!selection.isCompleteSentence && selection.selectionType === "sentence" ? (
            <p className="mt-1 text-xs leading-5 text-amber-700">
              {t("当前选择可能不是完整句子，分析结果仅供参考。")}</p>
          ) : null}
        </div>
        {pending ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-600"
          >
            {t("取消")}</button>
        ) : (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-full border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-600"
          >
            {analysis ? t("重新分析") : t("开始分析")}
          </button>
        )}
      </div>

      {pending ? (
        <p className="mt-3 rounded-lg bg-stone-50 px-3 py-3 text-sm text-stone-600">{t("正在分析…")}</p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 rounded-lg bg-amber-50 px-3 py-3 text-sm leading-6 text-amber-800">
          {t(error)}
        </p>
      ) : null}
      {!pending && !error && !analysis ? (
        <p className="mt-3 text-sm leading-6 text-stone-500">
          {t("选择操作后，分析结果会显示在这里。")}</p>
      ) : null}

      {analysis ? <AnalysisContent analysis={analysis} onSaveExpression={onSaveExpression} onSaveGrammar={onSaveGrammar} /> : null}
    </section>
  );
}

function AnalysisContent({
  analysis,
  onSaveExpression,
  onSaveGrammar,
}: {
  analysis: SentenceGrammarAnalysisResult;
  onSaveExpression: (expressionIndex: number) => void;
  onSaveGrammar: () => void;
}) {
  const { t } = useLearningUi();
  return (
    <div className="mt-4 space-y-4 text-sm leading-7 text-stone-700">
      <p className="rounded-lg bg-[#fbfaf7] p-3 text-xs text-stone-500">
        {t("实际使用：")}{analysis.providerName} · {analysis.modelId}
      </p>

      <ResultSection title={t("整体意思")}>
        <p>{analysis.overallMeaning || t("模型没有返回整体解释。")}</p>
      </ResultSection>

      {analysis.sentenceCore.length ? (
        <ResultSection title={t("句子主干")}>
          <dl className="space-y-2">
            {analysis.sentenceCore.map((item) => (
              <div key={`${item.role}-${item.text}`}>
                <dt className="font-semibold text-stone-900">{t(coreRoleLabels[item.role])}：{item.text}</dt>
                {item.explanation ? <dd className="text-stone-600">{item.explanation}</dd> : null}
              </div>
            ))}
          </dl>
        </ResultSection>
      ) : null}

      {analysis.structureBreakdown.length ? (
        <ResultSection title={t("结构拆解")}>
          <div className="space-y-3">
            {analysis.structureBreakdown.map((item, index) => (
              <div key={`${item.label}-${item.text}-${index}`}>
                <p className="font-semibold text-stone-900">{t(item.label)}：{item.text}</p>
                {item.explanation ? <p className="text-stone-600">{item.explanation}</p> : null}
              </div>
            ))}
          </div>
        </ResultSection>
      ) : null}

      {analysis.grammarPoints.length ? (
        <ResultSection title={t("重点语法")}>
          <div className="space-y-3">
            {analysis.grammarPoints.map((item) => (
              <div key={`${item.title}-${item.explanation}`}>
                <p className="font-semibold text-stone-900">{item.title}</p>
                <p className="text-stone-600">{item.explanation}</p>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={onSaveGrammar}
            className="mt-3 rounded-full border border-stone-200 bg-[#fbfaf7] px-3 py-1.5 text-xs font-semibold text-stone-700"
          >
            {t("保存语法笔记")}</button>
        </ResultSection>
      ) : null}

      {analysis.fixedExpressions.length ? (
        <ResultSection title={t("固定表达与搭配")}>
          <div className="space-y-3">
            {analysis.fixedExpressions.map((item, index) => (
              <div key={`${item.text}-${index}`} className="border-t border-stone-100 pt-3 first:border-t-0 first:pt-0">
                <p className="font-semibold text-stone-900">{item.text}</p>
                <p className="text-stone-600">{item.meaning}</p>
                {item.roleInContext ? <p className="text-stone-500">{t("本句作用：")}{item.roleInContext}</p> : null}
                {item.usageNote ? <p className="text-stone-500">{item.usageNote}</p> : null}
                {item.example ? <p className="mt-1 font-serif text-stone-700">{item.example}</p> : null}
                {item.recommendedForSaving ? (
                  <button
                    type="button"
                    onClick={() => onSaveExpression(index)}
                    className="mt-2 rounded-full border border-stone-200 bg-[#fbfaf7] px-3 py-1.5 text-xs font-semibold text-stone-700"
                  >
                    {t("保存表达")}</button>
                ) : null}
              </div>
            ))}
          </div>
        </ResultSection>
      ) : null}

      {analysis.pitfalls.length ? <StringList title={t("易错点")} items={analysis.pitfalls} /> : null}
      {analysis.simplifiedRewrite ? (
        <ResultSection title={t("简化改写")}>
          <p className="font-serif text-stone-800">{analysis.simplifiedRewrite}</p>
        </ResultSection>
      ) : null}
      {analysis.similarExamples.length ? <StringList title={t("相似例句")} items={analysis.similarExamples} serif /> : null}
      {analysis.ambiguityNotes.length ? <StringList title={t("歧义与不确定性")} items={analysis.ambiguityNotes} /> : null}
    </div>
  );
}

function ResultSection({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useLearningUi();
  return (
    <div>
      <p className="mb-1 font-semibold text-stone-900">{t(title)}</p>
      {children}
    </div>
  );
}

function StringList({ title, items, serif = false }: { title: string; items: string[]; serif?: boolean }) {
  const { t } = useLearningUi();
  return (
    <ResultSection title={t(title)}>
      <ul className={`space-y-1 ${serif ? "font-serif" : ""}`}>
        {items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
      </ul>
    </ResultSection>
  );
}
