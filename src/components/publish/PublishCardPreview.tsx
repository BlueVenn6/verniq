"use client";

import { useRef, useState } from "react";
import { useLearningUi } from "@/src/components/LanguageProvider";
import { clamp, getCardImageFrame, getCardImagePlacement } from "@/src/lib/publish/publishImagePlacement";
import type { PublishRatio, PublishVisualSettings } from "@/src/lib/publish/publishPresets";

export function PublishCardPreview({ svg, ratio, settings, imageSize, onImageTransformChange }: {
  svg: string; ratio: PublishRatio; settings: PublishVisualSettings;
  imageSize: { width: number; height: number } | null;
  onImageTransformChange: (patch: Partial<PublishVisualSettings>) => void;
}) {
  const { t } = useLearningUi();
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ id: number; x: number; y: number; scale: number; overflowX: number; overflowY: number; positionX: number; positionY: number } | null>(null);
  const frame = getCardImageFrame(ratio, settings.layout);
  const image = frame && imageSize ? getCardImagePlacement(frame, { ...settings, imageWidth: imageSize.width, imageHeight: imageSize.height }) : null;
  const finish = () => { drag.current = null; setDragging(false); };

  return <div data-card-preview="true">
    <div className="relative">
    <div className="[&>svg]:block [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
    {frame && image ? <div
      role="button" tabIndex={0} aria-label={t("拖动图片调整构图")}
      className="absolute outline-offset-[-3px] focus-visible:outline-2 focus-visible:outline-[#6d89a6]"
      style={{ left: `${frame.x / ratio.width * 100}%`, top: `${frame.y / ratio.height * 100}%`, width: `${frame.width / ratio.width * 100}%`, height: `${frame.height / ratio.height * 100}%`, touchAction: "none", userSelect: "none", cursor: dragging ? "grabbing" : "grab" }}
      onPointerDown={event => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
        const renderedWidth = event.currentTarget.getBoundingClientRect().width;
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, scale: frame.width / renderedWidth, overflowX: image.width - frame.width, overflowY: image.height - frame.height, positionX: image.positionX, positionY: image.positionY };
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
      }}
      onPointerMove={event => {
        const start = drag.current;
        if (!start || start.id !== event.pointerId) return;
        onImageTransformChange({
          imagePositionX: start.overflowX > 0.01 ? clamp(start.positionX - (event.clientX - start.x) * start.scale / start.overflowX, 0, 1) : start.positionX,
          imagePositionY: start.overflowY > 0.01 ? clamp(start.positionY - (event.clientY - start.y) * start.scale / start.overflowY, 0, 1) : start.positionY,
        });
      }}
      onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}
      onKeyDown={event => {
        const step = event.shiftKey ? 0.1 : 0.02;
        const directions: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
        const direction = directions[event.key];
        if (!direction) return;
        event.preventDefault();
        onImageTransformChange({ imagePositionX: clamp(image.positionX + (image.width > frame.width ? direction[0] : 0), 0, 1), imagePositionY: clamp(image.positionY + (image.height > frame.height ? direction[1] : 0), 0, 1) });
      }}
    /> : null}
    </div>
    {frame && image ? <p className="mt-3 text-xs leading-6 text-stone-500">{t("在图片上拖动调整构图，使用缩放滑块调整大小。也可聚焦图片后用方向键微调。")}</p> : null}
  </div>;
}
