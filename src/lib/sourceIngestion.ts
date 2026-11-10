import { ingestUploadedFile, ingestUrl } from "@/src/lib/ingest";
import type {
  ContentIngestStatus,
  ContentPipelineItem,
  LearningSegment,
  SourceMaterial,
  SourceMaterialType,
} from "@/src/lib/types";

type SourceMaterialBaseInput = {
  goalId?: string;
  language?: string;
  metadata?: Record<string, unknown>;
};

export type SourceMaterialIngestionResult = {
  sourceMaterial: SourceMaterial;
  learningSegments: LearningSegment[];
  ingestStatus: ContentIngestStatus;
  message: string;
  ingestError?: string;
};

export type TextSourceMaterialInput = SourceMaterialBaseInput & {
  title: string;
  content: string;
};

export type UrlSourceMaterialInput = SourceMaterialBaseInput & {
  url: string;
  title?: string;
};

export type FileSourceMaterialInput = SourceMaterialBaseInput & {
  file: File;
  title?: string;
};

export type QuestionSourceMaterialInput = SourceMaterialBaseInput & {
  question: string;
  targetLanguage: string;
  interestArea?: string;
  title?: string;
};

export type AiGeneratedSourceMaterialInput = SourceMaterialBaseInput & {
  title: string;
  generatedText: string;
  prompt?: string;
};

export function createSourceMaterialFromText(
  input: TextSourceMaterialInput,
): SourceMaterialIngestionResult {
  const cleanedContent = cleanTextContent(input.content);
  const sourceMaterial = createSourceMaterial({
    title: input.title,
    sourceType: "text",
    language: input.language,
    goalId: input.goalId,
    originalContent: input.content,
    cleanedContent,
    metadata: input.metadata,
  });

  return buildSourceMaterialResult(sourceMaterial, "ingested", "文本材料已创建。");
}

export async function createSourceMaterialFromUrl(
  input: UrlSourceMaterialInput,
): Promise<SourceMaterialIngestionResult> {
  const result = await ingestUrl(input.url);
  const cleanedContent = cleanTextContent(result.extractedText || result.rawContent);
  const sourceMaterial = createSourceMaterial({
    title: input.title || result.title || result.sourceReference,
    sourceType: "url",
    language: input.language,
    goalId: input.goalId,
    originalContent: result.rawContent || result.sourceReference,
    cleanedContent,
    url: result.sourceReference,
    metadata: {
      ...input.metadata,
      ingestStatus: result.ingestStatus,
      ingestError: result.ingestError,
      sourceAssetType: result.sourceAssetType,
      summary: result.summary,
    },
  });

  return buildSourceMaterialResult(
    sourceMaterial,
    result.ingestStatus,
    result.ingestError
      ? `链接已保存，正文读取状态：${result.ingestStatus}。`
      : "链接材料已创建。",
    result.ingestError,
  );
}

export async function createSourceMaterialFromFile(
  input: FileSourceMaterialInput,
): Promise<SourceMaterialIngestionResult> {
  const result = await ingestUploadedFile(input.file);
  const cleanedContent = cleanTextContent(result.extractedText || result.rawContent);
  const sourceMaterial = createSourceMaterial({
    title: input.title || stripFileExtension(result.sourceFileName),
    sourceType: "file",
    language: input.language,
    goalId: input.goalId,
    originalContent: result.rawContent,
    cleanedContent,
    fileName: result.sourceFileName,
    metadata: {
      ...input.metadata,
      ingestStatus: result.ingestStatus,
      ingestError: result.ingestError,
      sourceReference: result.sourceReference,
      sourceFileExt: result.sourceFileExt,
      sourceMimeType: result.sourceMimeType,
      sourceAssetType: result.sourceAssetType,
      summary: result.summary,
    },
  });

  return buildSourceMaterialResult(
    sourceMaterial,
    result.ingestStatus,
    result.ingestError
      ? `文件已保存，正文读取状态：${result.ingestStatus}。`
      : "文件材料已创建。",
    result.ingestError,
  );
}

export function createSourceMaterialFromQuestion(
  input: QuestionSourceMaterialInput,
): SourceMaterialIngestionResult {
  const cleanedContent = cleanTextContent(input.question);
  const sourceMaterial = createSourceMaterial({
    title: input.title || input.question.slice(0, 80) || "学习问题",
    sourceType: "question",
    language: input.targetLanguage,
    goalId: input.goalId,
    originalContent: input.question,
    cleanedContent,
    metadata: {
      ...input.metadata,
      question: input.question,
      targetLanguage: input.targetLanguage,
      interestArea: input.interestArea,
    },
  });

  return buildSourceMaterialResult(sourceMaterial, "saved_only", "学习问题已保存。");
}

