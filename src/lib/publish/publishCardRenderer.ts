import type {
  PublishBrandMode,
  PublishImageCropId,
  PublishLayoutId,
  PublishRatio,
  PublishCardFontId,
} from "@/src/lib/publish/publishPresets";
import { resolvePublishLayout } from "./publishPresets";
import { getCardImageFrame, getCardImagePlacement } from "./publishImagePlacement";

export type PublishCardRenderInput = {
  ratio: PublishRatio;
  layout: PublishLayoutId;
  imageCrop: PublishImageCropId;
  brandMode: PublishBrandMode;
  title: string;
  subtitle: string;
  body: string;
  footer: string;
  imageDataUrl?: string;
  customName?: string;
  logoDataUrl?: string;
  emptyMessage?: string;
  fontFamily?: PublishCardFontId;
  fontScale?: number;
  fontWeight?: number;
  textAlign?: "left" | "center";
  imageWidth?: number;
  imageHeight?: number;
  imageZoom?: number;
  imagePositionX?: number;
  imagePositionY?: number;
};

export function publishCardFits(input: PublishCardRenderInput) {
  const { width, height } = input.ratio;
  const margin = Math.round(Math.min(width, height) * 0.075);
  const layout = resolvePublishLayout(input.layout, input.ratio.id);
  const hasImage = layout !== "pure_text" && Boolean(input.imageDataUrl);
  const box = resolveTextBox({ width, height, margin, hasImage, splitAsTop: hasImage && layout === "image_top" });
  return fitCardText(input, box.width, height - margin - 110 - box.y).fits;
}

