"use client";

import { useLearningUi } from "@/src/components/LanguageProvider";
import { deriveInboxTitle, getInputMethodLabel } from "@/src/lib/inbox";
import type {
  ContentInputMethod,
  CategoryConfig,
  InboxDraft,
  SourceTypeConfig,
} from "@/src/lib/types";
import type { ImageTextExtractionRouteStatus } from "@/src/lib/imageTextExtraction";

type InboxPreviewCardProps = {
  draft: InboxDraft;
  inputView?: ContentInputMethod | "image_pending";
  imageDataUrl?: string;
  imageExtractedText?: string;
  imageRouteStatus?: ImageTextExtractionRouteStatus;
  sourceTypeConfigs: SourceTypeConfig[];
  categoryConfigs: CategoryConfig[];
};

export function InboxPreviewCard({
  draft,
  inputView = draft.inputMethod,
  imageDataUrl = "",
  imageExtractedText = "",
  imageRouteStatus,
  sourceTypeConfigs,
  categoryConfigs,
}: InboxPreviewCardProps) {
  const { t } = useLearningUi();
  const sourceName =
    sourceTypeConfigs.find((item) => item.id === draft.sourceTypeId)?.name || t("尚未选择");
  const categoryNames = draft.categoryIds.map(
    (id) => categoryConfigs.find((item) => item.id === id)?.name ?? id,
  );
  const textPreview =
    inputView === "image_pending"
      ? imageExtractedText.trim()
      : (draft.rawContent || draft.summary || "").trim();
  const hasImmediateText = Boolean(textPreview);
  const title = draft.title.trim() || t(deriveInboxTitle(draft));
  const readerState = getReaderStateLabel(draft, inputView, hasImmediateText, imageRouteStatus);
  const sourceReferenceLabel = getReferenceLabel(inputView);

  return (
    <aside className="mt-3">
      <div className="space-y-3">
        <PreviewBlock label={t("材料标题")} value={title} />
        <PreviewBlock label={t("阅读状态")} value={t(readerState)} />
        <PreviewBlock label={t("导入方式")} value={t(getInputMethodLabelForView(inputView))} />
        {inputView === "image_pending" && imageDataUrl ? (
          <div className="overflow-hidden rounded-3xl bg-[#fbfaf7] p-3">
            <p className="text-xs font-semibold text-stone-500">{t("图片预览")}</p>
            <div
              role="img"
              aria-label={t("待识别图片预览")}
              className="mt-3 h-48 w-full bg-contain bg-center bg-no-repeat"
              style={{ backgroundImage: `url("${imageDataUrl}")` }}
            />
          </div>
        ) : null}
        {inputView === "image_pending" ? (
          <PreviewBlock
            label={t("识别状态")}
            value={t(getImagePreviewStatus(imageRouteStatus, imageExtractedText))}
          />
        ) : null}
        {draft.sourceReference && inputView !== "image_pending" ? (
          <PreviewBlock label={sourceReferenceLabel} value={draft.sourceReference} />
        ) : null}
        {inputView === "file_upload" && draft.sourceFileExt ? (
          <PreviewBlock label={t("文件格式")} value={draft.sourceFileExt.toUpperCase()} />
        ) : null}
        <PreviewBlock label={t("材料类型")} value={t(sourceName)} />
        <PreviewBlock label={t("学习语言")} value={t(draft.originalLanguage === "zh" ? "中文 · Chinese" : "英语")} />
        <PreviewBlock
          label={t("正文预览")}
          value={
            hasImmediateText
              ? textPreview.slice(0, 240)
              : t(getPreviewEmptyText(inputView))
          }
        />
        <PreviewTags label={t("兴趣分类")} items={categoryNames} />
      </div>
    </aside>
  );
}

function PreviewBlock({ label, value }: { label: string; value: string }) {
  const { t } = useLearningUi();
  return (
    <div className="border-b border-stone-200 pb-2">
      <p className="text-xs font-semibold text-stone-500">{t(label)}</p>
      <p className="mt-1 text-sm leading-6 text-stone-700">{value}</p>
    </div>
  );
}

function PreviewTags({ label, items }: { label: string; items: string[] }) {
  const { t } = useLearningUi();
  return (
    <div>
      <p className="text-xs font-semibold text-stone-500">{t(label)}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.length ? (
          items.map((item) => (
            <span
              key={`${label}-${item}`}
              className="rounded-full border border-stone-200 bg-[#fbfaf7] px-3 py-1 text-xs text-stone-600"
            >
              {t(item)}
            </span>
          ))
        ) : (
          <span className="rounded-full border border-stone-200 bg-[#fbfaf7] px-3 py-1 text-xs text-stone-500">
            {t("暂时为空")}</span>
        )}
      </div>
    </div>
  );
}

function getReaderStateLabel(
  draft: InboxDraft,
  inputView: ContentInputMethod | "image_pending",
  hasImmediateText: boolean,
  imageRouteStatus?: ImageTextExtractionRouteStatus,
) {
  if (inputView === "image_pending") {
    if (hasImmediateText) return "已提取文字，确认后会打开阅读器。";
    if (imageRouteStatus?.ok) return "选择图片后，可以确认并提取文字。";

    return "尚未配置支持图片的模型。请先在设置中选择并验证视觉模型。";
  }

  if (draft.inputMethod === "title_only") {
    return "只保存待补材料；不会进入阅读器正文。";
  }

  if (inputView === "direct_paste") {
    return hasImmediateText ? "已有正文，导入后可在阅读器中查看。" : "粘贴正文后，这里会显示预览。";
  }

  if (inputView === "url" && draft.sourceReference.trim()) {
    return "点击导入后会尝试提取正文；提取成功后会打开阅读器。";
  }

  if (inputView === "file_upload" && draft.sourceReference.trim()) {
    return "点击导入后会提取正文；提取成功后会打开阅读器。";
  }

  return "请选择文档、添加链接或粘贴正文。";
}

function getInputMethodLabelForView(inputView: ContentInputMethod | "image_pending") {
  if (inputView === "image_pending") return "上传图片";

  return getInputMethodLabel(inputView);
}

function getReferenceLabel(inputView: ContentInputMethod | "image_pending") {
  if (inputView === "url") return "链接地址";
  if (inputView === "file_upload" || inputView === "local_asset") return "文件名";

  return "来源";
}

function getPreviewEmptyText(inputView: ContentInputMethod | "image_pending") {
  if (inputView === "direct_paste") {
    return "粘贴正文后，这里会显示预览。";
  }

  if (inputView === "url") {
    return "添加链接后，点击导入会尝试提取正文；如果失败，会显示具体原因。";
  }

  if (inputView === "file_upload" || inputView === "local_asset") {
    return "选择文档后，点击导入会尝试提取正文；扫描版 PDF 或受保护文件可能无法提取。";
  }

  return "选择图片并提取文字后，这里会显示可编辑的正文预览。";
}

function getImagePreviewStatus(
  routeStatus?: ImageTextExtractionRouteStatus,
  imageExtractedText = "",
) {
  if (imageExtractedText.trim()) return "已提取文字，确认后会导入阅读器。";
  if (!routeStatus) return "尚未配置支持图片的模型。";
  if (!routeStatus.ok || !routeStatus.provider || !routeStatus.model) return routeStatus.message;

  const scope = routeStatus.serviceScope === "local" ? "本机服务" : "外部服务";
  const status = routeStatus.model.capabilityVerification?.image === "verified"
    ? "已验证"
    : "未验证";

  return `${scope} · ${routeStatus.provider.name} · 模型 ID：${routeStatus.model.modelId} · 图片能力：${status}`;
}