export function createSourceMaterialFromAiGeneratedText(
  input: AiGeneratedSourceMaterialInput,
): SourceMaterialIngestionResult {
  const cleanedContent = cleanTextContent(input.generatedText);
  const sourceMaterial = createSourceMaterial({
    title: input.title,
    sourceType: "ai_generated",
    language: input.language,
    goalId: input.goalId,
    originalContent: input.generatedText,
    cleanedContent,
    metadata: {
      ...input.metadata,
      prompt: input.prompt,
    },
  });

  return buildSourceMaterialResult(sourceMaterial, "ingested", "AI 生成材料已创建。");
}

export function createSourceMaterialFromContentPipelineItem(
  item: ContentPipelineItem,
  options: SourceMaterialBaseInput = {},
): SourceMaterialIngestionResult {
  const sourceType = mapContentInputToSourceMaterialType(item);
  const rawMaterialText = item.extractedText || item.rawContent || "";
  const cleanedContent = cleanTextContent(rawMaterialText);
  const sourceMaterial = createSourceMaterial({
    title: item.title,
    sourceType,
    language: options.language || item.originalLanguage || "",
    goalId: options.goalId,
    originalContent:
      item.rawContent || item.extractedText || item.sourceReference || item.description,
    cleanedContent,
    url: sourceType === "url" ? item.sourceReference : undefined,
    fileName: sourceType === "file" ? item.sourceFileName : undefined,
    metadata: {
      ...options.metadata,
      contentItemId: item.id,
      inputMethod: item.inputMethod,
      sourceTypeId: item.sourceTypeId,
      sourceReference: item.sourceReference,
      sourceAssetType: item.sourceAssetType,
      ingestStatus: item.ingestStatus,
      ingestError: item.ingestError,
      categoryIds: item.categoryIds,
      moduleIds: item.moduleIds,
      productIds: item.productIds,
    },
  });

  return buildSourceMaterialResult(
    sourceMaterial,
    item.ingestStatus ?? (cleanedContent ? "ingested" : "saved_only"),
    "内容条目已同步为学习材料。",
    item.ingestError,
  );
}

export function createLearningSegmentsForSourceMaterial(
  sourceMaterial: SourceMaterial,
): LearningSegment[] {
  return createLearningSegmentsFromContent(
    sourceMaterial.cleanedContent,
    sourceMaterial.id,
    sourceMaterial.createdAt,
  );
}

export function createLearningSegmentsFromContent(
  content: string,
  sourceMaterialId: string,
  createdAt = new Date().toISOString(),
): LearningSegment[] {
  const normalized = cleanTextContent(content);

  if (!normalized) {
    return [];
  }

  const paragraphs = normalized.split(/\n{2,}/);
  let searchFrom = 0;
  let index = 0;

  return paragraphs.flatMap((paragraph) => {
    const text = paragraph.trim();

    if (!text) {
      return [];
    }

    const startOffset = normalized.indexOf(text, searchFrom);
    const safeStartOffset = startOffset >= 0 ? startOffset : searchFrom;
    const endOffset = safeStartOffset + text.length;

    searchFrom = endOffset;

    return [
      {
        id: createId(),
        sourceMaterialId,
        index: index++,
        text,
        startOffset: safeStartOffset,
        endOffset,
        createdAt,
      },
    ];
  });
}

export function cleanTextContent(content: string) {
  return content
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function createSourceMaterial(input: {
  title: string;
  sourceType: SourceMaterialType;
  language?: string;
  goalId?: string;
  originalContent: string;
  cleanedContent: string;
  url?: string;
  fileName?: string;
  metadata?: Record<string, unknown>;
}): SourceMaterial {
  const now = new Date().toISOString();

  return {
    id: createId(),
    goalId: input.goalId ?? "",
    title: input.title.trim() || "未命名学习材料",
    sourceType: input.sourceType,
    language: input.language ?? "",
    originalContent: input.originalContent,
    cleanedContent: input.cleanedContent,
    url: input.url,
    fileName: input.fileName,
    metadata: sanitizeMetadata(input.metadata),
    createdAt: now,
    updatedAt: now,
  };
}

function buildSourceMaterialResult(
  sourceMaterial: SourceMaterial,
  ingestStatus: ContentIngestStatus,
  message: string,
  ingestError?: string,
): SourceMaterialIngestionResult {
  return {
    sourceMaterial,
    learningSegments: createLearningSegmentsForSourceMaterial(sourceMaterial),
    ingestStatus,
    message,
    ingestError,
  };
}

function mapContentInputToSourceMaterialType(
  item: ContentPipelineItem,
): SourceMaterialType {
  if (item.inputMethod === "url") return "url";
  if (item.inputMethod === "file_upload" || item.inputMethod === "local_asset") return "file";
  return "text";
}

function sanitizeMetadata(metadata: Record<string, unknown> | undefined) {
  return Object.fromEntries(
    Object.entries(metadata ?? {}).filter(([, value]) => value !== undefined),
  );
}

function stripFileExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "") || fileName;
}

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
