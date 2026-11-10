"use client";


import { useLearningUi } from "@/src/components/LanguageProvider";
import type { PublishGeneratedDraft, PublishMode, PublishRatio, PublishVisualSettings } from "@/src/lib/publish/publishPresets";
import { PublishCardPreview } from "./PublishCardPreview";
import { useEffect, useRef, useState } from "react";

type PublishPreviewProps = {
  mode: PublishMode;
  draft: PublishGeneratedDraft;
  svg: string;
  cardWarning: string;
  editedMarkdown: string;
  onEditedMarkdownChange: (value: string) => void;
  ratio: PublishRatio;
  visualSettings: PublishVisualSettings;
  imageSize: { width: number; height: number } | null;
  onImageTransformChange: (patch: Partial<PublishVisualSettings>) => void;
};

export function PublishPreview({
  mode,
  draft,
  svg,
  cardWarning,
  editedMarkdown,
  onEditedMarkdownChange,
  ratio, visualSettings, imageSize, onImageTransformChange,
}: PublishPreviewProps) {
  const { t } = useLearningUi();
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const resize = () => { editor.style.height = "0px"; editor.style.height = `${Math.max(editor.scrollHeight + 2, Math.min(window.innerHeight * 0.6, 640), 360)}px`; };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [editedMarkdown, mode, expanded]);
  useEffect(() => {
    if (!expanded) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setExpanded(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [expanded]);
  return (
    <section className={`publish-preview min-w-0 rounded-xl border border-stone-200 bg-[#fffaf0] p-4 ${expanded ? "publish-editor-expanded" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
        <h2 className="mt-2 text-xl font-semibold text-stone-950">{t(mode === "card" ? "卡片预览" : "编辑输出内容")}</h2>
        <p className="mt-1 text-xs leading-6 text-stone-600">{t(mode === "card" ? "在左侧编辑内容和样式，预览会同步更新。" : "在正文中直接修改；长文会自动展开。")}</p>
        </div>
        {mode === "text" ? <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)} className="shrink-0 rounded-lg border border-stone-300 px-3 py-2 text-sm">{expanded ? t("收起编辑") : t("展开编辑")}</button> : null}
      </div>

      {mode === "card" ? (
        <div className="mt-5 space-y-4">
          <PublishCardPreview svg={svg} ratio={ratio} settings={visualSettings} imageSize={imageSize} onImageTransformChange={onImageTransformChange} />
          {cardWarning ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-800">
              {t(cardWarning)}
            </p>
          ) : null}
          <p className="text-xs leading-6 text-stone-500">
            {t("卡片内容在左侧编辑；署名和 Logo 会随草稿保存。配图需重新选择。PNG 按所选比例导出。")}</p>
        </div>
      ) : null}

      {mode !== "card" ? <div className="publish-text-editor mt-3">
        <label className="block">
          <span className="text-sm font-semibold text-stone-700">{t("标题")}</span>
          <input
            aria-label={t("标题")}
            value={draft.title}
            onChange={(event) => onEditedMarkdownChange(editedMarkdown.match(/^# [^\n]*\n?/) ? editedMarkdown.replace(/^# [^\n]*/, `# ${event.target.value}`) : `# ${event.target.value}\n\n${editedMarkdown}`)}
            className="mt-2 w-full rounded-xl border border-stone-200 bg-white/80 px-4 py-3 text-sm text-stone-800"
          />
        </label>
        <label className="publish-text-body mt-3 block">
          <span className="text-sm font-semibold text-stone-700">{t("草稿内容")}</span>
          <textarea
            ref={editorRef}
            aria-label={t("草稿内容")}
            value={editedMarkdown}
            onChange={(event) => onEditedMarkdownChange(event.target.value)}
            rows={18}
            className="mt-2 min-h-96 w-full resize-none rounded-xl border border-stone-200 bg-white px-4 py-3 text-base leading-8 text-stone-800"
          />
        </label>
      </div> : null}
    </section>
  );
}
