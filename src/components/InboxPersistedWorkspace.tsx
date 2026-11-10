"use client";


import { useLearningUi } from "@/src/components/LanguageProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { InboxPreviewCard } from "@/src/components/InboxPreviewCard";
import { InboxSection } from "@/src/components/InboxSection";
import {
  applyIngestResultToContentItem,
  applyIngestResultToDraft,
  getIngestStatusLabel,
  ingestLocalAsset,
  ingestUploadedFile,
  ingestUrl,
  pickLocalAssetSelection,
  describeDocumentReadError,
} from "@/src/lib/ingest";
import {
  buildInboxSubmissionResult,
  createContentPipelineItemFromInbox,
  validateInboxDraft,
} from "@/src/lib/inbox";
import { createSourceMaterialFromContentPipelineItem } from "@/src/lib/sourceIngestion";
import { detectMaterialLanguage } from "@/src/lib/materialLanguage";
import { useWorkspaceStore } from "@/src/lib/useWorkspaceStore";
import { isTauriDesktop } from "@/src/lib/workspace/desktopStorage";
import {
  getImageTextExtractionRouteStatus,
  applyEditedImageTextToInboxDraft,
  validateImageFileForExtraction,
  type ImageTextExtractionRouteStatus,
} from "@/src/lib/imageTextExtraction";
import { extractImageTextWithAi } from "@/src/lib/llm/imageTextExtraction";
import { testAiProviderConnection } from "@/src/lib/llm/providerTest";
import { applyImageInputVerification, getImageInputCandidates } from "@/src/lib/imageInputSetup";
import type {
  CategoryConfig,
  ContentAssetType,
  InboxDraft,
  RoutingConfigs,
  SourceTypeConfig,
  WorkspaceState,
} from "@/src/lib/types";

type LocalAssetSelection = {
  reference: string;
  fileName: string;
  extension: string;
  mimeType: string;
  assetType: ContentAssetType;
  kind: "file" | "directory";
};

type InboxInputView = InboxDraft["inputMethod"] | "image_pending";

const LEARNING_SOURCE_TYPE_CONFIGS: SourceTypeConfig[] = [
  {
    id: "article",
    name: "文章",
    description: "博客、新闻、报告、说明文等可阅读正文。",
    enabled: true,
  },
  {
    id: "note",
    name: "学习笔记",
    description: "课程笔记、读书摘录和自己整理的学习材料。",
    enabled: true,
  },
  {
    id: "tool-review",
    name: "工作与行业",
    description: "邮件、供应链文件、行业说明和工作场景文本。",
    enabled: true,
  },
  {
    id: "other",
    name: "其他文本",
    description: "暂时不需要细分类的学习材料。",
    enabled: true,
  },
];

const LEARNING_CATEGORY_CONFIGS: CategoryConfig[] = [
  {
    id: "work-tools",
    name: "工作与行业",
    description: "工作沟通、行业文章、工具和协作场景。",
    color: "#d7c2b0",
    enabled: true,
  },
  {
    id: "healthy-life",
    name: "健康与生活",
    description: "健康、运动、饮食和日常生活材料。",
    color: "#c8d8c2",
    enabled: true,
  },
  {
    id: "cross-cultural-expression",
    name: "跨文化表达",
    description: "语气、文化差异和地道表达。",
    color: "#bfd6ea",
    enabled: true,
  },
  {
    id: "ai-llm",
    name: "AI 与科技",
    description: "AI、科技、工具和产品说明。",
    color: "#d8cec0",
    enabled: true,
  },
  {
    id: "overseas-work",
    name: "海外工作",
    description: "海外协作、客户沟通和远程工作材料。",
    color: "#c9d8d2",
    enabled: true,
  },
  {
    id: "life-management",
    name: "生活管理",
    description: "计划、习惯、说明和个人管理类材料。",
    color: "#ead4c6",
    enabled: true,
  },
];

const LEARNING_MODULE_OPTIONS = [
  { id: "english-blog", name: "长文阅读" },
  { id: "newsletter", name: "邮件 / Newsletter" },
  { id: "thread", name: "短文 / 帖子" },
  { id: "product-asset", name: "工作材料" },
];

