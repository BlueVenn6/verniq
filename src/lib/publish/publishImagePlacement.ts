import { resolvePublishLayout, type PublishImageCropId, type PublishLayoutId, type PublishRatio } from "./publishPresets";

export type CardImageFrame = { x: number; y: number; width: number; height: number };

export function getCardImageFrame(ratio: PublishRatio, layout: PublishLayoutId): CardImageFrame | null {
  const resolved = resolvePublishLayout(layout, ratio.id);
  if (resolved === "pure_text") return null;
  return { x: 0, y: 0, width: resolved === "image_left" ? ratio.width / 2 : ratio.width, height: resolved === "image_top" ? ratio.height / 2 : ratio.height };
}

export function getCardImagePlacement(frame: CardImageFrame, options: {
  imageWidth?: number; imageHeight?: number; imageZoom?: number;
  imagePositionX?: number; imagePositionY?: number; imageCrop?: PublishImageCropId;
}) {
  const imageWidth = options.imageWidth && options.imageWidth > 0 ? options.imageWidth : frame.width;
  const imageHeight = options.imageHeight && options.imageHeight > 0 ? options.imageHeight : frame.height;
  const zoom = clamp(options.imageZoom ?? 1, 1, 3);
  const scale = Math.max(frame.width / imageWidth, frame.height / imageHeight) * zoom;
  const width = imageWidth * scale, height = imageHeight * scale;
  const positionX = clamp(options.imagePositionX ?? 0.5, 0, 1);
  const positionY = clamp(options.imagePositionY ?? (options.imageCrop === "top" ? 0 : options.imageCrop === "bottom" ? 1 : 0.5), 0, 1);
  return { width, height, x: (frame.width - width) * positionX, y: (frame.height - height) * positionY, positionX, positionY };
}

export function clamp(value: number, min: number, max: number) {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : (min + max) / 2;
}
