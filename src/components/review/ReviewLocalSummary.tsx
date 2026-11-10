"use client";

import { FullTextSelect } from "@/src/components/FullTextSelect";


import { useLearningUi } from "@/src/components/LanguageProvider";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useWorkspaceStore } from "@/src/lib/useWorkspaceStore";
import { buildAnkiTsvExport, downloadTextFile } from "@/src/lib/ankiExport";
import {
  SRS_RATINGS,
  formatDueDistance,
  getEffectiveSrsState,
  getLearningStatusAfterSrsRating,
  getSrsStage,
  isSrsDue,
  previewSrsRatings,
  reviewSrsState,
} from "@/src/lib/srs";
import type {
  LearningItemStatus,
  SrsRating,
  SrsState,
  VocabularyItem,
  ExpressionItem,
  WorkspaceState,
} from "@/src/lib/types";

type ReviewQueueItem = {
  id: string;
  kind: "vocabulary" | "expression" | "grammar" | "culture" | "feynman";
  label: string;
  title: string;
  detail: string;
  sourceTitle?: string;
  sentence?: string;
  status?: LearningItemStatus;
  stage?: number;
  srs?: SrsState;
  dueAt?: string;
  dueLabel?: string;
  isDue?: boolean;
  ratingPreviews?: ReturnType<typeof previewSrsRatings>;
  reviewCount?: number;
  createdAt: string;
  updatedAt: string;
};

