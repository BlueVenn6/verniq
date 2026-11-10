"use client";


import { useLearningUi } from "@/src/components/LanguageProvider";
import Link from "next/link";
import { useMemo } from "react";
import { useWorkspaceStore } from "@/src/lib/useWorkspaceStore";
import type { WorkspaceState } from "@/src/lib/types";

type GrowthActivity = {
  id: string;
  type: string;
  title: string;
  detail: string;
  sourceTitle?: string;
  createdAt: string;
};

export function GrowthLocalRecords() {
  const { t } = useLearningUi();
  const { workspace, lastUpdatedAt } = useWorkspaceStore();
  const recentActivities = useMemo(
    () => buildRecentActivities(workspace).slice(0, 12),
    [workspace],
  );
  const todayActivities = useMemo(
    () => recentActivities.filter((item) => isToday(item.createdAt)),
    [recentActivities],
  );
  const nextReusableExpression =
    workspace.expressionItems.find((item) => item.status !== "ignored")?.text ??
    workspace.vocabularyItems.find((item) => item.status !== "ignored")?.text ??
    t("暂无可复习的表达");
  const strongestArea = getStrongestGrowthArea(workspace);
  const stats = [
    { label: t("学习材料"), value: workspace.sourceMaterials.length },
    { label: t("已保存词汇"), value: workspace.vocabularyItems.length },
    { label: t("表达与句型"), value: workspace.expressionItems.length },
    { label: t("费曼笔记"), value: workspace.feynmanNotes.length },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-stone-200 bg-[#eef3ec] p-6 shadow-sm shadow-stone-200/60 sm:p-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-stone-500">{t("积累")}</p>
            <h1 className="mt-2 text-3xl font-semibold text-stone-950">
              {t("学习积累")}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-600">
              {t("汇总当前工作区中的材料、词汇、表达、语法、文化点和费曼笔记。")}</p>
          </div>
          <p className="text-xs leading-6 text-stone-500">
            {lastUpdatedAt ? `${t("最近保存：")}${formatCompactTime(lastUpdatedAt)}` : t("暂无保存记录")}
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <article key={stat.label} className="rounded-3xl bg-white/70 p-5">
              <p className="text-3xl font-semibold text-stone-950">{stat.value}</p>
              <p className="mt-2 text-xs font-medium text-stone-500">{stat.label}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-[1.75rem] border border-stone-200 bg-white p-6 shadow-sm shadow-stone-200/60">
          <p className="text-sm font-semibold text-stone-500">{t("目前积累最多")}</p>
          <p className="mt-3 text-xl font-semibold text-stone-950">{strongestArea.count ? `${t(strongestArea.label)} · ${strongestArea.count} ${t("条")}` : t("暂无明显侧重")}</p>
          <p className="mt-3 text-sm leading-7 text-stone-600">
            {t("根据当前工作区中各类学习内容的数量统计。")}</p>
        </article>
        <article className="rounded-[1.75rem] border border-stone-200 bg-white p-6 shadow-sm shadow-stone-200/60">
          <p className="text-sm font-semibold text-stone-500">{t("已保存的表达")}</p>
          <p className="mt-3 text-xl font-semibold text-stone-950">{nextReusableExpression}</p>
          <p className="mt-3 text-sm leading-7 text-stone-600">
            {t("系统会优先推荐已保存的表达；没有表达时，再从词汇中选择一项。")}</p>
        </article>
      </section>

      <section className="rounded-[1.75rem] border border-stone-200 bg-white p-6 shadow-sm shadow-stone-200/60 sm:p-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-stone-950">{t("最近保存")}</h2>
            <p className="mt-3 text-sm leading-7 text-stone-600">
              {t("最近保存的词汇、表达和笔记会按时间排列。")}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-stone-500">
            <span className="rounded-full bg-stone-100 px-3 py-1">
              {t("最近 12 条中今日更新")}{todayActivities.length} {t("条")}</span>
            <span className="rounded-full bg-stone-100 px-3 py-1">
              {t("显示")}{recentActivities.length} {t("条最近记录")}</span>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {recentActivities.length ? (
            recentActivities.map((record) => (
              <article
                key={record.id}
                className="rounded-3xl border border-stone-200 bg-[#fbfaf7] p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold text-stone-500">{t(record.type)}</p>
                    <h3 className="mt-2 text-base font-semibold text-stone-950">
                      {record.title}
                    </h3>
                    <p className="mt-2 text-sm leading-7 text-stone-700">
                      {record.detail || t("暂无摘要")}
                    </p>
                    {record.sourceTitle ? (
                      <p className="mt-2 text-xs text-stone-500">
                        {t("来源：")}{record.sourceTitle}
                      </p>
                    ) : null}
                  </div>
                  <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-medium text-stone-600">
                    {formatCompactTime(record.createdAt)}
                  </span>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-stone-200 bg-[#fbfaf7] p-6 text-sm leading-7 text-stone-500">
              {t("暂无新保存内容。导入材料后，可以在阅读时保存词汇、表达或笔记。")}</div>
          )}
        </div>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/inbox"
            className="inline-flex items-center justify-center rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
          >
            {t("导入材料")}</Link>
          <Link
            href="/reader"
            className="inline-flex items-center justify-center rounded-full border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:text-stone-950"
          >
            {t("打开阅读器")}</Link>
          <Link
            href="/review"
            className="inline-flex items-center justify-center rounded-full border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:text-stone-950"
          >
            {t("开始复习")}</Link>
        </div>
      </section>
    </div>
  );
}

function buildRecentActivities(workspace: WorkspaceState): GrowthActivity[] {
  const sourceTitleMap = new Map(
    workspace.sourceMaterials.map((source) => [source.id, source.title]),
  );

  return [
    ...workspace.sourceMaterials.map((source) => ({
      id: `source-${source.id}`,
      type: "学习材料",
      title: source.title,
      detail: summarizeText(source.cleanedContent || source.originalContent || source.sourceType),
      createdAt: source.updatedAt || source.createdAt,
    })),
    ...workspace.vocabularyItems.map((item) => ({
      id: `vocabulary-${item.id}`,
      type: "词汇",
      title: item.text,
      detail: item.meaningZh || item.meaningEn || item.sentence || "",
      sourceTitle: sourceTitleMap.get(item.sourceMaterialId),
      createdAt: item.updatedAt || item.createdAt,
    })),
    ...workspace.expressionItems.map((item) => ({
      id: `expression-${item.id}`,
      type: "表达",
      title: item.text,
      detail: item.meaningZh || item.usageNote || item.sentence || "",
      sourceTitle: sourceTitleMap.get(item.sourceMaterialId),
      createdAt: item.updatedAt || item.createdAt,
    })),
    ...workspace.grammarNotes.map((item) => ({
      id: `grammar-${item.id}`,
      type: "语法",
      title: item.title,
      detail: item.explanationZh || item.explanationEn || item.sentence,
      sourceTitle: sourceTitleMap.get(item.sourceMaterialId),
      createdAt: item.updatedAt || item.createdAt,
    })),
    ...workspace.cultureNotes.map((item) => ({
      id: `culture-${item.id}`,
      type: "文化",
      title: item.title,
      detail: item.explanationZh || item.culturalContext || item.explanationEn,
      sourceTitle: sourceTitleMap.get(item.sourceMaterialId),
      createdAt: item.updatedAt || item.createdAt,
    })),
    ...workspace.feynmanNotes.map((note) => ({
      id: `feynman-${note.id}`,
      type: "费曼笔记",
      title: note.mainIdea || sourceTitleMap.get(note.sourceMaterialId) || "自己的解释",
      detail: note.ownWordsExplanation || note.userExplanation || note.personalConnection,
      sourceTitle: sourceTitleMap.get(note.sourceMaterialId),
      createdAt: note.updatedAt || note.createdAt,
    })),
  ]
    .filter((item) => item.createdAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function getStrongestGrowthArea(workspace: WorkspaceState) {
  const buckets = [
    { label: "词汇", count: workspace.vocabularyItems.length },
    { label: "表达", count: workspace.expressionItems.length },
    { label: "语法", count: workspace.grammarNotes.length },
    { label: "文化理解", count: workspace.cultureNotes.length },
    { label: "费曼笔记", count: workspace.feynmanNotes.length },
  ].sort((a, b) => b.count - a.count);

  return buckets[0];
}

function summarizeText(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();

  return normalized.length > 140 ? `${normalized.slice(0, 140)}…` : normalized || "";
}

function isToday(value: string) {
  const date = new Date(value);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
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