export function buildPublishCardSvg(input: PublishCardRenderInput) {
  const { width, height } = input.ratio;
  const margin = Math.round(Math.min(width, height) * 0.075);
  const layout = resolvePublishLayout(input.layout, input.ratio.id);
  const hasImage = layout !== "pure_text" && Boolean(input.imageDataUrl);
  const splitAsTop = hasImage && layout === "image_top";
  const textBox = resolveTextBox({
    width,
    height,
    margin,
    hasImage,
    splitAsTop,
  });

  const availableHeight = height - margin - 110 - textBox.y;
  const fitted = fitCardText(input, textBox.width, availableHeight);
  const contentTop = textBox.y + Math.max(0, (availableHeight - fitted.contentHeight) / 2);
  const titleY = contentTop + fitted.titleSize;
  const bodyY = fitted.fits && input.title.trim() ? titleY + Math.max(0, fitted.titleLines.length - 1) * fitted.titleSize * 1.25 + fitted.bodySize * 1.6 : contentTop + fitted.bodySize;
  const textX = input.textAlign === "center" ? textBox.x + textBox.width / 2 : textBox.x;
  const family = input.fontFamily ? cardFontFamily(input.fontFamily) : undefined;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="display:block;width:100%;height:auto" data-card-fits="${fitted.fits}">`,
    `<rect width="${width}" height="${height}" fill="#faf3e6"/>`,
    renderImage(input),
    input.subtitle ? `<text x="${textBox.x}" y="${textBox.y}" fill="#d4a261" font-family="${escapeXml(sansFont())}" font-size="${Math.round(textBox.small)}" font-weight="700">${escapeXml(input.subtitle)}</text>` : "",
    renderWrappedText({
      text: fitted.fits ? input.title : "",
      x: textX,
      y: titleY,
      maxUnits: textBox.width / fitted.titleSize,
      maxLines: Infinity,
      fontSize: fitted.titleSize,
      lineHeight: fitted.titleSize * 1.25,
      color: "#1f1e1c",
      family: family || serifFont(),
      weight: input.fontWeight || 560,
      align: input.textAlign,
    }),
    renderWrappedText({
      text: fitted.fits && input.body.trim() ? input.body : input.emptyMessage || "Add a short quote, word or reflection.",
      x: textX,
      y: bodyY,
      maxUnits: textBox.width / fitted.bodySize,
      maxLines: Infinity,
      fontSize: fitted.bodySize,
      lineHeight: fitted.bodySize * 1.6,
      color: "#6e675e",
      family: family || sansFont(),
      weight: input.fontWeight || 400,
      align: input.textAlign,
    }),
    `<text x="${textBox.x}" y="${height - margin - 44}" fill="#6e675e" font-family="${escapeXml(sansFont())}" font-size="${Math.round(textBox.small)}" font-weight="500">${escapeXml(input.footer)}</text>`,
    renderBrand(input, width, height, margin, textBox.x, textBox.width),
    `</svg>`,
  ].join("");
}

function renderImage(input: PublishCardRenderInput) {
  const frame = getCardImageFrame(input.ratio, input.layout);
  if (!frame || !input.imageDataUrl) return "";
  const image = getCardImagePlacement(frame, input);
  return `<svg data-card-image-region="true" x="${frame.x}" y="${frame.y}" width="${frame.width}" height="${frame.height}" viewBox="0 0 ${frame.width} ${frame.height}" overflow="hidden"><image href="${escapeXml(input.imageDataUrl)}" x="${image.x}" y="${image.y}" width="${image.width}" height="${image.height}" preserveAspectRatio="none"/></svg>`;
}

function resolveTextBox({
  width,
  height,
  margin,
  hasImage,
  splitAsTop,
}: {
  width: number;
  height: number;
  margin: number;
  hasImage: boolean;
  splitAsTop: boolean;
}) {
  const base = Math.min(width, height);

  if (hasImage && !splitAsTop) {
    const x = width / 2 + margin * 0.65;

    return {
      x,
      y: margin,
      width: width - x - margin,
      titleSize: base * 0.055,
      bodySize: base * 0.027,
      small: base * 0.018,
    };
  }

  if (hasImage && splitAsTop) {
    return {
      x: margin,
      y: height / 2 + margin * 0.65,
      width: width - margin * 2,
      titleSize: base * 0.06,
      bodySize: base * 0.03,
      small: base * 0.02,
    };
  }

  return {
    x: margin,
    y: Math.round(height * 0.17),
    width: width - margin * 2,
    titleSize: base * 0.064,
    bodySize: base * 0.031,
    small: base * 0.02,
  };
}

function renderBrand(input: PublishCardRenderInput, width: number, height: number, margin: number, x: number, textWidth: number) {
  const mode = input.brandMode;
  if (mode === "none") return "";
  if (mode === "custom_logo") return /^data:image\/(?:png|jpeg|webp);base64,/.test(input.logoDataUrl || "")
    ? `<image href="${escapeXml(input.logoDataUrl!)}" x="${x}" y="${height - margin - 32}" width="160" height="64" preserveAspectRatio="xMinYMid meet"/>` : "";
  const name = mode === "custom_name" ? input.customName?.trim() || "" : "Made with Verniq";
  const size = Math.min(Math.min(width, height) * 0.02, textWidth / Math.max(1, textUnits(name)));
  return `<text x="${x}" y="${height - margin + 2}" fill="#6e675e" font-family="${escapeXml(sansFont())}" font-size="${Math.round(size)}" font-weight="600">${escapeXml(name)}</text>`;
}

function renderWrappedText({
  text,
  x,
  y,
  maxUnits,
  maxLines,
  fontSize,
  lineHeight,
  color,
  family,
  weight,
  align,
}: {
  text: string;
  x: number;
  y: number;
  maxUnits: number;
  maxLines: number;
  fontSize: number;
  lineHeight: number;
  color: string;
  family: string;
  weight: number;
  align?: "left" | "center";
}) {
  const lines = wrapText(text, maxUnits, maxLines);

  return [
    `<text x="${x}" y="${y}" text-anchor="${align === "center" ? "middle" : "start"}" fill="${color}" font-family="${escapeXml(family)}" font-size="${Math.round(fontSize)}" font-weight="${weight}">`,
    ...lines.map((line, index) =>
      `<tspan x="${x}" dy="${index === 0 ? 0 : Math.round(lineHeight)}">${escapeXml(line)}</tspan>`,
    ),
    `</text>`,
  ].join("");
}

function wrapText(text: string, maxUnits: number, maxLines: number) {
  const tokens = text.trim().match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*[.,!?;:]?|[^\S\n]+|\n|[^\x00-\x7F]|./gu) ?? [];
  const lines: string[] = [];
  let current = "";

  tokens.forEach((token) => {
    if (token === "\n") { if (current.trim()) lines.push(current.trim()); current = ""; return; }
    const candidate = current + token;
    if (textUnits(candidate) <= maxUnits) {
      current = candidate;
      return;
    }
    if (current.trim()) lines.push(current.trim());
    current = token.trimStart();
  });

  if (current) lines.push(current);

  return lines.slice(0, maxLines);
}

function fitCardText(input: PublishCardRenderInput, width: number, availableHeight: number) {
  const base = Math.min(input.ratio.width, input.ratio.height);
  for (let scale = input.fontScale || 1; scale >= (input.fontScale || 0.35); scale -= 0.025) {
    const titleSize = Math.round(base * 0.058 * scale), bodySize = Math.round(base * 0.032 * scale);
    const titleLines = wrapText(input.title, width / titleSize, Infinity), bodyLines = wrapText(input.body, width / bodySize, Infinity);
    const fitsWidth = titleLines.every(line => textUnits(line) * titleSize <= width) && bodyLines.every(line => textUnits(line) * bodySize <= width);
    // Match the actual baselines below: reserve the title gap only when there
    // is a title, and count body line gaps between lines, plus descenders.
    const titleHeight = titleLines.length ? titleSize * (1 + Math.max(0, titleLines.length - 1) * 1.25) : 0;
    const contentHeight = titleHeight + bodySize * ((titleLines.length ? 1.85 : 1.25) + Math.max(0, bodyLines.length - 1) * 1.6);
    if (fitsWidth && contentHeight <= availableHeight) return { fits: true, titleSize, bodySize, titleLines, contentHeight };
  }
  // Keep an explanatory placeholder readable when a chosen size does not fit.
  return { fits: false, titleSize: Math.round(base * 0.04), bodySize: Math.round(base * 0.025), titleLines: [] as string[], contentHeight: 150 };
}

export function cardFontFamily(id: PublishCardFontId) {
  return id === "serif" ? '"Verniq Card Serif"' : '"Verniq Card Sans"';
}

function textUnits(text: string) {
  return Array.from(text).reduce((total, char) => {
    if (/[\u4e00-\u9fff]/.test(char)) return total + 1;
    if (/\s/.test(char)) return total + 0.35;
    if (/[MW@%]/.test(char)) return total + 1;
    if (/[^\x00-\x7F]/.test(char)) return total + 1.15;
    return total + 0.68;
  }, 0);
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function serifFont() {
  return `"Noto Serif SC", "Source Han Serif SC", SimSun, Georgia, serif`;
}

function sansFont() {
  return `"Noto Sans SC", "Microsoft YaHei UI", "PingFang SC", "Segoe UI", sans-serif`;
}
