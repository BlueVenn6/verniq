import { describe, expect, it } from "vitest";
import { getCardImageFrame, getCardImagePlacement } from "@/src/lib/publish/publishImagePlacement";
import { getPublishRatio } from "@/src/lib/publish/publishPresets";

describe("share card image framing", () => {
  it("uses exactly half of each card without an inset margin", () => {
    for (const id of ["1:1", "4:5", "16:9"] as const) {
      const ratio = getPublishRatio(id);
      expect(getCardImageFrame(ratio, "image_top")).toEqual({ x: 0, y: 0, width: ratio.width, height: ratio.height / 2 });
      expect(getCardImageFrame(ratio, "image_left")).toEqual({ x: 0, y: 0, width: ratio.width / 2, height: ratio.height });
      expect(getCardImageFrame(ratio, "pure_text")).toBeNull();
    }
  });

  it("keeps the full image region covered at every zoom and pan boundary", () => {
    const frame = getCardImageFrame(getPublishRatio("1:1"), "image_top")!;
    for (const size of [{ imageWidth: 400, imageHeight: 1200 }, { imageWidth: 1600, imageHeight: 400 }]) {
      for (const zoom of [0.1, 1, 2, 3, 10]) for (const x of [-5, 0, 0.5, 1, 5]) for (const y of [-5, 0, 0.5, 1, 5]) {
        const image = getCardImagePlacement(frame, { ...size, imageZoom: zoom, imagePositionX: x, imagePositionY: y });
        expect(image.x).toBeLessThanOrEqual(0);
        expect(image.y).toBeLessThanOrEqual(0);
        expect(image.x + image.width).toBeGreaterThanOrEqual(frame.width);
        expect(image.y + image.height).toBeGreaterThanOrEqual(frame.height);
        expect(image.width / image.height).toBeCloseTo(size.imageWidth / size.imageHeight);
      }
    }
  });

  it("moves the visible composition continuously while preserving legacy top/bottom selections", () => {
    const frame = getCardImageFrame(getPublishRatio("1:1"), "image_top")!;
    const size = { imageWidth: 400, imageHeight: 1200 };
    expect(getCardImagePlacement(frame, { ...size, imagePositionY: 0.25 }).y).toBe(-1000);
    expect(getCardImagePlacement(frame, { ...size, imageCrop: "bottom" }).y).toBe(-4000);
    expect(getCardImagePlacement(frame, { ...size, imageCrop: "top" }).y).toBeCloseTo(0);
  });
});