export function InboxPersistedWorkspace() {
  const { t } = useLearningUi();
  const router = useRouter();
  const { workspace, commitEntryToWorkspace, updateWorkspace } = useWorkspaceStore();
  const [draft, setDraft] = useState<InboxDraft>(() =>
    createInitialDraft(LEARNING_SOURCE_TYPE_CONFIGS[0]?.id ?? ""),
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [languageOverride, setLanguageOverride] = useState<"en" | "zh" | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [successContentId, setSuccessContentId] = useState("");
  const [submitPending, setSubmitPending] = useState(false);
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [imageExtractedText, setImageExtractedText] = useState("");
  const [imageExtractionError, setImageExtractionError] = useState("");
  const [imageExtractionPending, setImageExtractionPending] = useState(false);
  const [imagePrivacyConfirmed, setImagePrivacyConfirmed] = useState(false);
  const [imageModelId, setImageModelId] = useState("");
  const [imageVerificationPending, setImageVerificationPending] = useState(false);
  const imageRequestRef = useRef<AbortController | null>(null);
  const imageSelectionRef = useRef(0);
  useEffect(() => () => { imageRequestRef.current?.abort(); }, []);
  const [localAssetSelection, setLocalAssetSelection] = useState<LocalAssetSelection | null>(null);
  const [inputView, setInputView] = useState<InboxInputView>("direct_paste");
  const desktopAssetPickerAvailable = isTauriDesktop();
  const routingConfigs = useMemo<RoutingConfigs>(
    () => ({
      sourceTypeConfigs: workspace.sourceTypeConfigs,
      categoryConfigs: workspace.categoryConfigs,
      platformConfigs: workspace.platformConfigs,
      productConfigs: workspace.productConfigs,
    }),
    [
      workspace.categoryConfigs,
      workspace.platformConfigs,
      workspace.productConfigs,
      workspace.sourceTypeConfigs,
    ],
  );
  const resolvedDraft = normalizeDraft({ ...draft, originalLanguage: languageOverride ?? detectMaterialLanguage(draft.rawContent) ?? (workspace.languageSettings.targetLanguage === "zh" ? "zh" : "en") }, workspace);
  const imageCandidates = useMemo(() => getImageInputCandidates({ aiModels: workspace.aiModels, aiProviders: workspace.aiProviders }), [workspace.aiModels, workspace.aiProviders]);
  const imageCandidate = imageCandidates.find(({ model }) => model.id === imageModelId)
    ?? imageCandidates.find(({ model }) => model.id === workspace.aiTaskRouting.imageTextExtraction?.modelId)
    ?? imageCandidates.find(({ model }) => model.id === workspace.aiTaskRouting.languageAnalysis?.modelId)
    ?? imageCandidates[0];
  const imageRouting = useMemo(() => imageCandidate ? { ...workspace.aiTaskRouting, imageTextExtraction: { ...workspace.aiTaskRouting.imageTextExtraction, providerId: imageCandidate.provider.id, modelId: imageCandidate.model.id, enabled: true } } : workspace.aiTaskRouting, [workspace.aiTaskRouting, imageCandidate]);
  const imageRouteStatus = useMemo<ImageTextExtractionRouteStatus>(
    () =>
      getImageTextExtractionRouteStatus({
        aiProviders: workspace.aiProviders,
        aiModels: workspace.aiModels,
        aiTaskRouting: imageRouting,
      }),
    [workspace.aiModels, workspace.aiProviders, imageRouting],
  );

  const recentMaterials = useMemo(
    () =>
      [...workspace.sourceMaterials]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 6),
    [workspace.sourceMaterials],
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-stone-950">{t("导入学习材料")}</h1>
        <p className="mt-1 text-sm leading-6 text-stone-600">{t("粘贴正文、添加链接或选择文档，导入后即可开始阅读。")}</p>
      </header>
      <div className="grid items-start gap-5 min-[900px]:grid-cols-[minmax(0,1fr)_18rem]">
        <InboxSection
          draft={resolvedDraft}
          sourceTypeConfigs={LEARNING_SOURCE_TYPE_CONFIGS}
          categoryConfigs={LEARNING_CATEGORY_CONFIGS}
          moduleOptions={LEARNING_MODULE_OPTIONS}
          errors={errors}
          successMessage={successMessage}
          successContentId={successContentId}
          submitPending={submitPending}
          onDraftChange={(value) => {
            if (value.originalLanguage !== resolvedDraft.originalLanguage) setLanguageOverride(value.originalLanguage);
            setDraft(value);
            if (successMessage) {
              setSuccessMessage("");
              setSuccessContentId("");
            }
          }}
          onFileUploadSelect={(file) => {
            setSelectedUploadFile(file);
          }}
          selectedImageFileName={selectedImageFile?.name ?? ""}
          imageDataUrl={imageDataUrl}
          imageExtractedText={imageExtractedText}
          imageExtractionPending={imageExtractionPending}
          imageExtractionError={imageExtractionError}
          imagePrivacyConfirmed={imagePrivacyConfirmed}
          imageRouteStatus={imageRouteStatus}
          imageModelOptions={imageCandidates.map(({ provider, model }) => ({ value: model.id, label: `${provider.name} · ${model.modelId}` }))}
          imageModelId={imageCandidate?.model.id ?? ""}
          imageVerificationPending={imageVerificationPending}
          onImageModelChange={(id) => {
            imageRequestRef.current?.abort();
            imageSelectionRef.current += 1;
            setImageExtractionPending(false);
            setImagePrivacyConfirmed(false);
            setImageExtractionError("");
            setImageModelId(id);
          }}
          onVerifyImageModel={async () => {
            if (!imageCandidate) return;
            setImageVerificationPending(true);
            setImageExtractionError("");
            const { provider, model } = imageCandidate;
            try {
              const result = await testAiProviderConnection(provider, workspace.aiModels, model.id, "image");
              if (!result.checkedAt) {
                setImageExtractionError(result.message);
                return;
              }
              updateWorkspace((current) => {
                if (JSON.stringify(current.aiProviders.find(p => p.id === provider.id)) !== JSON.stringify(provider)
                  || JSON.stringify(current.aiModels.find(m => m.id === model.id)) !== JSON.stringify(model)) {
                  throw new Error("识图配置已变更，请重新验证当前模型。");
                }
                return applyImageInputVerification(current, result);
              });
              if (!result.success) setImageExtractionError(result.message);
            } catch (error) {
              setImageExtractionError(error instanceof Error ? error.message : "识图验证失败，请检查模型与接口。");
            } finally {
              setImageVerificationPending(false);
            }
          }}
          onImagePrivacyConfirmedChange={setImagePrivacyConfirmed}
          onImageExtractedTextChange={setImageExtractedText}
          onImageFileSelect={async (file) => {
            imageRequestRef.current?.abort();
            const selection = ++imageSelectionRef.current;
            setImageExtractionPending(false);
            setSelectedImageFile(null);
            setImageDataUrl("");
            setImageExtractionError("");
            setImageExtractedText("");
            setImagePrivacyConfirmed(false);

            if (!file) {
              setSelectedImageFile(null);
              setImageDataUrl("");
              return;
            }

            const validation = validateImageFileForExtraction(file);

            if (!validation.ok) {
              setSelectedImageFile(null);
              setImageDataUrl("");
              setImageExtractionError(validation.message);
              return;
            }

            let dataUrl: string;
            try { dataUrl = await fileToDataUrl(file); }
            catch {
              if (selection === imageSelectionRef.current) setImageExtractionError("图片读取失败，请重新选择图片。");
              return;
            }
            if (selection !== imageSelectionRef.current) return;
            setSelectedImageFile(file);
            setImageDataUrl(dataUrl);
            setDraft((current) => ({
              ...current,
              title: current.title.trim() || stripFileExtension(file.name),
              sourceReference: file.name,
              sourceFileName: file.name,
              sourceFileExt: file.name.split(".").pop()?.toLowerCase() ?? "",
              sourceMimeType: file.type,
              sourceAssetType: "image",
            }));
          }}
          onExtractImageText={async () => {
            setImageExtractionError("");

            if (!imageDataUrl) {
              setImageExtractionError("请先选择一张图片。");
              return;
            }

            if (!imageRouteStatus.ok) {
              setImageExtractionError(imageRouteStatus.message);
              return;
            }

            if (imageRouteStatus.serviceScope === "external" && !imagePrivacyConfirmed) {
              setImageExtractionError("请先确认图片发送范围。");
              return;
            }

            setImageExtractionPending(true);
            const selection = imageSelectionRef.current;
            const controller = new AbortController();
            imageRequestRef.current = controller;

            try {
              const result = await extractImageTextWithAi({
                imageDataUrl,
                aiProviders: workspace.aiProviders,
                aiModels: workspace.aiModels,
                aiTaskRouting: imageRouting,
                aiPrivacySettings: workspace.aiPrivacySettings,
                signal: controller.signal,
              });

              if (selection === imageSelectionRef.current && !controller.signal.aborted) setImageExtractedText(result.text);
            } catch (error) {
              if (selection !== imageSelectionRef.current || controller.signal.aborted) return;
              setImageExtractionError(
                error instanceof Error
                  ? error.message
                  : "未能识别图片中的文字，可以尝试更清晰的图片，或手动粘贴正文。",
              );
            } finally {
              if (selection === imageSelectionRef.current) setImageExtractionPending(false);
            }
          }}
          inputView={inputView}
          onInputViewChange={setInputView}
          onPickLocalAssetFile={desktopAssetPickerAvailable ? async () => {
            const selection = await pickLocalAssetSelection("file");

            if (!selection) {
              return;
            }

            setLocalAssetSelection(selection);
            setDraft((current) => ({
              ...current,
              title: current.title.trim() || stripFileExtension(selection.fileName),
              sourceReference: selection.reference,
              sourceFileName: selection.fileName,
              sourceFileExt: selection.extension,
              sourceMimeType: selection.mimeType,
              sourceAssetType: selection.assetType ?? "unknown",
            }));
          } : undefined}
          onSubmit={async () => {
            if (inputView === "image_pending" && !imageExtractedText.trim()) {
              setErrors(["请先提取图片文字，并确认识别结果。"]);
              setSuccessMessage("");
              return;
            }

            const draftForSubmission =
              inputView === "image_pending"
                ? applyEditedImageTextToInboxDraft({
                    draft: resolvedDraft,
                    editedText: imageExtractedText,
                    fileName: selectedImageFile?.name ?? "",
                    mimeType: selectedImageFile?.type ?? "",
                  })
                : resolvedDraft;
            const effectiveValidation = validateInboxDraft(draftForSubmission);

            if (!effectiveValidation.valid) {
              setErrors(effectiveValidation.errors);
              setSuccessMessage("");
              return;
            }

            setSubmitPending(true);

            try {
              let ingestedDraft = draftForSubmission;
              let ingestResult:
                | Awaited<ReturnType<typeof ingestUrl>>
                | Awaited<ReturnType<typeof ingestUploadedFile>>
                | Awaited<ReturnType<typeof ingestLocalAsset>>
                | null = null;

              if (draftForSubmission.inputMethod === "url") {
                ingestResult = await ingestUrl(draftForSubmission.sourceReference);
                ingestedDraft = applyIngestResultToDraft(draftForSubmission, ingestResult);
              }

              if (draftForSubmission.inputMethod === "file_upload") {
                if (!selectedUploadFile) {
                  setErrors(["请先重新选择要上传的文件。"]);
                  setSuccessMessage("");
                  return;
                }

                ingestResult = await ingestUploadedFile(selectedUploadFile);
                ingestedDraft = applyIngestResultToDraft(draftForSubmission, ingestResult);
              }

              if (draftForSubmission.inputMethod === "local_asset") {
                const selectionForIngest =
                  localAssetSelection ?? createLocalAssetSelectionFromDraft(draftForSubmission);

                if (!selectionForIngest) {
                  setErrors(["请先选择一个文档。"]);
                  setSuccessMessage("");
                  return;
                }

                ingestResult = await ingestLocalAsset(selectionForIngest);
                ingestedDraft = applyIngestResultToDraft(draftForSubmission, ingestResult);
              }

              if (ingestResult && !ingestResult.extractedText.trim()) {
                setErrors([ingestResult.ingestError || "没有提取到可阅读正文，请检查文件或粘贴正文后重试。这不是学习语言限制。"]);
                setSuccessMessage("");
                return;
              }

              const detectedLanguage = detectMaterialLanguage(ingestedDraft.rawContent);
              const nextDraft = prepareLearningSubmission({ ...ingestedDraft,
                originalLanguage: languageOverride ?? detectedLanguage ?? ingestedDraft.originalLanguage,
              });
              let nextItem = createContentPipelineItemFromInbox(nextDraft, routingConfigs);

              if (ingestResult) {
                nextItem = applyIngestResultToContentItem(nextItem, ingestResult);
              }

              const result = buildInboxSubmissionResult(nextItem);
              const sourceIngestion = createSourceMaterialFromContentPipelineItem(nextItem, {
                language: nextItem.originalLanguage,
              });

              commitEntryToWorkspace({
                item: nextItem,
                offersToUpsert: [],
                platformsToUpsert: [],
                sourceMaterial: sourceIngestion.sourceMaterial,
                learningSegments: sourceIngestion.learningSegments,
              });
              setErrors([]);
              setSuccessMessage(
                nextItem.ingestError
                  ? `${result.message} 当前读取状态：${getIngestStatusLabel(nextItem.ingestStatus)}。${nextItem.ingestError}`
                  : `${result.message} 当前读取状态：${getIngestStatusLabel(nextItem.ingestStatus)}。已保存到阅读器。`,
              );
              setSuccessContentId(result.contentItemId);
              setDraft(createInitialDraft(LEARNING_SOURCE_TYPE_CONFIGS[0]?.id ?? ""));
              setLanguageOverride(null);
              setSelectedUploadFile(null);
              setSelectedImageFile(null);
              setImageDataUrl("");
              setImageExtractedText("");
              setImageExtractionError("");
              setImagePrivacyConfirmed(false);
              setLocalAssetSelection(null);

              if (sourceIngestion.learningSegments.length) {
                router.push(`/reader?content=${result.contentItemId}`);
              }
            } catch {
              setErrors(["材料导入失败，输入内容已保留。请检查文件或链接后重试。"]);
              setSuccessMessage("");
            } finally {
              setSubmitPending(false);
            }
          }}
        />

        <aside aria-label={t("导入记录与预览")} className="min-w-0 space-y-4 [overflow-wrap:anywhere]">
          <section className="rounded-xl border border-stone-200 bg-white p-4">
            <h2 className="text-base font-semibold">{t("最近导入的材料")}</h2>
            {recentMaterials.length ? <ul className="mt-3 divide-y divide-stone-200">
              {recentMaterials.map(source => <li key={source.id}>
                <Link href={`/reader?source=${source.id}`} className="block py-3 text-sm hover:underline">
                  <span className="block font-semibold">{source.title}</span>
                  <span className="mt-1 block text-xs text-stone-500">{t(source.language === "zh" ? "中文" : "英文")} · {t(source.cleanedContent.trim() ? "已提取正文" : "未提取正文")}</span>
                </Link>
                {typeof source.metadata?.ingestError === "string" ? <p className="pb-2 text-xs leading-5 text-amber-700">{t(describeDocumentReadError(source.metadata.ingestError))}</p> : null}
              </li>)}
            </ul> : <p className="mt-2 text-sm leading-6 text-stone-500">{t("还没有导入材料。可以粘贴正文，或选择一个可提取正文的文件。")}</p>}
          </section>
          <details className="rounded-xl border border-stone-200 bg-white p-4">
            <summary className="cursor-pointer text-sm font-semibold">{t("查看导入预览")}</summary>
            <InboxPreviewCard draft={resolvedDraft} inputView={inputView} imageDataUrl={imageDataUrl}
              imageExtractedText={imageExtractedText} imageRouteStatus={imageRouteStatus}
              sourceTypeConfigs={LEARNING_SOURCE_TYPE_CONFIGS} categoryConfigs={LEARNING_CATEGORY_CONFIGS} />
          </details>
        </aside>
      </div>
    </div>
  );
}

