"use client";

import Link from "next/link";
import { useLearningUi } from "@/src/components/LanguageProvider";
import { useWorkspaceStore } from "@/src/lib/useWorkspaceStore";
import { getEffectiveSrsState, isSrsDue } from "@/src/lib/srs";

export function HomeWorkspaceHub() {
  const { workspace } = useWorkspaceStore();
  const { english } = useLearningUi();
  const latestSession = [...workspace.readingSessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .find((session) => workspace.sourceMaterials.some((source) => source.id === session.sourceMaterialId));
  const source = workspace.sourceMaterials.find((entry) => entry.id === latestSession?.sourceMaterialId)
    ?? [...workspace.sourceMaterials].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const dueCount = [...workspace.vocabularyItems, ...workspace.expressionItems]
    .filter((item) => item.status !== "ignored" && isSrsDue(getEffectiveSrsState(item))).length;
  const latestDraft = [...workspace.outputDrafts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const cards = source ? [
    { title: english ? "Continue reading" : "继续阅读", body: source.title,
      detail: `${latestSession ? Math.round(latestSession.progress * 100) : 0}%`,
      href: `/reader?source=${encodeURIComponent(source.id)}`, action: english ? "Resume" : "继续这篇材料" },
    { title: english ? "Due for review" : "到期复习", body: english ? `${dueCount} words and expressions due` : `${dueCount} 个词汇或表达到期`,
      detail: english ? "Recall first, then reveal and rate." : "先回忆，再揭示释义和评分。",
      href: "/review", action: english ? "Review" : "开始复习" },
    { title: english ? "Your writing" : "学习输出", body: latestDraft?.title ?? (english ? "Turn your notes into writing" : "把阅读笔记整理成自己的表达"),
      detail: english ? "Copy text or export Markdown." : "复制文字或导出 Markdown，直接带到别处使用。",
      href: "/publish", action: latestDraft ? (english ? "Open drafts" : "查看草稿") : (english ? "Create" : "整理输出") },
  ] : [];

  return <section className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
    <h2 className="text-xl font-semibold text-stone-950">{english ? "Pick up where you left off" : "接着上次的进度"}</h2>
    {source ? <div className="mt-5 grid gap-4 md:grid-cols-3">{cards.map((card) => (
      <article key={card.href} className="flex flex-col rounded-xl bg-[#fbfaf7] p-5">
        <h3 className="font-semibold text-stone-900">{card.title}</h3>
        <p className="mt-3 text-sm leading-7 text-stone-700">{card.body}</p>
        <p className="mt-2 flex-1 text-xs leading-6 text-stone-500">{card.detail}</p>
        <Link href={card.href} className="mt-4 w-fit rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold">{card.action}</Link>
      </article>
    ))}</div> : <div className="mt-5 space-y-4">
      <p className="text-sm leading-7 text-stone-600">{english ? "Start with an article you want to read. Save useful words, review them, then write something of your own." : "从一篇你想读的材料开始。读到有用的词就保存，复习后再写一段自己的理解。"}</p>
      <Link href="/inbox" className="brand-primary-button inline-flex px-5 py-3 text-sm">{english ? "Import your first material" : "导入第一篇材料"}</Link>
    </div>}
  </section>;
}
