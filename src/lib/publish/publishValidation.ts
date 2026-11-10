import type { PublishRatio } from "@/src/lib/publish/publishPresets";

export type PublishCardValidation = {
  ok: boolean;
  message: string;
  severity: "ok" | "warning";
};

export function validateShareCardText({
  title,
  body,
  ratio,
}: {
  title: string;
  body: string;
  ratio: PublishRatio;
}): PublishCardValidation {
  const capacity = getCardTextCapacity(ratio);
  const totalLength = Array.from(`${title}${body}`).length;

  if (totalLength <= capacity) {
    return {
      ok: true,
      severity: "ok",
      message: `当前内容适合 ${ratio.label} 卡片。`,
    };
  }

  return {
    ok: false,
    severity: "warning",
    message: `当前内容偏长，建议精简到 ${capacity} 字以内再导出。`,
  };
}

export function getCardTextCapacity(ratio: PublishRatio) {
  if (ratio.id === "16:9") return 150;
  if (ratio.id === "1:1") return 190;
  return 240;
}