function createInitialDraft(sourceTypeId: string): InboxDraft {
  return {
    title: "",
    sourceTypeId,
    inputMethod: "direct_paste",
    sourceReference: "",
    originalLanguage: "en",
    summary: "",
    rawContent: "",
    moduleId: LEARNING_MODULE_OPTIONS[0]?.id ?? "",
    categoryIds: [],
    productIds: [],
    targetAudience: "",
    preferredPlatformIds: [],
    productMode: "none",
    selectedOfferId: "",
    newOfferName: "",
    newOfferDescription: "",
    platformMode: "none",
    newPlatformName: "",
    newPlatformDescription: "",
    rewriteDepth: "medium",
    primaryCTA: "",
    notes: "",
  };
}

function createLocalAssetSelectionFromDraft(draft: InboxDraft): LocalAssetSelection | null {
  const reference = draft.sourceReference.trim();

  if (!reference) {
    return null;
  }

  const fileName = draft.sourceFileName?.trim() || getLeafName(reference);
  const extension = draft.sourceFileExt?.trim() || getFileExtension(fileName);

  return {
    reference,
    fileName,
    extension,
    mimeType: draft.sourceMimeType?.trim() || inferMimeType(extension),
    assetType: draft.sourceAssetType ?? inferAssetType(extension),
    kind: "file",
  };
}

