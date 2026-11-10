import { isTauriDesktop } from "@/src/lib/workspace/desktopStorage";
import { validateDesktopNetworkUrl } from "@/src/lib/security/url";
import { Readability } from "@mozilla/readability";
import type {
  ContentAssetType,
  ContentIngestStatus,
  ContentPipelineItem,
  InboxDraft,
} from "@/src/lib/types";

const MAX_DOCUMENT_CHARACTERS = 250000;
class DocumentLimitError extends Error {}
function requireCompleteDocument(text: string) {
  if (text.length > MAX_DOCUMENT_CHARACTERS) throw new DocumentLimitError("正文超过 250,000 字符，未导入截断内容。请拆分为较短的文件后重试。");
  return text;
}

type UrlIngestResult = {
  title?: string;
  sourceReference: string;
  rawContent: string;
  extractedText: string;
  summary: string;
  ingestStatus: ContentIngestStatus;
  ingestError?: string;
  sourceAssetType: ContentAssetType;
  ingestedAt?: string;
};

type FileIngestResult = {
  sourceReference: string;
  sourceFileName: string;
  sourceFileExt: string;
  sourceMimeType: string;
  sourceAssetType: ContentAssetType;
  rawContent: string;
  extractedText: string;
  summary: string;
  ingestStatus: ContentIngestStatus;
  ingestError?: string;
  ingestedAt?: string;
};

type LocalAssetSelection = {
  reference: string;
  fileName: string;
  extension: string;
  mimeType: string;
  assetType: ContentAssetType;
  kind: "file" | "directory";
};

