"use client";

import { FullTextSelect } from "@/src/components/FullTextSelect";


import { useLearningUi } from "@/src/components/LanguageProvider";
import Link from "next/link";
import { useRef } from "react";
import { getSubmitLabel } from "@/src/lib/inbox";
import type {
  ContentInputMethod,
  CategoryConfig,
  InboxDraft,
  SourceTypeConfig,
} from "@/src/lib/types";
import type { ImageTextExtractionRouteStatus } from "@/src/lib/imageTextExtraction";

type ModuleOption = {
  id: string;
  name: string;
};

type InboxSectionProps = {
  draft: InboxDraft;
  inputView: ContentInputMethod | "image_pending";
  sourceTypeConfigs: SourceTypeConfig[];
  categoryConfigs: CategoryConfig[];
  moduleOptions: ModuleOption[];
  errors: string[];
  successMessage: string;
  successContentId?: string;
  submitPending?: boolean;
  selectedImageFileName?: string;
  imageDataUrl?: string;
  imageExtractedText?: string;
  imageExtractionPending?: boolean;
  imageExtractionError?: string;
  imagePrivacyConfirmed?: boolean;
  imageRouteStatus?: ImageTextExtractionRouteStatus;
  imageModelOptions?: Array<{ value: string; label: string }>;
  imageModelId?: string;
  imageVerificationPending?: boolean;
  onDraftChange: (value: InboxDraft) => void;
  onInputViewChange: (value: ContentInputMethod | "image_pending") => void;
  onFileUploadSelect?: (file: File | null) => void;
  onImageFileSelect?: (file: File | null) => void | Promise<void>;
  onExtractImageText?: () => void | Promise<void>;
  onImageExtractedTextChange?: (value: string) => void;
  onImagePrivacyConfirmedChange?: (value: boolean) => void;
  onImageModelChange?: (value: string) => void;
  onVerifyImageModel?: () => void | Promise<void>;
  onPickLocalAssetFile?: () => void;
  onSubmit: () => void;
};

