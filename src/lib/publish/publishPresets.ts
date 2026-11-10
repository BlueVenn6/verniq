export type PublishMode = "text" | "card";
export type PublishOutputId = "text_note" | "share_card";
export type PublishLayoutId = "pure_text" | "split" | "image_top" | "image_left";
export type PublishCardFontId = "sans" | "serif";
export type PublishImageCropId = "center" | "top" | "bottom";
export type PublishBrandMode = "none" | "made_with" | "custom_name" | "custom_logo";
export type PublishRatioId = "1:1" | "4:5" | "16:9";
export type PublishToneId = "calm" | "direct" | "warm" | "editorial";
export type PublishLengthId = "short" | "medium" | "long";

export type PublishRatio = {
  id: PublishRatioId;
  label: string;
  fit: string;
  width: number;
  height: number;
};

export type PublishDraftSettings = {
  mode: PublishMode;
  purpose: string;
  audience: string;
  tone: PublishToneId;
  length: PublishLengthId;
  customInstruction: string;
  aiModelId?: string;
  aiReflection?: string;
  aiInstruction?: string;
  outputLanguage?: string;
};

export type PublishVisualSettings = {
  layout: PublishLayoutId;
  imageCrop: PublishImageCropId;
  ratioId: PublishRatioId;
  brandMode: PublishBrandMode;
  customName?: string;
  logoDataUrl?: string;
  cardText?: string;
  cardTitle?: string;
  fontFamily?: PublishCardFontId;
  fontScale?: number;
  fontWeight?: number;
  textAlign?: "left" | "center";
  imageZoom?: number;
  imagePositionX?: number;
  imagePositionY?: number;
};

export type PublishGeneratedDraft = {
  title: string;
  subtitle: string;
  body: string;
  markdown: string;
  sourceLabel: string;
};

export const PUBLISH_RATIOS: PublishRatio[] = [
  {
    id: "1:1",
    label: "1:1",
    fit: "通用方形",
    width: 1600,
    height: 1600,
  },
  {
    id: "4:5",
    label: "4:5",
    fit: "图文分享",
    width: 1600,
    height: 2000,
  },
  {
    id: "16:9",
    label: "16:9",
    fit: "横版封面",
    width: 1920,
    height: 1080,
  },
];

export const PUBLISH_LAYOUTS: Array<{
  id: PublishLayoutId;
  label: string;
  description: string;
}> = [
  {
    id: "pure_text",
    label: "纯文字",
    description: "以排版和留白作为视觉主体。",
  },
  {
    id: "image_top",
    label: "上图下文",
    description: "图片铺满上半部，文字在下半部。图片贴边，无内框。",
  },
  { id: "image_left", label: "左图右文", description: "图片铺满左半部，文字在右半部。图片贴边，无内框。" },
];

export function resolvePublishLayout(layout: PublishLayoutId, ratio: PublishRatioId) {
  return layout === "split" ? ratio === "4:5" ? "image_top" : "image_left" : layout;
}

export const PUBLISH_BRAND_MODES: Array<{
  id: PublishBrandMode;
  label: string;
}> = [
  {
    id: "none",
    label: "不显示品牌",
  },
  {
    id: "made_with",
    label: "Made with Verniq",
  },
  { id: "custom_name", label: "自定义署名" },
  { id: "custom_logo", label: "自己的 Logo" },
];

export const PUBLISH_TONES: Array<{
  id: PublishToneId;
  label: string;
}> = [
  { id: "calm", label: "平静可信" },
  { id: "direct", label: "直接清楚" },
  { id: "warm", label: "温和解释" },
  { id: "editorial", label: "编辑感" },
];

export const PUBLISH_LENGTHS: Array<{
  id: PublishLengthId;
  label: string;
}> = [
  { id: "short", label: "短" },
  { id: "medium", label: "中等" },
  { id: "long", label: "长" },
];

export const DEFAULT_PUBLISH_SETTINGS: PublishDraftSettings = {
  mode: "text",
  purpose: "",
  audience: "",
  tone: "calm",
  length: "medium",
  customInstruction: "",
};

export const DEFAULT_VISUAL_SETTINGS: PublishVisualSettings = {
  layout: "pure_text",
  imageCrop: "center",
  ratioId: "4:5",
  brandMode: "none",
  fontFamily: "serif",
  fontScale: 1.4,
  fontWeight: 600,
  textAlign: "left",
  imageZoom: 1,
  imagePositionX: 0.5,
  imagePositionY: 0.5,
};

export function getPublishRatio(id: PublishRatioId) {
  return PUBLISH_RATIOS.find((ratio) => ratio.id === id) ?? PUBLISH_RATIOS[1];
}
