import type {
  ContentInputMethod,
  ContentPipelineItem,
  InboxDraft,
  InboxSubmissionResult,
  RoutingConfigs,
} from "@/src/lib/types";

export const CONTENT_INPUT_METHOD_OPTIONS: Array<{
  value: ContentInputMethod;
  label: string;
  description: string;
}> = [
  {
    value: "direct_paste",
    label: "粘贴正文",
    description: "粘贴文章、笔记或其他英语文本。",
  },
  {
    value: "url",
    label: "添加链接",
    description: "添加网页链接，系统会尝试提取正文。",
  },
  {
    value: "file_upload",
    label: "选择文档",
    description: "支持 TXT、Markdown、HTML、PDF 和 DOCX。",
  },
  {
    value: "local_asset",
    label: "本地文档",
    description: "桌面版从你选择的文件读取正文。",
  },
  {
    value: "title_only",
    label: "先记标题",
    description: "仅保存待补材料，不进入当前阅读器主流程。",
  },
];

export function getInputMethodLabel(value: ContentInputMethod | undefined) {
  return (
    CONTENT_INPUT_METHOD_OPTIONS.find((item) => item.value === value)?.label ?? "粘贴正文"
  );
}

export function createContentPipelineItemFromInbox(
  draft: InboxDraft,
  configs: RoutingConfigs,
): ContentPipelineItem {
  const enabledSourceTypeIds = new Set(
    configs.sourceTypeConfigs.filter((item) => item.enabled).map((item) => item.id),
  );
  const enabledCategoryIds = new Set(
    configs.categoryConfigs.filter((item) => item.enabled).map((item) => item.id),
  );
  const enabledProductIds = new Set(
    configs.productConfigs.filter((item) => item.enabled).map((item) => item.id),
  );
  const enabledPlatformIds = new Set(
    configs.platformConfigs.filter((item) => item.enabled).map((item) => item.id),
  );

  const title = draft.title.trim() || deriveInboxTitle(draft);
  const description =
    draft.summary.trim() ||
    draft.rawContent.trim().slice(0, 120) ||
    draft.sourceReference.trim() ||
    draft.notes?.trim() ||
    title;

  return {
    id: createId(),
    title,
    description,
    sourceTypeId: enabledSourceTypeIds.has(draft.sourceTypeId) ? draft.sourceTypeId : "",
    inputMethod: draft.inputMethod,
    sourceReference: draft.sourceReference.trim() || undefined,
    sourceFileName: draft.sourceFileName?.trim() || undefined,
    sourceFileExt: draft.sourceFileExt?.trim() || undefined,
    sourceMimeType: draft.sourceMimeType?.trim() || undefined,
    sourceAssetType: draft.sourceAssetType,
    originalLanguage: draft.originalLanguage,
    summary: draft.summary.trim(),
    rawContent: draft.rawContent.trim(),
    extractedText: draft.rawContent.trim() || undefined,
    ingestStatus:
      draft.inputMethod === "direct_paste"
        ? "ingested"
        : draft.inputMethod === "title_only"
          ? "saved_only"
          : "saved_only",
    categoryIds: draft.categoryIds.filter((id) => enabledCategoryIds.has(id)),
    moduleIds: [draft.moduleId],
    productIds: draft.productIds.filter((id) => enabledProductIds.has(id)),
    linkedOfferId:
      draft.productMode === "existing" && draft.selectedOfferId?.trim()
        ? draft.selectedOfferId.trim()
        : undefined,
    targetAudience: draft.targetAudience.trim(),
    targetPlatformIds: draft.preferredPlatformIds.length
      ? draft.preferredPlatformIds.filter((id) => enabledPlatformIds.has(id))
      : undefined,
    primaryCTA: draft.primaryCTA?.trim() || undefined,
    notes: draft.notes?.trim() || undefined,
    createdAt: new Date().toISOString(),
    status: "待整理",
  };
}

export function validateInboxDraft(draft: InboxDraft) {
  const errors: string[] = [];

  if (!draft.sourceTypeId.trim()) {
    errors.push("请选择材料类型。");
  }

  if (!draft.inputMethod.trim()) {
    errors.push("请选择导入方式。");
  }

  if (!draft.moduleId.trim()) {
    errors.push("请选择材料用途。");
  }

  if (draft.inputMethod === "direct_paste" && !draft.summary.trim() && !draft.rawContent.trim()) {
    errors.push("请粘贴一段英语正文。");
  }

  if (draft.inputMethod === "url" && !draft.sourceReference.trim()) {
    errors.push("请先填写文章链接。");
  }

  if (draft.inputMethod === "file_upload" && !draft.sourceReference.trim()) {
    errors.push("请先选择一个本地文件。");
  }

  if (draft.inputMethod === "local_asset" && !draft.sourceReference.trim()) {
    errors.push("请先选择一个本地文件。");
  }

  if (draft.inputMethod === "title_only" && !draft.notes?.trim()) {
    errors.push("只保存标题时，请补充一句说明。");
  }

  if (draft.productMode === "existing" && !draft.selectedOfferId?.trim()) {
    errors.push("如果你想直接绑定产品，请先选一个已有产品。");
  }

  if (draft.productMode === "new" && !draft.newOfferName?.trim()) {
    errors.push("如果你想新建产品，请先写一个名称。");
  }

  if (draft.platformMode === "manual" && !draft.preferredPlatformIds.length) {
    errors.push("如果你想手动选平台，至少选一个。");
  }

  if (draft.platformMode === "new" && !draft.newPlatformName?.trim()) {
    errors.push("如果你想新建平台，请先写一个平台名称。");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function buildInboxSubmissionResult(
  contentItem: ContentPipelineItem,
): InboxSubmissionResult {
  const ingestMessage =
    contentItem.ingestStatus === "ingested"
      ? "已提取正文。"
      : contentItem.ingestStatus === "partial"
        ? "已保存来源信息，但正文只提取到一部分。"
        : contentItem.ingestStatus === "failed"
          ? "已保存来源信息，但这次读取失败。"
          : "已保存来源信息。";

  return {
    contentItemId: contentItem.id,
    message: `已完成“${contentItem.title}”的导入。${ingestMessage}`,
  };
}

export function getSubmitLabel(inputMethod: ContentInputMethod) {
  if (inputMethod === "title_only") {
    return "保存待补材料";
  }

  return "导入并开始阅读";
}

export function deriveInboxTitle(draft: InboxDraft) {
  const fileTitle = draft.sourceFileName?.trim()
    ? stripFileExtension(draft.sourceFileName.trim())
    : "";

  if (fileTitle) {
    return fileTitle;
  }

  const referenceTitle = draft.sourceReference.trim()
    ? stripFileExtension(draft.sourceReference.trim().split(/[/\\]/).filter(Boolean).pop() ?? "")
    : "";

  if (referenceTitle && !referenceTitle.startsWith("http")) {
    return referenceTitle;
  }

  const firstTextLine = (draft.rawContent || draft.summary || draft.notes || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  return firstTextLine ? firstTextLine.slice(0, 80) : "未命名材料";
}

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function stripFileExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "") || fileName;
}