export async function ingestUrl(sourceUrl: string): Promise<UrlIngestResult> {
  const trimmed = sourceUrl.trim();
  let controller: AbortController | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    const validation = validateDesktopNetworkUrl(trimmed, "内容链接");

    if (!validation.ok) {
      return {
        sourceReference: trimmed,
        rawContent: "",
        extractedText: "",
        summary: "链接已保存，未提取正文。",
        ingestStatus: "partial",
        ingestError: validation.message,
        sourceAssetType: "url",
      };
    }

    const parsedUrl = validation.url;
    controller = new AbortController();
    timeout = setTimeout(() => controller!.abort(), 30000);

    const response = await fetch(parsedUrl.toString(), {
      signal: controller.signal,
      headers: {
        Accept: "text/html,text/plain,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      return {
        sourceReference: trimmed,
        rawContent: "",
        extractedText: "",
        summary: "链接已保存，未提取正文。",
        ingestStatus: "partial",
        ingestError: `HTTP ${response.status}。链接未能读取，请检查链接，或粘贴正文、上传文件。`,
        sourceAssetType: "url",
      };
    }

    const responseText = await response.text();
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    const content = requireCompleteDocument(contentType.includes("text/plain")
      ? responseText.trim()
      : extractReadableText(responseText, parsedUrl.toString()));

    if (!content) {
      return {
        sourceReference: parsedUrl.toString(),
        rawContent: "",
        extractedText: "",
        summary: "链接已保存，未提取正文。",
        ingestStatus: "partial",
        ingestError: "没有提取到可阅读的正文。",
        sourceAssetType: "url",
      };
    }

    return {
      title: extractTitle(responseText) || parsedUrl.hostname,
      sourceReference: parsedUrl.toString(),
      rawContent: content,
      extractedText: content,
      summary: content.slice(0, 180),
      ingestStatus: "ingested",
      sourceAssetType: "url",
      ingestedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      sourceReference: trimmed,
      rawContent: "",
      extractedText: "",
      summary: "链接已保存，未提取正文。",
      ingestStatus: "partial",
      ingestError: error instanceof DocumentLimitError ? error.message
        : controller?.signal.aborted ? "网页读取超时，未导入内容。请重试，或粘贴正文、上传文件。"
        : "无法读取网页，未导入内容。网站可能限制访问，或网络连接失败。请检查链接，或粘贴正文、上传文件。",
      sourceAssetType: "url",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function ingestUploadedFile(file: File): Promise<FileIngestResult> {
  try {
    if (file.size > 25 * 1024 * 1024) throw new DocumentLimitError("文件超过 25 MB，请拆分或压缩后重新导入。");
    const extension = getFileExtension(file.name);
    const mimeType = file.type || inferMimeType(file.name);
    const sourceAssetType = inferAssetType(file.name, file.type);

    if (mimeType.startsWith("image/")) {
      return {
        sourceReference: file.name,
        sourceFileName: file.name,
        sourceFileExt: extension,
        sourceMimeType: mimeType,
        sourceAssetType,
        rawContent: await fileToDataUrl(file),
        extractedText: "",
        summary: "图片文件已保存，可作为视觉材料继续整理。",
        ingestStatus: "partial",
        ingestError: "图片当前只保存文件信息和预览，不会自动识别画面内容。",
        ingestedAt: new Date().toISOString(),
      };
    }

    const rawText = await extractTextFromUploadedFile(file, sourceAssetType);
    const status = rawText ? "ingested" : "partial";

    return {
      sourceReference: file.name,
      sourceFileName: file.name,
      sourceFileExt: extension,
      sourceMimeType: mimeType,
      sourceAssetType,
      rawContent: rawText,
      extractedText: rawText,
      summary:
        rawText.slice(0, 180) ||
        (status === "partial" ? "文件已保存，未提取正文。" : "文件已读取。"),
      ingestStatus: status,
      ingestError: !rawText ? "没有提取到可阅读正文。这不是学习语言限制：扫描版或图片型 PDF 需要文字识别，受保护文件需要先解锁，也可以直接粘贴正文。" : undefined,
      ingestedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      sourceReference: file.name,
      sourceFileName: file.name,
      sourceFileExt: getFileExtension(file.name),
      sourceMimeType: file.type || "application/octet-stream",
      sourceAssetType: inferAssetType(file.name, file.type),
      rawContent: "",
      extractedText: "",
      summary: "文件已保存，未提取正文。",
      ingestStatus: "failed",
      ingestError: describeDocumentReadError(error),
    };
  }
}

export async function pickLocalAssetSelection(
  mode: "file" | "directory",
): Promise<LocalAssetSelection | null> {
  if (!isTauriDesktop()) {
    return null;
  }

  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({
    multiple: false,
    directory: mode === "directory",
    filters:
      mode === "file"
        ? [
            {
              name: "Reading material",
              extensions: [
                "txt",
                "md",
                "json",
                "csv",
                "html",
                "htm",
                "pdf",
                "docx",
              ],
            },
          ]
        : undefined,
  });

  if (!selected || Array.isArray(selected)) {
    return null;
  }

  const fileName = getLeafName(selected);
  const extension = mode === "file" ? getFileExtension(fileName) : "";

  return {
    reference: selected,
    fileName,
    extension,
    mimeType: inferMimeType(fileName),
    assetType: mode === "directory" ? "directory" : inferAssetType(fileName),
    kind: mode,
  };
}

export async function ingestLocalAsset(
  selection: LocalAssetSelection,
): Promise<FileIngestResult> {
  if (selection.kind === "directory") {
    return {
      sourceReference: selection.reference,
      sourceFileName: selection.fileName,
      sourceFileExt: "",
      sourceMimeType: "inode/directory",
      sourceAssetType: "directory",
      rawContent: "",
      extractedText: "",
      summary: "文件夹信息已保存，正文待提取。",
      ingestStatus: "partial",
      ingestError: "当前只保存文件夹信息，不会自动读取目录内容。",
    };
  }

  if (!isTauriDesktop()) {
    return {
      sourceReference: selection.reference,
      sourceFileName: selection.fileName,
      sourceFileExt: selection.extension,
      sourceMimeType: selection.mimeType,
      sourceAssetType: selection.assetType,
      rawContent: "",
      extractedText: "",
      summary: "文件信息已保存，正文待提取。",
      ingestStatus: "partial",
      ingestError: "当前不是桌面环境，不能直接读取本地文件正文。",
    };
  }

  if (isBinaryDocumentAsset(selection.assetType, selection.extension)) {
    try {
      const { readFile } = await import("@tauri-apps/plugin-fs");
      const bytes = await readFile(selection.reference);
      const content = await extractTextFromBinaryDocument(
        toArrayBuffer(bytes),
        selection.assetType,
      );
      const status = content ? "ingested" : "partial";

      return {
        sourceReference: selection.reference,
        sourceFileName: selection.fileName,
        sourceFileExt: selection.extension,
        sourceMimeType: selection.mimeType,
        sourceAssetType: selection.assetType,
        rawContent: content,
        extractedText: content,
        summary:
          content.slice(0, 180) ||
          (status === "partial" ? "文件信息已保存，未提取正文。" : "文件已读取。"),
        ingestStatus: status,
        ingestError: status === "partial" ? "没有提取到可阅读正文。这不是学习语言限制：扫描版或图片型 PDF 需要文字识别，受保护文件需要先解锁，也可以直接粘贴正文。" : undefined,
        ingestedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        sourceReference: selection.reference,
        sourceFileName: selection.fileName,
        sourceFileExt: selection.extension,
        sourceMimeType: selection.mimeType,
        sourceAssetType: selection.assetType,
        rawContent: "",
        extractedText: "",
        summary: "文件信息已保存，正文待提取。",
        ingestStatus: "failed",
        ingestError: describeDocumentReadError(error),
      };
    }
  }

  if (!isTextLikeAsset(selection.assetType, selection.extension)) {
    return {
      sourceReference: selection.reference,
      sourceFileName: selection.fileName,
      sourceFileExt: selection.extension,
      sourceMimeType: selection.mimeType,
      sourceAssetType: selection.assetType,
      rawContent: "",
      extractedText: "",
      summary: "文件信息已保存，正文待提取。",
      ingestStatus: "partial",
      ingestError:
        selection.assetType === "pdf"
          ? "当前 PDF 只保存文件信息，未自动提取正文。"
          : "当前文件类型只保存来源信息，未自动提取正文。",
    };
  }

  try {
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    const content = requireCompleteDocument(normalizeExtractedText(
      await readTextFile(selection.reference),
      selection.assetType,
    ).trim());

    if (!content) {
      return {
        sourceReference: selection.reference,
        sourceFileName: selection.fileName,
        sourceFileExt: selection.extension,
        sourceMimeType: selection.mimeType,
        sourceAssetType: selection.assetType,
        rawContent: "",
        extractedText: "",
        summary: "文件信息已保存，正文待提取。",
        ingestStatus: "partial",
        ingestError: "本地文件已打开，但没有提取到可用正文。",
      };
    }

    return {
      sourceReference: selection.reference,
      sourceFileName: selection.fileName,
      sourceFileExt: selection.extension,
      sourceMimeType: selection.mimeType,
      sourceAssetType: selection.assetType,
      rawContent: content,
      extractedText: content,
      summary: content.slice(0, 180),
      ingestStatus: "ingested",
      ingestedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      sourceReference: selection.reference,
      sourceFileName: selection.fileName,
      sourceFileExt: selection.extension,
      sourceMimeType: selection.mimeType,
      sourceAssetType: selection.assetType,
      rawContent: "",
      extractedText: "",
      summary: "文件信息已保存，正文待提取。",
      ingestStatus: "failed",
      ingestError: error instanceof Error ? error.message : "本地文件读取失败。",
    };
  }
}

export function applyIngestResultToDraft(
  draft: InboxDraft,
  result: UrlIngestResult | FileIngestResult,
): InboxDraft {
  return {
    ...draft,
    title: draft.title.trim() || ("title" in result && result.title ? result.title : draft.title),
    sourceReference: result.sourceReference,
    sourceFileName: "sourceFileName" in result ? result.sourceFileName : draft.sourceFileName,
    sourceFileExt: "sourceFileExt" in result ? result.sourceFileExt : draft.sourceFileExt,
    sourceMimeType: "sourceMimeType" in result ? result.sourceMimeType : draft.sourceMimeType,
    sourceAssetType: result.sourceAssetType,
    summary:
      result.summary ||
      draft.summary,
    rawContent: result.rawContent || draft.rawContent,
    notes:
      result.ingestError && !draft.notes?.includes(result.ingestError)
        ? `${draft.notes?.trim() ? `${draft.notes.trim()}\n` : ""}${result.ingestError}`
        : draft.notes,
  };
}

export function applyIngestResultToContentItem(
  item: ContentPipelineItem,
  result: UrlIngestResult | FileIngestResult,
): ContentPipelineItem {
  const nextDescription =
    result.summary ||
    result.rawContent.slice(0, 120) ||
    result.sourceReference ||
    item.description;

  return {
    ...item,
    title: item.title.trim() || ("title" in result && result.title ? result.title : item.title),
    description: nextDescription,
    sourceReference: result.sourceReference,
    sourceFileName:
      "sourceFileName" in result ? result.sourceFileName : item.sourceFileName,
    sourceFileExt: "sourceFileExt" in result ? result.sourceFileExt : item.sourceFileExt,
    sourceMimeType: "sourceMimeType" in result ? result.sourceMimeType : item.sourceMimeType,
    sourceAssetType: result.sourceAssetType,
    summary: result.summary || item.summary,
    rawContent: result.rawContent || item.rawContent,
    extractedText: result.extractedText || item.extractedText,
    ingestStatus: result.ingestStatus,
    ingestError: result.ingestError,
    ingestedAt: result.ingestedAt,
    notes:
      result.ingestError && !item.notes?.includes(result.ingestError)
        ? `${item.notes?.trim() ? `${item.notes.trim()}\n` : ""}${result.ingestError}`
        : item.notes,
  };
}

export function getIngestStatusLabel(status: ContentIngestStatus | undefined) {
  if (status === "ingesting") return "正在读取";
  if (status === "ingested") return "已提取正文";
  if (status === "partial") return "部分提取";
  if (status === "failed") return "读取失败";
  return "已保存来源信息";
}

function getLeafName(path: string) {
  return path.split(/[/\\]/).filter(Boolean).pop() || path;
}

function getFileExtension(fileName: string) {
  const match = /\.([^.]+)$/.exec(fileName.trim());

  return match?.[1]?.toLowerCase() || "";
}

function inferMimeType(fileName: string) {
  const extension = getFileExtension(fileName);

  if (extension === "txt") return "text/plain";
  if (extension === "md" || extension === "markdown") return "text/markdown";
  if (extension === "json") return "application/json";
  if (extension === "csv") return "text/csv";
  if (extension === "html" || extension === "htm") return "text/html";
  if (extension === "pdf") return "application/pdf";
  if (extension === "docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (["png", "jpg", "jpeg", "webp"].includes(extension)) return `image/${extension === "jpg" ? "jpeg" : extension}`;

  return "application/octet-stream";
}

function inferAssetType(fileName: string, mimeType = ""): ContentAssetType {
  const extension = getFileExtension(fileName);
  const lowerMime = mimeType.toLowerCase();

  if (lowerMime.startsWith("image/") || ["png", "jpg", "jpeg", "webp"].includes(extension)) {
    return "image";
  }
  if (extension === "txt") return "text";
  if (extension === "md" || extension === "markdown") return "markdown";
  if (extension === "json") return "json";
  if (extension === "csv") return "csv";
  if (extension === "html" || extension === "htm") return "html";
  if (extension === "pdf") return "pdf";
  if (extension === "docx") return "docx";
  return "file";
}

function extractTitle(html: string) {
  return decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

async function extractTextFromUploadedFile(file: File, assetType: ContentAssetType) {
  if (isBinaryDocumentAsset(assetType, getFileExtension(file.name))) {
    return extractTextFromBinaryDocument(await file.arrayBuffer(), assetType);
  }

  if (!isTextLikeAsset(assetType, getFileExtension(file.name))) {
    throw new Error("暂不支持此文件格式。请选择 TXT、Markdown、HTML、PDF 或 DOCX 文件。");
  }

  return requireCompleteDocument(normalizeExtractedText(await file.text(), assetType).trim());
}

async function extractTextFromBinaryDocument(buffer: ArrayBuffer, assetType: ContentAssetType) {
  if (assetType === "pdf") {
    return extractTextFromPdfBuffer(buffer);
  }

  if (assetType === "docx") {
    return extractTextFromDocxBuffer(buffer);
  }

  return "";
}

function extractReadableText(html: string, sourceUrl?: string) {
  if (typeof DOMParser !== "undefined") {
    try {
      const document = new DOMParser().parseFromString(html, "text/html");

      if (sourceUrl) {
        const base = document.createElement("base");
        base.href = sourceUrl;
        document.head.prepend(base);
      }

      const article = new Readability(document.cloneNode(true) as Document, {
        charThreshold: 120,
      }).parse();
      const readableText = article?.textContent?.trim();

      if (readableText) {
        return normalizeWhitespace(readableText);
      }
    } catch {
      // Fall through to the conservative HTML stripper below.
    }
  }

  const body =
    html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1] ??
    html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] ??
    html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ??
    html;

  return decodeEntities(normalizeHtmlText(body)).trim();
}

function decodeEntities(text: string) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

async function extractTextFromPdfBuffer(buffer: ArrayBuffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    cMapUrl: new URL("/pdfjs/cmaps/", window.location.href).toString(),
    cMapPacked: true,
    standardFontDataUrl: new URL("/pdfjs/standard_fonts/", window.location.href).toString(),
  });
  const pdf = await loadingTask.promise;
  const pageTexts: string[] = [];
  const pageLimit = pdf.numPages;

  try {
    if (pageLimit > 300) throw new DocumentLimitError("PDF 超过 300 页，未导入截断内容。请按章节拆分后重试。");
    for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const text = textContent.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ");

      if (text.trim()) {
        pageTexts.push(text.trim());
      }
    }
  } finally {
    await pdf.destroy();
  }
  return requireCompleteDocument(normalizeWhitespace(pageTexts.join("\n\n")));
}

