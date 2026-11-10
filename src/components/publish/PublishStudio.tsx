"use client";


import { useLearningUi } from "@/src/components/LanguageProvider";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { markdownToPlainText } from "@/src/lib/publish/publishExport";
import { PublishExportActions } from "@/src/components/publish/PublishExportActions";
import { PublishFormatPicker } from "@/src/components/publish/PublishFormatPicker";
import { PublishPreview } from "@/src/components/publish/PublishPreview";
import { PublishSourcePicker } from "@/src/components/publish/PublishSourcePicker";
import { PublishVisualControls } from "@/src/components/publish/PublishVisualControls";
import { PublishAiComposer } from "@/src/components/publish/PublishAiComposer";
import {
  buildCustomPublishSource,
  buildPublishSources,
  buildPublishCardSvg,
  clearPublishDraftRecovery,
  copyTextToClipboard,
  createOutputDraftFromPublishDraft,
  DEFAULT_PUBLISH_SETTINGS,
  DEFAULT_VISUAL_SETTINGS,
  downloadMarkdown,
  exportSvgAsPng,
  formatDateForFileName,
  generateLocalPublishDraft,
  getPublishOutputDraftType,
  getPublishRatio,
  isPublishDraftDirty,
  readImageFileAsDataUrl,
  readLogoFileAsDataUrl,
  publishCardFits,
  readPublishDraftRecovery,
  validateShareCardText,
  writePublishDraftRecovery,
  type PublishDraftSettings,
  type PublishGeneratedDraft,
  type PublishVisualSettings,
  type PublishDraftRecovery,
} from "@/src/lib/publishStudio";
import { useUnsavedChangesGuard } from "@/src/lib/useUnsavedChangesGuard";
import { useWorkspaceStore } from "@/src/lib/useWorkspaceStore";
import { flushWorkspaceWrites } from "@/src/lib/workspace/writeQueue";

