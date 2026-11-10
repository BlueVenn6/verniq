"use client";


import { useLearningUi } from "@/src/components/LanguageProvider";
import type { PublishDraftSettings, PublishMode } from "@/src/lib/publish/publishPresets";

type PublishFormatPickerProps = {
  mode: PublishMode;
  purpose: string;
  audience: string;
  onChange: (patch: Partial<PublishDraftSettings>) => void;
};

const formats: Array<{
  id: PublishMode;
  title: string;
  description: string;
}> = [
  {
    id: "text",
    title: "文字草稿",
    description: "整理成可继续编辑的文章、笔记或分享文字。",
  },
  {
    id: "card",
    title: "分享卡片",
    description: "生成一张排版克制的视觉卡片，可导出 PNG。",
  },
];

export function PublishFormatPicker({
  mode,
  purpose,
  onChange,
}: PublishFormatPickerProps) {
  const { t } = useLearningUi();
  return (
    <section className="rounded-[1.25rem] border border-stone-200 bg-white p-5 shadow-sm shadow-stone-200/60">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">{t("选择形式")}</p>
        <h2 className="mt-2 text-xl font-semibold text-stone-950">{t("确定输出方向")}</h2>
        <p className="mt-2 text-sm leading-7 text-stone-600">
          {mode === "card" ? t("卡片只呈现一个重点，文字过长时需精简后导出。") : t("多选材料后可用 AI 综合观点，也可以手动编辑、复制和导出。")}</p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {formats.map((format) => {
          const active = mode === format.id;

          return (
            <button
              key={format.id}
              type="button"
              onClick={() => onChange({ mode: format.id })}
              className={`rounded-xl border p-4 text-left transition ${
                active
                  ? "border-stone-900 bg-stone-900 text-white"
                  : "border-stone-200 bg-[#fbfaf7] text-stone-700 hover:border-stone-300"
              }`}
            >
              <span className="text-sm font-semibold">{t(format.title)}</span>
              <span className={`mt-2 block text-xs leading-6 ${active ? "text-stone-200" : "text-stone-500"}`}>
                {t(format.description)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 grid gap-4">
        <label className="block">
          <span className="text-sm font-semibold text-stone-700">{t("标题（可选）")}</span>
          <input
            aria-label={t("标题（可选）")}
            value={purpose}
            onChange={(event) => onChange({ purpose: event.target.value })}
            className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3 text-sm text-stone-800"
            placeholder={mode === "card" ? t("卡片标题可留空，突出正文即可") : t("留空时使用所选材料的标题")}
          />
        </label>
      </div>
    </section>
  );
}