async function extractTextFromDocxBuffer(buffer: ArrayBuffer) {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });

  return requireCompleteDocument(normalizeWhitespace(result.value));
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("图片读取失败。"));
    reader.readAsDataURL(file);
  });
}

export function describeDocumentReadError(error: unknown) {
  if (error instanceof DocumentLimitError) return error.message;
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (message === "暂不支持此文件格式。请选择 TXT、Markdown、HTML、PDF 或 DOCX 文件。") return message;
  if (name === "PasswordException") return "文件受密码保护，请先解锁文件后重新导入。这不是学习语言限制。";
  if (name === "InvalidPDFException") return "PDF 文件损坏或格式无效，请检查文件是否完整。这不是学习语言限制。";
  if (/worker|dynamically imported module|cMapUrl/i.test(message)) return "PDF 读取组件未能加载，请刷新页面后重试。这不是材料语言的问题。";
  if (/扫描|图片型|protected|扫描件|提取不完整/i.test(message)) return "没有提取到可阅读正文。这不是学习语言限制：扫描版或图片型 PDF 需要文字识别，受保护文件需要先解锁，也可以直接粘贴正文。";
  return "文件解析失败，请检查文件是否完整、格式是否正确，或直接粘贴正文。这不是学习语言限制。";
}

function isTextLikeAsset(assetType: ContentAssetType, extension: string) {
  return (
    ["text", "markdown", "json", "csv", "html"].includes(assetType) ||
    ["txt", "md", "json", "csv", "html", "htm"].includes(extension)
  );
}

function isBinaryDocumentAsset(assetType: ContentAssetType, extension: string) {
  return assetType === "pdf" || assetType === "docx" || extension === "pdf" || extension === "docx";
}

function normalizeExtractedText(text: string, assetType: ContentAssetType) {
  if (assetType === "json") {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  }

  if (assetType === "html") {
    return extractReadableText(text);
  }

  return text;
}

function toArrayBuffer(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function normalizeWhitespace(text: string) {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeHtmlText(text: string) {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}
