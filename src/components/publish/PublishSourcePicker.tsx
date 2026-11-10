"use client";


import { useLearningUi } from "@/src/components/LanguageProvider";
import { useState } from "react";
import type { PublishSource } from "@/src/lib/publish/publishSources";

type PublishSourcePickerProps = {
  sources: PublishSource[];
  selectedSourceIds: string[];
  customInput: string;
  onToggleSource: (sourceId: string) => void;
  onCustomInputChange: (value: string) => void;
  cardMode?: boolean;
};

export function PublishSourcePicker({
  sources,
  selectedSourceIds,
  customInput,
  onToggleSource,
  onCustomInputChange,
  cardMode = false,
}: PublishSourcePickerProps) {
  const { t } = useLearningUi();
  const [query, setQuery] = useState("");
  const matchingSources = sources.filter((source) => `${source.title} ${source.summary}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return (
    <section className="rounded-[1.25rem] border border-stone-200 bg-white p-5 shadow-sm shadow-stone-200/60">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">{t("选择内容")}</p>
        <h2 className="mt-2 text-xl font-semibold text-stone-950">{t("选择材料与笔记")}</h2>
        <p className="mt-2 text-sm leading-7 text-stone-600">
          {cardMode ? t("材料仅供参考。请在卡片内容中摘录金句、重点词、短段落或自己的感受，不会自动放入全文。") : t("可以选择工作区内容，也可以直接写入自己的观点。")}</p>
      </div>

      {sources.length > 0 ? <input value={query} onChange={(event) => setQuery(event.target.value)}
        aria-label={t("搜索材料与笔记")} placeholder={t("搜索材料与笔记")}
        className="mt-4 w-full rounded-lg border border-stone-300 p-2 text-sm" /> : null}
      <div className="mt-5 max-h-[32rem] space-y-3 overflow-y-auto">
        {sources.length ? (
          matchingSources.map((source) => {
            const active = selectedSourceIds.includes(source.id);

            return (
              <button
                key={source.id}
                type="button"
                onClick={() => onToggleSource(source.id)}
                className={`w-full rounded-xl border p-4 text-left transition ${
                  active
                    ? "border-stone-900 bg-stone-900 text-white"
                    : "border-stone-200 bg-[#fbfaf7] text-stone-700 hover:border-stone-300"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold opacity-70">{t(source.label)}</p>
                    <p className="mt-1 text-sm font-semibold">{source.title}</p>
                  </div>
                  <span className="rounded-full border border-current/20 px-2 py-1 text-xs">
                    {active ? t("已选") : t("选择")}
                  </span>
                </div>
                <p className={`mt-2 text-xs leading-6 ${active ? "text-stone-200" : "text-stone-500"}`}>
                  {source.summary || t("暂无摘要。")}
                </p>
              </button>
            );
          })
        ) : (
          <div className="rounded-xl border border-dashed border-stone-200 bg-[#fbfaf7] p-4 text-sm leading-7 text-stone-600">
            {t("工作区里还没有可用于发布的材料。可以先在下方输入自己的内容。")}</div>
        )}
      </div>
      {sources.length > 0 && !matchingSources.length ? <p className="mt-3 text-sm text-stone-500">{t("没有匹配的材料或笔记。")}</p> : null}

      <label className="mt-5 block">
        <span className="text-sm font-semibold text-stone-700">{cardMode ? t("卡片内容") : t("自定义输入")}</span>
        <textarea
          aria-label={cardMode ? t("卡片内容") : t("自定义输入")}
          value={customInput}
          onChange={(event) => onCustomInputChange(event.target.value)}
          rows={5}
          className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3 text-sm leading-7 text-stone-800"
          placeholder={cardMode ? t("输入想分享的一句金句、重点单词及释义、一小段文字，或自己的感受。请勿粘贴整篇文章。") : t("粘贴选中文本、个人观点、笔记片段或想分享的主题。")}
        />
      </label>
    </section>
  );
}