export function InboxSection({
  draft,
  inputView,
  sourceTypeConfigs,
  categoryConfigs,
  moduleOptions,
  errors,
  successMessage,
  successContentId,
  submitPending = false,
  selectedImageFileName = "",
  imageDataUrl = "",
  imageExtractedText = "",
  imageExtractionPending = false,
  imageExtractionError = "",
  imagePrivacyConfirmed = false,
  imageRouteStatus,
  imageModelOptions = [],
  imageModelId = "",
  imageVerificationPending = false,
  onDraftChange,
  onInputViewChange,
  onFileUploadSelect,
  onImageFileSelect,
  onExtractImageText,
  onImageExtractedTextChange,
  onImagePrivacyConfirmedChange,
  onImageModelChange,
  onVerifyImageModel,
  onPickLocalAssetFile,
  onSubmit,
}: InboxSectionProps) {
  const { t } = useLearningUi();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const assetInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const imageCanSubmit = inputView !== "image_pending" || Boolean(imageExtractedText.trim());

  return (
    <section aria-label={t("导入材料表单")} className="min-w-0 rounded-xl border border-stone-200 bg-white p-4 sm:p-5">
      <div className="space-y-5">
        <div className="grid items-start gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <TextField label={t("材料标题")} value={draft.title}
            placeholder={t("可以留空；导入文件或链接时会尽量自动填写")}
            onChange={(title) => onDraftChange({ ...draft, title })} />
          <SelectField label={t("原始语言")} value={draft.originalLanguage}
            options={[{ value: "en", label: "英文" }, { value: "zh", label: "中文" }]}
            onChange={(value) => onDraftChange({ ...draft, originalLanguage: value as InboxDraft["originalLanguage"] })} />
        </div>
        <p className="text-xs leading-6 text-stone-500">{t("支持中文和英文正文。导入时会自动识别语言；也可手动选择。与当前学习语言不同的材料仍可阅读，并会提示切换。")}</p>
        <div>
          <p className="mb-2 text-sm font-semibold text-stone-700">{t("导入方式")}</p>
          <div role="tablist" aria-label={t("导入方式")} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {VISIBLE_INPUT_METHOD_OPTIONS.map((item) => <button key={item.value} type="button" role="tab"
              aria-selected={inputView === item.value} onClick={() => {
                onInputViewChange(item.value);
                if (item.value !== "image_pending") onDraftChange({ ...draft, inputMethod: item.value });
              }} className={`min-h-11 rounded-lg border px-3 py-2 text-center text-sm font-semibold ${inputView === item.value ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 text-stone-700 hover:bg-stone-100"}`}>
              {t(item.label)}
            </button>)}
          </div>
          <p className="mt-2 text-xs leading-6 text-stone-500">{t(VISIBLE_INPUT_METHOD_OPTIONS.find(item => item.value === inputView)?.description || "桌面版会读取你主动选择的本地文件，并尽量提取可读正文。")}</p>
        </div>

        {inputView === "direct_paste" ? (
          <DirectPasteFields draft={draft} onDraftChange={onDraftChange} />
        ) : null}

        {inputView === "url" ? (
          <ChoiceCard
            title={t("添加链接")}
            description={t("会尝试提取网页正文；读取失败时保留输入，你可以改为粘贴正文或上传文件。")}
          >
            <div className="space-y-4">
              <TextField
                label={t("链接")}
                value={draft.sourceReference}
                placeholder="https://"
                onChange={(value) => onDraftChange({ ...draft, sourceReference: value })}
              />
            </div>
          </ChoiceCard>
        ) : null}

        {inputView === "file_upload" ? (
          <ChoiceCard
            title={t("选择文档")}
            description={t("导入时会读取 TXT、Markdown、HTML、PDF 和 DOCX 正文。")}
          >
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex min-h-24 w-full items-center justify-center rounded-lg border border-dashed border-stone-300 bg-[#fbfaf7] px-4 py-6 text-sm text-stone-600"
              >
                {draft.sourceFileName
                  ? `${t("已选文件：")}${draft.sourceFileName}`
                  : t("选择 TXT / Markdown / HTML / PDF / DOCX 文件")}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.markdown,.html,.htm,.pdf,.docx"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  onFileUploadSelect?.(file ?? null);
                  onDraftChange({
                    ...draft,
                    title: draft.title.trim() || (file ? stripFileExtension(file.name) : ""),
                    sourceReference: file?.name ?? "",
                    sourceFileName: file?.name ?? "",
                    sourceFileExt: file?.name.split(".").pop()?.toLowerCase() ?? "",
                    sourceMimeType: file?.type ?? "",
                  });
                }}
              />
              <Notice>
                {t("支持 TXT、Markdown、HTML、PDF 和 DOCX 正文提取；扫描版 PDF 可能无法提取文字。")}</Notice>
            </div>
          </ChoiceCard>
        ) : null}

        {inputView === "image_pending" ? (
          <div>
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="flex min-h-24 w-full items-center justify-center rounded-lg border border-dashed border-stone-300 bg-[#fbfaf7] px-4 py-6 text-sm text-stone-600"
              >
                {selectedImageFileName
                  ? `${t("已选图片：")}${selectedImageFileName}`
                  : t("选择 PNG / JPG / JPEG / WEBP 图片")}
              </button>
              <input
                ref={imageInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  void onImageFileSelect?.(file);
                  event.currentTarget.value = "";
                }}
              />

              {imageDataUrl ? (
                <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                  <div
                    role="img"
                    aria-label={t("待识别图片预览")}
                    className="h-72 w-full bg-contain bg-center bg-no-repeat"
                    style={{ backgroundImage: `url("${imageDataUrl}")` }}
                  />
                </div>
              ) : null}

              <Notice>
                {t(imageModelOptions.length && !imageRouteStatus?.ok && imageRouteStatus?.imageVerificationStatus !== "failed"
                  ? "复用已保存的 AI 服务和密钥。先验证一次识图能力，再提取图片文字。"
                  : getImageRouteNotice(imageRouteStatus))}
              </Notice>

              {imageModelOptions.length ? (
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <label className="block text-sm font-medium text-stone-700">
                    <span className="mb-1 block">{t("识图模型")}</span>
                    <FullTextSelect
                      aria-label={t("识图模型")}
                      value={imageModelId}
                      onChange={(event) => onImageModelChange?.(event.target.value)}
                      className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2"
                    >
                      {imageModelOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </FullTextSelect>
                  </label>
                  {!imageRouteStatus?.ok ? <button
                    type="button"
                    onClick={() => void onVerifyImageModel?.()}
                    disabled={imageVerificationPending || !imageModelId}
                    className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 disabled:opacity-50"
                  >
                    {imageVerificationPending ? t("验证中…") : t("验证并启用识图")}
                  </button> : null}
                </div>
              ) : null}

              {imageRouteStatus?.serviceScope === "external" ? (
                <label className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-900">
                  <input
                    type="checkbox"
                    checked={imagePrivacyConfirmed}
                    onChange={(event) => onImagePrivacyConfirmedChange?.(event.target.checked)}
                    className="mt-2"
                  />
                  <span>
                    {t("图片将发送到你选择的 AI 服务进行识别。请确认图片中不包含不希望上传的敏感信息。")}</span>
                </label>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void onExtractImageText?.()}
                  disabled={
                    imageExtractionPending ||
                    !imageDataUrl ||
                    !imageRouteStatus?.ok ||
                    (imageRouteStatus?.serviceScope === "external" && !imagePrivacyConfirmed)
                  }
                  className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-300"
                >
                  {imageExtractionPending ? t("正在提取…") : t("确认并提取文字")}
                </button>
                {selectedImageFileName ? (
                  <button
                    type="button"
                    onClick={() => void onImageFileSelect?.(null)}
                    className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm text-stone-700"
                  >
                    {t("移除图片")}</button>
                ) : null}
              </div>

              {imageExtractionError ? (
                <div role="alert"><Notice>{t(imageExtractionError)}</Notice></div>
              ) : null}

              <TextAreaField
                label={t("识别结果（可编辑）")}
                value={imageExtractedText}
                placeholder={t("提取出的正文会显示在这里，确认前可以修改。")}
                minHeight="min-h-44"
                onChange={(value) => onImageExtractedTextChange?.(value)}
              />
            </div>
          </div>
        ) : null}

        {inputView === "local_asset" ? (
          <ChoiceCard
            title={t("打开本地文件")}
            description={t("桌面版会读取你主动选择的本地文件，并尽量提取可读正文。")}
          >
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (onPickLocalAssetFile) {
                      void onPickLocalAssetFile();
                      return;
                    }

                    assetInputRef.current?.click();
                  }}
                  className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm text-stone-700"
                >
                  {t("选择文档")}</button>
              </div>
              <input
                ref={assetInputRef}
                type="file"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  onDraftChange({
                    ...draft,
                    sourceReference: file?.name ?? "",
                    sourceFileName: file?.name ?? "",
                    sourceFileExt: file?.name.split(".").pop()?.toLowerCase() ?? "",
                    sourceMimeType: file?.type ?? "",
                  });
                }}
              />
              <TextField
                label={t("当前文件")}
                value={draft.sourceReference}
                placeholder={t("比如：supplier-statement.pdf")}
                onChange={(value) => onDraftChange({ ...draft, sourceReference: value })}
              />
              <Notice>{t("文本、HTML、PDF 和 DOCX 会尽量提取正文；无法提取时会明确标记为未提取正文。")}</Notice>
            </div>
          </ChoiceCard>
        ) : null}

        <details className="border-t border-stone-200 pt-3">
          <summary className="cursor-pointer text-sm font-semibold text-stone-700">{t("分类、摘要与阅读目标（选填）")}</summary>
          <div className="mt-4 space-y-4">
            <div className="grid items-start gap-4 sm:grid-cols-2">
              <SelectField label={t("材料类型")} value={draft.sourceTypeId}
                options={sourceTypeConfigs.map(item => ({ value: item.id, label: item.name }))}
                onChange={(sourceTypeId) => onDraftChange({ ...draft, sourceTypeId })} />
              <SelectField label={t("材料用途")} value={draft.moduleId}
                options={moduleOptions.map(item => ({ value: item.id, label: item.name }))}
                onChange={(moduleId) => onDraftChange({ ...draft, moduleId })} />
            </div>
            <TextAreaField label={t("内容摘要")} value={draft.summary}
              placeholder={t("可以简单写下这篇材料的重点。")}
              onChange={(summary) => onDraftChange({ ...draft, summary })} />
            <ChipSelectField label={t("兴趣标签（可选）")} values={draft.categoryIds}
              options={categoryConfigs.map(item => ({ value: item.id, label: item.name }))}
              onToggle={(value) => onDraftChange({ ...draft, categoryIds: toggleSelection(draft.categoryIds, value) })} />
            <AdvancedInboxMetaFields draft={draft} onDraftChange={onDraftChange} />
          </div>
        </details>

        {errors.length ? (
          <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-semibold text-stone-500">{t("还差一点")}</p>
            <ul className="mt-2 space-y-1 text-sm leading-7 text-stone-700">
              {errors.map((error) => (
                <li key={error}>- {t(error)}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {successMessage ? (
          <div className="rounded-xl border border-stone-200 bg-[#fbfaf7] p-4 text-sm leading-7 text-stone-700">
            <p>{t(successMessage)}</p>
            {successContentId ? (
              <div className="mt-3">
                <Link
                  href={`/reader?content=${successContentId}`}
                  className="inline-flex rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white"
                >
                  {t("打开阅读器")}</Link>
              </div>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          onClick={onSubmit}
          disabled={submitPending || !imageCanSubmit}
          className="w-full rounded-lg bg-stone-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-300"
        >
          {submitPending
            ? t("正在保存…")
            : inputView === "image_pending"
              ? t("确认并导入阅读器")
              : t(getSubmitLabel(draft.inputMethod))}
        </button>
      </div>
    </section>
  );
}

function getImageRouteNotice(routeStatus?: ImageTextExtractionRouteStatus) {
  if (!routeStatus) {
    return "尚未配置支持图片的模型。请先在设置中选择并验证视觉模型。";
  }

  if (!routeStatus.ok || !routeStatus.provider || !routeStatus.model) {
    return routeStatus.message;
  }

  const serviceLabel = routeStatus.serviceScope === "local" ? "本机服务" : "外部服务";
  const visionLabel = getCapabilityStatusLabel(routeStatus.model.capabilityVerification?.image);

  return `将使用 ${routeStatus.provider.name} · 模型 ID：${routeStatus.model.modelId} · ${serviceLabel}。图片能力：${visionLabel}。`;
}

function getCapabilityStatusLabel(status?: string) {
  if (status === "verified") return "已验证";
  if (status === "failed") return "验证失败";

  return "未验证";
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-3 text-sm leading-7 text-stone-600">
      {children}
    </div>
  );
}

const VISIBLE_INPUT_METHOD_OPTIONS: Array<{
  value: ContentInputMethod | "image_pending";
  label: string;
  description: string;
  disabled?: boolean;
}> = [
  {
    value: "direct_paste",
    label: "粘贴正文",
    description: "粘贴文章、笔记或其他正文。",
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
    value: "image_pending",
    label: "上传图片",
    description: "上传文章、网页、对话或笔记截图，提取其中的文字。",
  },
];

function ChoiceCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const { t } = useLearningUi();
  return (
    <div className="rounded-xl border border-stone-200 bg-[#fcfbf8] p-4">
      <p className="text-xs font-semibold text-stone-500">{t(title)}</p>
      <p className="mt-2 text-sm leading-7 text-stone-600">{t(description)}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function DirectPasteFields({ draft, onDraftChange }: {
  draft: InboxDraft;
  onDraftChange: (value: InboxDraft) => void;
}) {
  const { t } = useLearningUi();
  return <TextAreaField label={t("原始内容")} value={draft.rawContent}
    placeholder={t("粘贴原文、笔记片段或观察记录。")} minHeight="min-h-64"
    onChange={(rawContent) => onDraftChange({ ...draft, rawContent })} />;
}

function AdvancedInboxMetaFields({
  draft,
  onDraftChange,
}: {
  draft: InboxDraft;
  onDraftChange: (value: InboxDraft) => void;
}) {
  const { t } = useLearningUi();
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label={t("阅读时想怎么处理")}
          value={draft.rewriteDepth}
          options={[
            { value: "light", label: "只读懂大意" },
            { value: "medium", label: "词汇和句子都看" },
            { value: "deep", label: "逐段精读" },
          ]}
          onChange={(value) =>
            onDraftChange({ ...draft, rewriteDepth: value as InboxDraft["rewriteDepth"] })
          }
        />
        <TextField
          label={t("这篇材料为什么要读")}
          value={draft.targetAudience}
          placeholder={t("比如：想看懂供应链邮件里的表达")}
          onChange={(value) => onDraftChange({ ...draft, targetAudience: value })}
        />
      </div>

      <TextAreaField
        label={t("阅读备注（可选）")}
        value={draft.notes ?? ""}
        placeholder={t("比如：先重点看动词搭配和供应链相关表达。")}
        onChange={(value) => onDraftChange({ ...draft, notes: value })}
      />
    </div>
  );
}

function ChipButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  const { t } = useLearningUi();
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-2 text-xs transition ${
        active
          ? "bg-stone-900 text-white"
          : "border border-stone-200 bg-white text-stone-600"
      }`}
    >
      {t(label)}
    </button>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const { t } = useLearningUi();
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold text-stone-500">{t(label)}</span>
      <input
        type="text"
        value={value}
        placeholder={t(placeholder)}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-stone-200 bg-[#fbfaf7] px-4 py-3 text-sm text-stone-700 outline-none"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  minHeight = "min-h-28",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
}) {
  const { t } = useLearningUi();
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold text-stone-500">{t(label)}</span>
      <textarea
        aria-label={t(label)}
        value={value}
        placeholder={t(placeholder)}
        onChange={(event) => onChange(event.target.value)}
        className={`${minHeight} w-full rounded-lg border border-stone-200 bg-[#fbfaf7] px-4 py-3 text-sm leading-7 text-stone-700 outline-none`}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  const { t } = useLearningUi();
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold text-stone-500">{t(label)}</span>
      <FullTextSelect
        aria-label={t(label)}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-stone-200 bg-[#fbfaf7] px-4 py-3 text-sm text-stone-700 outline-none"
      >
        <option value="">{t("请选择")}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {t(option.label)}
          </option>
        ))}
      </FullTextSelect>
    </label>
  );
}

function ChipSelectField({
  label,
  values,
  options,
  onToggle,
}: {
  label: string;
  values: string[];
  options: Array<{ value: string; label: string }>;
  onToggle: (value: string) => void;
}) {
  const { t } = useLearningUi();
  return (
    <div>
      <p className="text-xs font-semibold text-stone-500">{t(label)}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => {
          const active = values.includes(option.value);

          return (
            <ChipButton
              key={option.value}
              active={active}
              label={t(option.label)}
              onClick={() => onToggle(option.value)}
            />
          );
        })}
      </div>
    </div>
  );
}

function toggleSelection(values: string[], value: string) {
  if (values.includes(value)) {
    return values.filter((item) => item !== value);
  }

  return [...values, value];
}

function stripFileExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "") || fileName;
}