export function ReviewLocalSummary() {
  const { t } = useLearningUi();
  const { workspace, updateWorkspace } = useWorkspaceStore();
  const [exportMessage, setExportMessage] = useState("");
  const [visibleCount, setVisibleCount] = useState(18);
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const [now, setNow] = useState(() => new Date());
  const [filter, setFilter] = useState<"due" | "all">("due");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{ id: string; kind: "vocabulary" | "expression"; text: string; meaning: string; meaningZh: string } | null>(null);
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(timer); }, []);
  const queue = useMemo(() => buildReviewQueue(workspace, now), [workspace, now]);
  const visibleQueue = queue.filter((item) => (filter === "all" || item.isDue) && `${item.title} ${item.sourceTitle ?? ""} ${item.detail}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const dueLearningCount = queue.filter((item) => item.status && item.isDue).length;
  // These tiles sit under "今日待复习", so they must count what is actually due
  // today rather than every saved item.
  const dueVocabularyCount = queue.filter((item) => item.kind === "vocabulary" && item.isDue).length;
  const dueExpressionCount = queue.filter((item) => item.kind === "expression" && item.isDue).length;
  const facts = [
    { label: "材料总数", value: workspace.sourceMaterials.length },
    { label: "今日待复习", value: dueLearningCount },
    { label: "待复习词汇", value: dueVocabularyCount },
    { label: "待复习表达", value: dueExpressionCount },
  ];

  const applySrsRating = (
    item: ReviewQueueItem,
    rating: SrsRating,
  ) => {
    if (item.kind !== "vocabulary" && item.kind !== "expression") {
      return;
    }

    updateWorkspace((current) => {
      const now = new Date().toISOString();

      if (item.kind === "vocabulary") {
        return {
          vocabularyItems: current.vocabularyItems.map((entry) =>
            entry.id === item.id ? applySrsToVocabularyItem(entry, rating, now) : entry,
          ),
        };
      }

      return {
        expressionItems: current.expressionItems.map((entry) =>
          entry.id === item.id ? applySrsToExpressionItem(entry, rating, now) : entry,
        ),
      };
    });
    setRevealed((current) => {
      const next = new Set(current);
      next.delete(`${item.kind}-${item.id}`);
      return next;
    });
  };

  const handleAnkiExport = () => {
    const result = buildAnkiTsvExport(workspace);

    if (!result.rowCount) {
      setExportMessage("没有可导出的词汇或表达。");
      return;
    }

    downloadTextFile(result.fileName, result.content);
    setExportMessage(`已生成 ${result.rowCount} 条 Anki TSV：${result.fileName}`);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-stone-200 bg-white p-6 shadow-sm shadow-stone-200/60 sm:p-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-stone-500">{t("复习")}</p>
          <h1 className="mt-2 text-3xl font-semibold text-stone-950">
            {t("按计划复习词汇与表达")}</h1>
          <p className="mt-3 text-sm leading-7 text-stone-600">
            {t("汇总你在阅读器中保存的词汇和表达，并根据复习结果安排下一次复习。")}</p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {facts.map((fact) => (
            <article key={t(fact.label)} className="rounded-3xl border border-stone-200 bg-[#fbfaf7] p-5">
              <p className="text-xs font-semibold text-stone-500">{t(fact.label)}</p>
              <p className="mt-3 text-lg font-semibold text-stone-900">{fact.value}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-stone-200 bg-white p-6 shadow-sm shadow-stone-200/60 sm:p-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-stone-500">{t("待复习内容")}</p>
            <h2 className="mt-2 text-2xl font-semibold text-stone-950">
              {t("先复习今天到期的内容")}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-600">
              {t("词汇和表达会根据复习结果更新进度；语法、文化点和费曼笔记可作为回顾内容查看。")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleAnkiExport}
              className="inline-flex w-fit items-center justify-center rounded-full border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:text-stone-950"
            >
              {t("导出为 Anki TSV")}</button>
            <Link
              href="/reader"
              className="inline-flex w-fit items-center justify-center rounded-full border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:text-stone-950"
            >
              {t("打开阅读器")}</Link>
          </div>
        </div>

        {exportMessage ? (
          <p className="mt-4 rounded-2xl border border-stone-200 bg-[#fbfaf7] px-4 py-3 text-sm text-stone-600">
            {t(exportMessage)}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <FullTextSelect aria-label={t("复习范围")} value={filter} onChange={(event) => { setFilter(event.target.value as "due" | "all"); setVisibleCount(18); }} className="rounded-lg border border-stone-300 p-2 text-sm">
            <option value="due">{t("仅到期内容")}</option><option value="all">{t("全部保存内容")}</option>
          </FullTextSelect>
          <input aria-label={t("搜索词汇与笔记")} placeholder={t("搜索词汇、释义或来源")} value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(18); }} className="min-w-52 flex-1 rounded-lg border border-stone-300 p-2 text-sm" />
        </div>
        <div className="mt-6 space-y-3">
          {visibleQueue.length ? (
            visibleQueue.slice(0, visibleCount).map((item) => (
              <article
                key={`${item.kind}-${item.id}`}
                className="rounded-3xl border border-stone-200 bg-[#fbfaf7] p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-stone-600">
                        {t(item.label)}
                      </span>
                      {item.status ? (
                        <span className="rounded-full bg-stone-900 px-3 py-1 text-xs font-medium text-white">
                          {t(statusLabel(item.status))}
                        </span>
                      ) : null}
                      {item.dueLabel ? (
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                          item.isDue
                            ? "bg-rose-100 text-rose-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}>
                          {item.isDue ? t("待复习") : t(item.dueLabel)}
                        </span>
                      ) : null}
                      {typeof item.reviewCount === "number" ? (
                        <span className="rounded-full bg-white px-3 py-1 text-xs text-stone-500">
                          {t("复习")}{item.reviewCount} {t("次")}</span>
                      ) : null}
                      <span className="rounded-full bg-white px-3 py-1 text-xs text-stone-500">
                        {formatCompactTime(item.updatedAt)}
                      </span>
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-stone-950">{item.title}</h3>
                    {!item.status || revealed.has(`${item.kind}-${item.id}`) ? (
                      <p className="mt-2 text-sm leading-7 text-stone-700">{item.detail}</p>
                    ) : (
                      <button type="button" onClick={() => setRevealed((current) => new Set(current).add(`${item.kind}-${item.id}`))} className="mt-3 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700">
                        {t("显示释义")}</button>
                    )}
                    {item.sentence && (!item.status || revealed.has(`${item.kind}-${item.id}`)) ? (
                      <p className="mt-3 rounded-2xl border border-stone-200 bg-white p-3 text-sm leading-7 text-stone-600">
                        {item.sentence}
                      </p>
                    ) : null}
                    {item.sourceTitle ? (
                      <p className="mt-3 text-xs text-stone-500">{t("来源：")}{item.sourceTitle}</p>
                    ) : null}
                    {(item.kind === "vocabulary" || item.kind === "expression") && revealed.has(`${item.kind}-${item.id}`) ? (
                      <button type="button" onClick={() => {
                        const record = item.kind === "vocabulary" ? workspace.vocabularyItems.find((entry) => entry.id === item.id) : workspace.expressionItems.find((entry) => entry.id === item.id);
                        if (record) setEditing({ id: item.id, kind: item.kind as "vocabulary" | "expression", text: record.text,
                          meaning: item.kind === "vocabulary" ? record.meaningEn : record.meaningZh || record.meaningEn, meaningZh: record.meaningZh });
                      }} className="mt-3 text-sm underline">{t("纠正词条或释义")}</button>
                    ) : null}
                    {editing?.id === item.id && editing.kind === item.kind ? <form className="mt-3 space-y-2" onSubmit={(event) => {
                      event.preventDefault();
                      if (!editing.text.trim() || (!editing.meaning.trim() && !(editing.kind === "vocabulary" && editing.meaningZh.trim()))) return;
                      const patch = { text: editing.text.trim(), meaningZh: editing.kind === "vocabulary" ? editing.meaningZh.trim() : "", meaningEn: editing.meaning.trim(), updatedAt: new Date().toISOString() };
                      updateWorkspace((current) => editing.kind === "vocabulary"
                        ? { vocabularyItems: current.vocabularyItems.map((entry) => entry.id === editing.id ? { ...entry, ...patch, lemma: entry.text === patch.text ? entry.lemma : patch.text, pronunciation: entry.text === patch.text ? entry.pronunciation : undefined } : entry) }
                        : { expressionItems: current.expressionItems.map((entry) => entry.id === editing.id ? { ...entry, ...patch } : entry) });
                      setEditing(null);
                    }}>
                      <input required aria-label={t("词条")} value={editing.text} onChange={(event) => setEditing({ ...editing, text: event.target.value })} className="block w-full rounded border border-stone-300 p-2" />
                      {editing.kind === "vocabulary" ? <label className="block text-sm">{t("中文释义（可编辑）")}<textarea aria-label={t("中文释义（可编辑）")} lang="zh-CN" value={editing.meaningZh} onChange={(event) => setEditing({ ...editing, meaningZh: event.target.value })} className="block w-full rounded border border-stone-300 p-2" /></label> : null}
                      <label className="block text-sm">{editing.kind === "vocabulary" ? t("英文释义（可编辑）") : t("释义")}<textarea required={editing.kind === "expression"} aria-label={editing.kind === "vocabulary" ? t("英文释义（可编辑）") : t("释义")} value={editing.meaning} onChange={(event) => setEditing({ ...editing, meaning: event.target.value })} className="block w-full rounded border border-stone-300 p-2" /></label>
                      <button type="submit" className="mr-3 rounded border border-stone-300 px-3 py-2">{t("保存纠错")}</button>
                      <button type="button" onClick={() => setEditing(null)}>{t("取消")}</button>
                    </form> : null}
                  </div>

                  {item.status && item.ratingPreviews && revealed.has(`${item.kind}-${item.id}`) ? (
                    <div className="flex shrink-0 flex-wrap gap-2 lg:max-w-sm lg:justify-end">
                      {SRS_RATINGS.map((entry) => {
                        const preview = item.ratingPreviews?.find(
                          (candidate) => candidate.rating === entry.rating,
                        );

                        return (
                          <ReviewRatingButton
                            key={entry.rating}
                            label={t(entry.label)}
                            helper={preview?.dueLabel ?? entry.helper}
                            onClick={() => applySrsRating(item, entry.rating)}
                          />
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-stone-200 bg-[#fbfaf7] p-6 text-sm leading-7 text-stone-500">
              {queue.length ? t("当前没有匹配的到期内容。切换到“全部保存内容”可查看和检索记录。") : t("还没有可复习的内容。先导入材料，并在阅读时保存词汇、表达或笔记。")}</div>
          )}
        </div>

        {visibleQueue.length > visibleCount ? (
          <button type="button" onClick={() => setVisibleCount((current) => current + 18)} className="mt-4 rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700">
            {t("查看更多（剩余")}{visibleQueue.length - visibleCount} {t("条）")}</button>
        ) : null}

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/inbox"
            className="inline-flex items-center justify-center rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
          >
            {t("导入材料")}</Link>
          <Link
            href="/growth"
            className="inline-flex items-center justify-center rounded-full border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:text-stone-950"
          >
            {t("查看积累")}</Link>
        </div>
      </section>
    </div>
  );
}

export function buildReviewQueue(workspace: WorkspaceState, now = new Date()): ReviewQueueItem[] {
  const sourceTitleMap = new Map(
    workspace.sourceMaterials.map((source) => [source.id, source.title]),
  );
  const items: ReviewQueueItem[] = [
    ...workspace.vocabularyItems
      .filter((item) => item.status !== "ignored")
      .map((item) => vocabularyToQueueItem(item, sourceTitleMap, now)),
    ...workspace.expressionItems
      .filter((item) => item.status !== "ignored")
      .map((item) => expressionToQueueItem(item, sourceTitleMap, now)),
    ...workspace.grammarNotes.map((item) => ({
      id: item.id,
      kind: "grammar" as const,
      label: "语法",
      title: item.title,
      detail: item.explanationZh || item.explanationEn || "已保存为语法点。",
      sentence: item.sentence,
      sourceTitle: sourceTitleMap.get(item.sourceMaterialId),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt || item.createdAt,
    })),
    ...workspace.cultureNotes.map((item) => ({
      id: item.id,
      kind: "culture" as const,
      label: "文化",
      title: item.title,
      detail: item.explanationZh || item.culturalContext || item.explanationEn || "已保存为文化点。",
      sourceTitle: sourceTitleMap.get(item.sourceMaterialId),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt || item.createdAt,
    })),
    ...workspace.feynmanNotes.map((note) => ({
      id: note.id,
      kind: "feynman" as const,
      label: "费曼笔记",
      title: note.mainIdea || sourceTitleMap.get(note.sourceMaterialId) || "自己的解释",
      detail: note.ownWordsExplanation || note.userExplanation || note.personalConnection || "已保存费曼笔记。",
      sourceTitle: sourceTitleMap.get(note.sourceMaterialId),
      createdAt: note.createdAt,
      updatedAt: note.updatedAt || note.createdAt,
    })),
  ];

  return items
    .sort((a, b) => {
      if (a.isDue !== b.isDue) return a.isDue ? -1 : 1;
      if (a.dueAt && b.dueAt && a.dueAt !== b.dueAt) return a.dueAt.localeCompare(b.dueAt);

      const priorityDiff = getReviewPriority(a) - getReviewPriority(b);
      return priorityDiff || b.updatedAt.localeCompare(a.updatedAt);
    });
}

function vocabularyToQueueItem(
  item: VocabularyItem,
  sourceTitleMap: Map<string, string>,
  now: Date,
): ReviewQueueItem {
  const srs = getEffectiveSrsState(item);

  return {
    id: item.id,
    kind: "vocabulary",
    label: "词汇",
    title: item.text,
    detail: [item.pronunciation, item.meaningZh, item.meaningEn || (!item.meaningZh ? "已保存为词汇。" : "")].filter(Boolean).join(" · "),
    sentence: item.sentence,
    status: item.status,
    stage: getSrsStage(srs),
    srs,
    dueAt: srs.dueAt,
    dueLabel: formatDueDistance(srs.dueAt, now),
    isDue: isSrsDue(srs, now),
    ratingPreviews: previewSrsRatings(srs),
    reviewCount: srs.reps,
    sourceTitle: sourceTitleMap.get(item.sourceMaterialId),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt || item.createdAt,
  };
}

function expressionToQueueItem(
  item: ExpressionItem,
  sourceTitleMap: Map<string, string>,
  now: Date,
): ReviewQueueItem {
  const srs = getEffectiveSrsState(item);

  return {
    id: item.id,
    kind: "expression",
    label: "表达",
    title: item.text,
    detail: item.meaningZh || item.usageNote || item.meaningEn || "已保存为表达。",
    sentence: item.sentence,
    status: item.status,
    stage: getSrsStage(srs),
    srs,
    dueAt: srs.dueAt,
    dueLabel: formatDueDistance(srs.dueAt, now),
    isDue: isSrsDue(srs, now),
    ratingPreviews: previewSrsRatings(srs),
    reviewCount: srs.reps,
    sourceTitle: sourceTitleMap.get(item.sourceMaterialId),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt || item.createdAt,
  };
}

function getReviewPriority(item: ReviewQueueItem) {
  if (item.status === "new") return 0;
  if (item.status === "learning") return 1;
  if (!item.status) return 2;
  if (item.status === "known") return 3;
  return 4;
}

function statusLabel(status: LearningItemStatus) {
  if (status === "new") return "新";
  if (status === "learning") return "学习中";
  if (status === "known") return "已掌握";
  return "已忽略";
}

function ReviewRatingButton({
  label,
  helper,
  onClick,
}: {
  label: string;
  helper: string;
  onClick: () => void;
}) {
  const { t } = useLearningUi();
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-w-[5.5rem] rounded-2xl border border-stone-200 bg-white px-3 py-2 text-left text-sm font-semibold text-stone-800 transition hover:border-stone-300 hover:text-stone-950"
    >
      <span className="block">{t(label)}</span>
      <span className="mt-1 block text-xs font-normal text-stone-500">{t(helper)}</span>
    </button>
  );
}

function applySrsToVocabularyItem(item: VocabularyItem, rating: SrsRating, now: string) {
  const nextSrs = reviewSrsState({
    srs: item.srs,
    createdAt: item.createdAt,
    rating,
    reviewedAt: new Date(now),
  });

  return {
    ...item,
    srs: nextSrs,
    status: getLearningStatusAfterSrsRating({
      currentStatus: item.status,
      rating,
      srs: nextSrs,
    }),
    stage: getSrsStage(nextSrs),
    updatedAt: now,
  };
}

function applySrsToExpressionItem(item: ExpressionItem, rating: SrsRating, now: string) {
  const nextSrs = reviewSrsState({
    srs: item.srs,
    createdAt: item.createdAt,
    rating,
    reviewedAt: new Date(now),
  });

  return {
    ...item,
    srs: nextSrs,
    status: getLearningStatusAfterSrsRating({
      currentStatus: item.status,
      rating,
      srs: nextSrs,
    }),
    stage: getSrsStage(nextSrs),
    updatedAt: now,
  };
}

function formatCompactTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