function getLeafName(path: string) {
  return path.split(/[/\\]/).filter(Boolean).pop() || path;
}

function getFileExtension(fileName: string) {
  return fileName.match(/\.([^.]+)$/)?.[1]?.toLowerCase() ?? "";
}

function inferMimeType(extension: string) {
  if (extension === "txt") return "text/plain";
  if (extension === "md") return "text/markdown";
  if (extension === "json") return "application/json";
  if (extension === "csv") return "text/csv";
  if (extension === "html" || extension === "htm") return "text/html";
  if (extension === "pdf") return "application/pdf";
  if (extension === "docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }

  return "application/octet-stream";
}

function inferAssetType(extension: string): ContentAssetType {
  if (extension === "txt") return "text";
  if (extension === "md") return "markdown";
  if (extension === "json") return "json";
  if (extension === "csv") return "csv";
  if (extension === "html" || extension === "htm") return "html";
  if (extension === "pdf") return "pdf";
  if (extension === "docx") return "docx";
  return "file";
}

function normalizeDraft(
  draft: InboxDraft,
  workspace: WorkspaceState,
): InboxDraft {
  const sourceTypeIds = new Set(workspace.sourceTypeConfigs.map((item) => item.id));
  const categoryIds = new Set(workspace.categoryConfigs.map((item) => item.id));

  return {
    ...draft,
    title: draft.title.trim(),
    sourceTypeId: sourceTypeIds.has(draft.sourceTypeId)
      ? draft.sourceTypeId
      : LEARNING_SOURCE_TYPE_CONFIGS[0]?.id ?? "",
    originalLanguage: draft.originalLanguage,
    categoryIds: draft.categoryIds.filter((id) => categoryIds.has(id)),
    productIds: [],
    preferredPlatformIds: [],
    productMode: "none",
    selectedOfferId: "",
    newOfferName: "",
    newOfferDescription: "",
    platformMode: "none",
    newPlatformName: "",
    newPlatformDescription: "",
    primaryCTA: "",
  };
}

function prepareLearningSubmission(draft: InboxDraft): InboxDraft {
  return {
    ...draft,
    productIds: [],
    preferredPlatformIds: [],
    productMode: "none",
    selectedOfferId: "",
    newOfferName: "",
    newOfferDescription: "",
    platformMode: "none",
    newPlatformName: "",
    newPlatformDescription: "",
    primaryCTA: "",
  };
}

function stripFileExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "") || fileName;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("无法读取图片，请重新选择文件。"));
    };
    reader.onerror = () => reject(new Error("无法读取图片，请重新选择文件。"));
    reader.readAsDataURL(file);
  });
}
