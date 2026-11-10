import type { PublishRatio } from "@/src/lib/publish/publishPresets";
import { embedPublishCardFonts } from "./publishFonts";

export function markdownToPlainText(markdown: string) {
  return markdown
    .replace(/^```[^\n]*\n|^```\s*$/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

export function getPngCanvasSize(ratio: PublishRatio) {
  return {
    width: ratio.width,
    height: ratio.height,
  };
}

export async function readImageFileAsDataUrl(file: File) {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    throw new Error("请选择图片文件。");
  }

  return readBlobAsDataUrl(file);
}

export async function readLogoFileAsDataUrl(file: File) {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) throw new Error("Logo 请使用不超过 2 MB 的 PNG、JPEG 或 WebP 图片。");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 512 / bitmap.width, 256 / bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("无法创建图片导出画布。");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally { bitmap.close(); }
}

export async function copyTextToClipboard(value: string) {
  if (!value.trim()) return false;

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Fall through to the textarea fallback for desktop WebView.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

export function downloadMarkdown(fileName: string, content: string) {
  downloadBlob(fileName, new Blob([content], { type: "text/markdown;charset=utf-8" }));
}

export async function exportSvgAsPng({
  svg,
  ratio,
  fileName,
}: {
  svg: string;
  ratio: PublishRatio;
  fileName: string;
}) {
  const { width, height } = getPngCanvasSize(ratio);
  const blob = await renderSvgToPngBlob(await embedPublishCardFonts(svg), width, height);

  downloadBlob(fileName, blob);
}

function renderSvgToPngBlob(svg: string, width: number, height: number) {
  return new Promise<Blob>((resolve, reject) => {
    const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      canvas.width = width;
      canvas.height = height;

      if (!context) {
        URL.revokeObjectURL(url);
        reject(new Error("无法创建图片导出画布。"));
        return;
      }

      context.fillStyle = "#f2e9da";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      URL.revokeObjectURL(url);

      canvas.toBlob((result) => {
        if (!result) {
          reject(new Error("PNG 导出失败，请稍后重试。"));
          return;
        }
        resolve(result);
      }, "image/png");
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("卡片渲染失败，请检查图片后重试。"));
    };
    image.src = url;
  });
}

function downloadBlob(fileName: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function readBlobAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("图片读取失败。"));
    reader.readAsDataURL(blob);
  });
}

export function formatDateForFileName(date: Date) {
  return date.toISOString().slice(0, 10);
}
