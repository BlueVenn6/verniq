"use client";


import { useLearningUi } from "@/src/components/LanguageProvider";
type PublishExportActionsProps = {
  canExportPng: boolean;
  isSaving: boolean;
  isExporting: boolean;
  message: string;
  onCopyText: () => Promise<void>;
  onCopyMarkdown: () => Promise<void>;
  hasContent: boolean;
  onDownloadMarkdown: () => void;
  onExportPng: () => Promise<void>;
  onSaveTextDraft: () => void;
};

export function PublishExportActions({
  canExportPng,
  isSaving,
  isExporting,
  message,
  onCopyText,
  onCopyMarkdown,
  hasContent,
  onDownloadMarkdown,
  onExportPng,
  onSaveTextDraft,
}: PublishExportActionsProps) {
  const { t } = useLearningUi();
  return (
    <section aria-label={t("草稿操作")} className="publish-actions rounded-xl border border-stone-200 bg-[#fffaf0] p-3 shadow-sm">
      <div className="grid grid-cols-3 items-stretch gap-2">
        <button type="button" disabled={isSaving || !hasContent} onClick={onSaveTextDraft} className="min-h-11 rounded-lg bg-stone-900 px-2 py-2 text-center text-sm font-semibold text-white disabled:opacity-40">{isSaving ? t("保存中…") : t("保存草稿")}</button>
        <button type="button" disabled={!hasContent} onClick={onCopyText} className="min-h-11 rounded-lg border border-stone-300 px-2 py-2 text-center text-sm disabled:opacity-40">{t("复制纯文字")}</button>
        <details className="relative min-w-0" onClick={event => { if ((event.target as HTMLElement).closest("button")) event.currentTarget.open = false; }}>
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center gap-1 rounded-lg border border-stone-300 px-2 py-2 text-center text-sm">{t("导出")} <span aria-hidden="true">⌄</span></summary>
          <div className="absolute top-full right-0 z-20 mt-2 grid w-max min-w-full gap-1 rounded-xl border border-stone-300 bg-white p-2 shadow-lg">
            <button type="button" disabled={!hasContent} onClick={onCopyMarkdown} className="rounded-lg px-4 py-2 text-left text-sm hover:bg-stone-100 disabled:opacity-40">{t("复制 Markdown")}</button>
            <button type="button" disabled={!hasContent} onClick={onDownloadMarkdown} className="rounded-lg px-4 py-2 text-left text-sm hover:bg-stone-100 disabled:opacity-40">{t("下载 Markdown")}</button>
            {canExportPng ? <button type="button" disabled={isExporting || !hasContent} onClick={onExportPng} className="rounded-lg px-4 py-2 text-left text-sm hover:bg-stone-100 disabled:opacity-40">{isExporting ? t("正在生成 PNG…") : t("导出 PNG")}</button> : null}
          </div>
        </details>
      </div>

      {message ? <p className="mt-4 text-sm leading-7 text-stone-600">{t(message)}</p> : null}
    </section>
  );
}