export function PublishStudio() {
  const { t } = useLearningUi();
  const { workspace, updateWorkspace } = useWorkspaceStore();
  const workspaceSources = useMemo(() => buildPublishSources(workspace), [workspace]);
  const [sourceChoiceIds, setSourceChoiceIds] = useState<string[] | null>(null);
  const search = useSyncExternalStore(subscribeToLocation, () => window.location.search, () => "");
  const requestedSourceId = new URLSearchParams(search).get("source");
  const defaultSource = workspaceSources.find((entry) => requestedSourceId && entry.sourceMaterialId === requestedSourceId) ?? workspaceSources[0];
  const selectedSourceIds = useMemo(() => sourceChoiceIds ?? (defaultSource ? [defaultSource.id] : []), [sourceChoiceIds, defaultSource]);
  const [customInput, setCustomInput] = useState("");
  const [settings, setSettings] = useState<PublishDraftSettings>(DEFAULT_PUBLISH_SETTINGS);
  const [visualSettings, setVisualSettings] =
    useState<PublishVisualSettings>(DEFAULT_VISUAL_SETTINGS);
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [imageName, setImageName] = useState("");
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const imageRequestRef = useRef(0);
  const [editedMarkdown, setEditedMarkdown] = useState<string | null>(null);
  const [editingDraftId, setEditingDraftId] = useState("");
  const [savedMarkdown, setSavedMarkdown] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [pendingAiDraft, setPendingAiDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [recoveredDraft, setRecoveredDraft] = useState(false);
  const [editorTab, setEditorTab] = useState<"sources" | "compose">("sources");
  const [recoveryUnavailable, setRecoveryUnavailable] = useState(false);
  const recoveryCheckedRef = useRef(false);
  const restoredRecoveryRef = useRef<PublishDraftRecovery | null>(null);
  const [hasDraftInput, setHasDraftInput] = useState(false);
  const draftRevisionRef = useRef(0);
  const markDraftChanged = () => { draftRevisionRef.current += 1; setHasDraftInput(true); };

  const selectedSources = useMemo(() => {
    const selected = workspaceSources.filter((source) => selectedSourceIds.includes(source.id));
    const customSource = buildCustomPublishSource(customInput, workspace.languageSettings.uiLanguage);

    return customSource ? [...selected, customSource] : selected;
  }, [customInput, selectedSourceIds, workspaceSources, workspace.languageSettings.uiLanguage]);
  const generatedDraft = useMemo(
    () => generateLocalPublishDraft({ sources: selectedSources, settings }),
    [selectedSources, settings],
  );
  const previewMarkdown = settings.mode === "card"
    ? [visualSettings.cardTitle?.trim() ? `# ${visualSettings.cardTitle.trim()}` : "", visualSettings.cardText || ""].filter(Boolean).join("\n\n")
    : editedMarkdown ?? generatedDraft.markdown;
  const draftIsDirty = hasDraftInput || isPublishDraftDirty(
    settings.mode === "card" ? (savedMarkdown !== null ? previewMarkdown : null) : editedMarkdown ?? (hasDraftInput ? previewMarkdown : null), savedMarkdown,
  );
  useUnsavedChangesGuard({
    enabled: draftIsDirty && recoveryUnavailable,
    message: t(recoveryUnavailable
      ? "恢复副本不可用，离开页面可能丢失修改。请先复制或下载草稿。"
      : "当前草稿有未保存的修改，离开页面会保留恢复副本。") as string,
  });

  const restoreDraft = useCallback((recovery: PublishDraftRecovery) => {
    restoredRecoveryRef.current = recovery;
    setSourceChoiceIds(recovery.sourceChoiceIds);
    setCustomInput(recovery.customInput);
    setSettings(recovery.settings);
    setVisualSettings(recovery.settings.mode === "card" && recovery.visualSettings.cardText === undefined
      ? { ...recovery.visualSettings, cardTitle: createCardDraftFromMarkdown(generatedDraft, recovery.markdown).title, cardText: createCardDraftFromMarkdown(generatedDraft, recovery.markdown).body }
      : recovery.visualSettings);
    setEditedMarkdown(recovery.markdown);
    setEditingDraftId(recovery.draftId);
    setSavedMarkdown(recovery.savedMarkdown);
    setHasDraftInput(true);
    setRecoveredDraft(true);
    setMessage("");
  }, [generatedDraft]);

  useEffect(() => {
    if (recoveryCheckedRef.current) return;
    recoveryCheckedRef.current = true;
    const recovery = readPublishDraftRecovery();
    // Client-only persistence must hydrate after the static HTML has mounted.
    // This runs once; it does not derive React state from changing props.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (recovery) restoreDraft(recovery);
  }, [restoreDraft]);

  useEffect(() => {
    if (!draftIsDirty || !recoveryCheckedRef.current) return;

    const saved = writePublishDraftRecovery({
      markdown: previewMarkdown,
      draftId: editingDraftId,
      sourceChoiceIds: selectedSourceIds,
      customInput,
      settings,
      visualSettings,
      savedMarkdown,
    });
    setRecoveryUnavailable(!saved);
  }, [customInput, draftIsDirty, editedMarkdown, editingDraftId, savedMarkdown, selectedSourceIds, settings, visualSettings, previewMarkdown]);

  const cardDraft = useMemo(
    () => settings.mode === "card" ? { title: visualSettings.cardTitle?.trim() || "", body: visualSettings.cardText || "", subtitle: "", sourceLabel: "", markdown: previewMarkdown } : createCardDraftFromMarkdown(generatedDraft, previewMarkdown),
    [previewMarkdown, generatedDraft, settings.mode, visualSettings.cardTitle, visualSettings.cardText],
  );
  const ratio = getPublishRatio(visualSettings.ratioId);
  const needsImage = visualSettings.layout !== "pure_text";
  const cardWarning =
    settings.mode === "card"
      ? [
          validateShareCardText({
            title: cardDraft.title,
            body: cardDraft.body,
            ratio,
          }).ok ? "" : validateShareCardText({ title: cardDraft.title, body: cardDraft.body, ratio }).message,
          needsImage && !imageDataUrl
            ? t("请为所选图文版式上传配图，或切回纯文字。")
            : "",
        ].filter(Boolean).map((part) => t(part)).join(" ")
      : "";
  const cardRenderInput = {
    ratio,
    layout: visualSettings.layout,
    imageCrop: visualSettings.imageCrop,
    brandMode: visualSettings.brandMode,
    title: cardDraft.title,
    subtitle: cardDraft.subtitle,
    body: cardDraft.body,
    footer: cardDraft.sourceLabel,
    imageDataUrl,
    imageWidth: imageSize?.width,
    imageHeight: imageSize?.height,
    imageZoom: visualSettings.imageZoom,
    imagePositionX: visualSettings.imagePositionX,
    imagePositionY: visualSettings.imagePositionY,
    customName: visualSettings.customName,
    logoDataUrl: visualSettings.logoDataUrl,
    fontFamily: visualSettings.fontFamily,
    fontScale: visualSettings.fontScale,
    fontWeight: visualSettings.fontWeight,
    textAlign: visualSettings.textAlign,
    emptyMessage: t("请在左侧填写一句金句、重点词或简短感受；内容过长时请先精简。"),
  };
  const cardSvg = buildPublishCardSvg(cardRenderInput);
  const cardFits = publishCardFits(cardRenderInput);
  const cardCanExport = Boolean(cardDraft.body.trim()) && (!needsImage || Boolean(imageDataUrl)) && validateShareCardText({ title: cardDraft.title, body: cardDraft.body, ratio }).ok && cardFits;

  const toggleSource = (sourceId: string) => {
    markDraftChanged();
    setSourceChoiceIds(
      selectedSourceIds.includes(sourceId)
        ? selectedSourceIds.filter((id) => id !== sourceId)
        : [...selectedSourceIds, sourceId],
    );
  };

  const handleImageChange = async (file: File | null) => {
    const request = ++imageRequestRef.current;
    if (!file) {
      markDraftChanged();
      setImageDataUrl("");
      setImageName("");
      setImageSize(null);
      return;
    }

    try {
      const dataUrl = await readImageFileAsDataUrl(file);
      const bitmap = await createImageBitmap(file);
      const size = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      if (request !== imageRequestRef.current) return;
      markDraftChanged();
      if (imageDataUrl) setVisualSettings(current => ({ ...current, imageZoom: 1, imagePositionX: 0.5, imagePositionY: 0.5, imageCrop: "center" }));
      setImageSize(size);
      setImageDataUrl(dataUrl);
      setImageName(file.name);
      setMessage("图片已加入卡片预览。");
    } catch (error) {
      if (request !== imageRequestRef.current) return;
      setMessage(error instanceof Error ? error.message : "图片读取失败，请重新选择。");
    }
  };

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(markdownToPlainText(previewMarkdown));
    setMessage(ok ? "文字已复制。" : "无法复制文字，请手动选择后复制。");
  };

  const handleCopyMarkdown = async () => {
    const ok = await copyTextToClipboard(previewMarkdown);
    setMessage(ok ? "Markdown 已复制。" : "无法复制文字，请手动选择后复制。");
  };

  const handleDownloadMarkdown = () => {
    downloadMarkdown(`verniq-publish-${formatDateForFileName(new Date())}.md`, previewMarkdown);
    setMessage("Markdown 已开始下载。");
  };

  const handleExportPng = async () => {
    if (isExporting) return;
    if (!cardCanExport) { setMessage("请先填写简短卡片内容，并按提示精简后再导出。"); return; }
    setIsExporting(true);
    setMessage("正在生成 PNG，请稍候…");
    try {
      await exportSvgAsPng({
        svg: cardSvg,
        ratio,
        fileName: `verniq-card-${visualSettings.ratioId.replace(":", "x")}-${formatDateForFileName(new Date())}.png`,
      });
      setMessage("PNG 已交给浏览器下载，请在下载列表中查看。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "PNG 导出失败，请稍后重试。");
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveDraft = async () => {
    // Even when durable writes are paused, retain this latest revision in the
    // shared in-memory workspace so Download recovery includes what is visible.
    // persistWorkspace still rejects the durable write while paused.
    setIsSaving(true);
    const revision = draftRevisionRef.current;

    const newDraft = createOutputDraftFromPublishDraft({
      draft: {
        ...cardDraft,
        markdown: previewMarkdown,
      },
      sources: selectedSources,
      outputType: getPublishOutputDraftType(settings.mode),
    });

    const existing = workspace.outputDrafts.find((draft) => draft.id === editingDraftId);
    const outputDraft = existing
      ? { ...existing, sourceMaterialId: newDraft.sourceMaterialId, feynmanNoteId: newDraft.feynmanNoteId, outputType: newDraft.outputType, title: cardDraft.title, content: previewMarkdown, updatedAt: new Date().toISOString() }
      : newDraft;
    outputDraft.publishVisualSettings = settings.mode === "card" ? visualSettings : undefined;
    outputDraft.publishDraftSettings = settings;
    outputDraft.publishSourceChoiceIds = selectedSourceIds;
    outputDraft.publishCustomInput = customInput;
    updateWorkspace((current) => ({
      outputDrafts: existing
        ? current.outputDrafts.map((draft) => draft.id === existing.id ? outputDraft : draft)
        : [outputDraft, ...current.outputDrafts],
    }));
    setEditingDraftId(outputDraft.id);
    try {
      await flushWorkspaceWrites();
      setSavedMarkdown(previewMarkdown);
      if (revision === draftRevisionRef.current) setHasDraftInput(false);
      if (revision === draftRevisionRef.current) clearPublishDraftRecovery(previewMarkdown);
      const restored = restoredRecoveryRef.current;
      if (restored?.storageKey) clearPublishDraftRecovery(restored.markdown, restored.storageKey);
      restoredRecoveryRef.current = null;
      setMessage("草稿已保存，包含所选材料、创作设置、卡片文字和署名。配图需重新选择。");
    } catch {
      setMessage(recoveryUnavailable
        ? "草稿保存失败，恢复副本也不可用。请勿关闭页面，立即复制或下载草稿。"
        : "草稿保存失败，编辑内容和恢复副本仍保留。请检查工作区保存状态。");
    } finally {
      setIsSaving(false);
    }
  };

  const confirmReplaceDraft = () =>
    !draftIsDirty ||
    window.confirm(t("当前草稿有未保存的修改，继续会丢失这些修改。是否继续？") as string);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl text-stone-950">{t("把理解整理成可分享的内容")}</h1>
          <p className="mt-1 text-sm text-stone-600">{t("左侧选材料、与 AI 创作，右侧编辑，再复制或导出。")}</p>
        </div>
        {recoveredDraft ? <p role="status" className="text-xs text-stone-600">{t("已接续上次草稿，可直接编辑。")}{settings.mode === "card" ? t("配图需重新选择。") : ""}</p> : null}
      </header>
      {recoveryUnavailable ? <p role="alert" className="text-sm text-red-800">{t("恢复副本不可用，离开页面可能丢失修改。请先复制或下载草稿。")}</p> : null}
      {workspace.outputDrafts.length > 0 ? (
        <details aria-label={t("已保存的草稿")} className="text-sm">
          <summary className="w-fit cursor-pointer text-stone-700">{t("已保存的草稿")} ({workspace.outputDrafts.length})</summary>
          <div className="mt-3 flex flex-wrap gap-2">
            {[...workspace.outputDrafts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((draft) => (
              <button key={draft.id} type="button" onClick={() => {
                if (!confirmReplaceDraft()) return;
                clearPublishDraftRecovery();
                const discarded = restoredRecoveryRef.current;
                if (discarded?.storageKey) clearPublishDraftRecovery(discarded.markdown, discarded.storageKey);
                restoredRecoveryRef.current = null;
                setRecoveredDraft(false);
                imageRequestRef.current += 1;
                setImageDataUrl(""); setImageName(""); setImageSize(null);
                draftRevisionRef.current += 1;
                setEditingDraftId(draft.id);
                setHasDraftInput(false);
                setEditedMarkdown(draft.content);
                setSavedMarkdown(draft.content);
                const savedChoices = draft.publishSourceChoiceIds;
                setSourceChoiceIds(savedChoices
                  ? savedChoices.flatMap(id => {
                    const source = workspaceSources.find(source => source.id === id || source.id.replace(/^current_material:/, "material:") === id.replace(/^current_material:/, "material:"));
                    return source ? [source.id] : [];
                  })
                  : workspaceSources.filter(source => source.sourceMaterialId === draft.sourceMaterialId).map(source => source.id));
                setCustomInput(draft.publishCustomInput || "");
                setPendingAiDraft("");
                setSettings((current) => ({ ...(draft.publishDraftSettings || current), mode: draft.publishVisualSettings ? "card" : "text" }));
                if (draft.publishVisualSettings) setVisualSettings(draft.publishVisualSettings);
                setMessage(`${t("正在编辑：")}${draft.title}`);
              }} className="rounded-md border border-stone-300 bg-white px-3 py-2 text-left text-sm text-stone-800 hover:border-stone-500">
                {draft.title || t("未命名草稿")}
              </button>
            ))}
          </div>
        </details>
      ) : null}

      <div className="publish-workbench grid gap-5 min-[900px]:grid-cols-[minmax(0,0.92fr)_minmax(0,1fr)]">
        <div className="publish-controls min-w-0">
          <div role="tablist" aria-label={t("创作步骤")} className="mb-3 flex flex-wrap gap-2">
            <button type="button" role="tab" aria-selected={editorTab === "sources"} onClick={() => setEditorTab("sources")} className={`rounded-lg px-4 py-2 text-sm ${editorTab === "sources" ? "bg-stone-900 text-white" : "border border-stone-300"}`}>{t("材料与形式")}</button>
            <button type="button" role="tab" aria-selected={editorTab === "compose"} onClick={() => setEditorTab("compose")} className={`rounded-lg px-4 py-2 text-sm ${editorTab === "compose" ? "bg-stone-900 text-white" : "border border-stone-300"}`}>{settings.mode === "card" ? t("卡片样式") : t("AI 创作")}</button>
          </div>
          <div hidden={editorTab !== "sources"} className="space-y-4">

          <PublishSourcePicker
            sources={workspaceSources}
            selectedSourceIds={selectedSourceIds}
            customInput={settings.mode === "card" ? visualSettings.cardText || "" : customInput}
            cardMode={settings.mode === "card"}
            onToggleSource={toggleSource}
            onCustomInputChange={(value) => { markDraftChanged(); if (settings.mode === "card") setVisualSettings((current) => ({ ...current, cardText: value })); else setCustomInput(value); }}
          />
          <PublishFormatPicker
            mode={settings.mode}
            purpose={settings.mode === "card" ? visualSettings.cardTitle || "" : settings.purpose}
            audience={settings.audience}
            onChange={(patch) => {
              markDraftChanged();
              if (patch.mode && patch.mode !== settings.mode) { setEditingDraftId(""); setSavedMarkdown(null); }
              if (settings.mode === "card" && patch.purpose !== undefined) setVisualSettings((current) => ({ ...current, cardTitle: patch.purpose }));
              else setSettings((current) => ({ ...current, ...patch }));
            }}
          />
          </div>
          <div hidden={editorTab !== "compose"} className="space-y-4">
          {settings.mode === "text" ? <PublishAiComposer workspace={workspace} sources={selectedSources} topic={settings.purpose || selectedSources[0]?.title || ""} onTopicChange={purpose => { markDraftChanged(); setSettings(current => ({ ...current, purpose })); }} currentDraft={previewMarkdown}
            options={settings} onOptionsChange={(patch) => { markDraftChanged(); setSettings((current) => ({ ...current, ...patch })); }}
            getRevision={() => draftRevisionRef.current}
            onApply={(markdown, expectedRevision) => {
              if (draftRevisionRef.current !== expectedRevision) { setPendingAiDraft(markdown); return; }
              markDraftChanged(); setEditedMarkdown(markdown); setMessage("AI 草稿已放入编辑区，可继续添加和修改自己的观点。");
            }} /> : null}
          {pendingAiDraft && settings.mode === "text" ? <section className="space-y-3 rounded-xl border border-amber-300 p-4">
            <p className="text-sm">{t("AI 生成期间你修改了草稿或材料。结果已保留，请对比后手动采用，当前编辑未被覆盖。")}</p>
            <textarea aria-label={t("待采用的 AI 草稿")} readOnly value={pendingAiDraft} rows={8} className="w-full rounded-lg border p-3 text-sm" />
            <button type="button" onClick={() => { if (!confirmReplaceDraft()) return; markDraftChanged(); setEditedMarkdown(pendingAiDraft); setPendingAiDraft(""); }} className="text-sm underline">{t("采用这份 AI 草稿")}</button>
          </section> : null}
          <PublishVisualControls
            enabled={settings.mode === "card"}
            settings={visualSettings}
            imageName={imageName}
            onChange={(patch) => { markDraftChanged(); setVisualSettings((current) => ({ ...current, ...patch })); }}
            onImageChange={handleImageChange}
            onLogoChange={async (file) => {
              try { const logoDataUrl = file ? await readLogoFileAsDataUrl(file) : ""; markDraftChanged(); setVisualSettings((current) => ({ ...current, logoDataUrl })); }
              catch (error) { setMessage(error instanceof Error ? error.message : "图片读取失败。"); }
            }}
          />
          {settings.mode === "text" ? <button
            type="button"
            onClick={() => {
              if (!confirmReplaceDraft()) return;
              markDraftChanged();
              setEditedMarkdown(generatedDraft.markdown);
              setEditingDraftId("");
              setSavedMarkdown(null);
              setMessage("草稿已根据当前设置重新整理。");
            }}
            className="w-full rounded-[1.25rem] border border-stone-200 bg-[#fffaf0] px-5 py-4 text-left text-sm font-semibold text-stone-900 shadow-sm shadow-stone-200/60 transition hover:border-stone-300"
          >
            {t("用当前材料新建草稿")}<span className="mt-1 block text-xs font-normal leading-6 text-stone-500">
              {t("保留选中内容全文，不调用 AI；生成后可直接编辑、复制或下载。")}</span>
          </button> : null}
          </div>
        </div>

        <div className="publish-output min-w-0">
          <PublishExportActions
            canExportPng={settings.mode === "card" && cardCanExport}
            isSaving={isSaving}
            isExporting={isExporting}
            message={message}
            onCopyText={handleCopy}
            onCopyMarkdown={handleCopyMarkdown}
            hasContent={Boolean(previewMarkdown.trim())}
            onDownloadMarkdown={handleDownloadMarkdown}
            onExportPng={handleExportPng}
            onSaveTextDraft={handleSaveDraft}
          />
        <PublishPreview
          mode={settings.mode}
          ratio={ratio}
          visualSettings={visualSettings}
          imageSize={imageSize}
          onImageTransformChange={patch => { markDraftChanged(); setVisualSettings(current => ({ ...current, ...patch })); }}
          draft={cardDraft}
          svg={cardSvg}
          cardWarning={[cardWarning, !cardFits ? t("当前字号或文字长度超出卡片，请缩小字号、精简内容或更换版式。") : ""].filter(Boolean).join(" ")}
          editedMarkdown={previewMarkdown}
          onEditedMarkdownChange={(value) => { markDraftChanged(); setEditedMarkdown(value); }}
        />

        </div>
      </div>
    </div>
  );
}

function createCardDraftFromMarkdown(
  fallback: PublishGeneratedDraft,
  markdown: string,
): PublishGeneratedDraft {
  const lines = markdown.split(/\r?\n/).map((line) => line.trim());
  const heading = lines.find((line) => line.startsWith("# "));
  const title = heading?.replace(/^#\s+/, "").trim() || fallback.title;
  const body = lines
    .filter((line) => line && !line.startsWith("# ") && !line.startsWith("来源："))
    .join("\n")
    .trim();

  return {
    ...fallback,
    title,
    body,
    markdown,
  };
}

function subscribeToLocation(listener: () => void) {
  window.addEventListener("popstate", listener);
  return () => window.removeEventListener("popstate", listener);
}
