import {
  aiModelDeclaresImageInput,
  aiProviderSupportsImageInput,
} from "@/src/lib/aiConfig";
import { getEffectiveProviderBaseUrl } from "@/src/lib/llm/config";
import type {
  AiModelConfig,
  AiProviderConfig,
  AiTaskRouting,
  InboxDraft,
} from "@/src/lib/types";

export type ParsedImageDataUrl = {
  mimeType: string;
  base64: string;
};

export type ImageTextExtractionRouteStatus = {
  ok: boolean;
  message: string;
  provider?: AiProviderConfig;
  model?: AiModelConfig;
  serviceScope?: "local" | "external";
  imageVerificationStatus?: "unverified" | "verified" | "failed";
};

const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

export function parseImageDataUrl(dataUrl: string): ParsedImageDataUrl {
  const match = /^data:([^;,]+);base64,(.+)$/i.exec(dataUrl.trim());

  if (!match) {
    throw new Error("图片数据格式无效，请重新选择图片。");
  }

  const mimeType = match[1].toLowerCase();
  const base64 = match[2].trim();

  if (!SUPPORTED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new Error("仅支持 PNG、JPG、JPEG 和 WEBP 图片。");
  }

  if (!base64) {
    throw new Error("图片数据为空，请重新选择图片。");
  }

  return {
    mimeType: mimeType === "image/jpg" ? "image/jpeg" : mimeType,
    base64,
  };
}

export function validateImageFileForExtraction(file: File, maxBytes = 8 * 1024 * 1024) {
  const mimeType = (file.type || inferImageMimeType(file.name)).toLowerCase();

  if (!SUPPORTED_IMAGE_MIME_TYPES.has(mimeType)) {
    return {
      ok: false,
      message: "仅支持 PNG、JPG、JPEG 和 WEBP 图片。",
    };
  }

  if (file.size > maxBytes) {
    return {
      ok: false,
      message: "图片不能超过 8 MB。请压缩后再试。",
    };
  }

  return {
    ok: true,
    message: "",
  };
}

/**
 * Passes only user-confirmed text into the normal text import flow. The image,
 * data URL, local path, and unconfirmed model response remain session-only.
 */
export function applyEditedImageTextToInboxDraft({
  draft,
  editedText,
  fileName,
  mimeType,
}: {
  draft: InboxDraft;
  editedText: string;
  fileName: string;
  mimeType: string;
}): InboxDraft {
  const rawContent = editedText.trim();

  if (!rawContent) {
    throw new Error("请先提取图片文字，并确认或编辑后再导入。");
  }

  const normalizedFileName = fileName.trim();
  const extension = normalizedFileName.split(".").pop()?.trim().toLowerCase() ?? "";

  return {
    ...draft,
    inputMethod: "direct_paste",
    sourceReference: normalizedFileName || draft.sourceReference,
    sourceFileName: normalizedFileName || undefined,
    sourceFileExt: extension || undefined,
    sourceMimeType: mimeType.trim().toLowerCase() || undefined,
    sourceAssetType: "image",
    rawContent,
  };
}

export function getImageTextExtractionRouteStatus({
  aiProviders,
  aiModels,
  aiTaskRouting,
}: {
  aiProviders: AiProviderConfig[];
  aiModels: AiModelConfig[];
  aiTaskRouting: AiTaskRouting;
}): ImageTextExtractionRouteStatus {
  const route = aiTaskRouting.imageTextExtraction;

  if (!route?.providerId || !route.modelId) {
    return {
      ok: false,
      message: "尚未配置支持图片的模型。请先在设置中选择并验证视觉模型。",
    };
  }

  const provider = aiProviders.find((item) => item.id === route.providerId);
  const model = aiModels.find((item) => item.id === route.modelId);

  if (!provider || !model || model.providerId !== provider.id) {
    return {
      ok: false,
      message: "图片文字提取的 AI 服务和模型不一致，请在设置中重新选择。",
    };
  }

  if (!provider.enabled || !model.enabled) {
    return {
      ok: false,
      provider,
      model,
      message: "图片文字提取使用的 AI 服务或模型尚未启用。",
    };
  }

  if (provider.connectionVerification?.status !== "verified") {
    return {
      ok: false,
      provider,
      model,
      serviceScope: getAiServiceScope(provider),
      message: "图片文字提取服务尚未完成连接验证。请先在设置中验证连接。",
    };
  }

  if (!aiProviderSupportsImageInput(provider)) {
    return {
      ok: false,
      provider,
      model,
      message: "当前 AI 服务协议未接入图片输入，请选择支持图片的服务和模型。",
    };
  }

  if (!aiModelDeclaresImageInput(model)) {
    return {
      ok: false,
      provider,
      model,
      message: "尚未配置支持图片的模型。请先在设置中选择并验证视觉模型。",
    };
  }

  const imageVerificationStatus = model.capabilityVerification?.image ?? "unverified";

  if (imageVerificationStatus !== "verified") {
    return {
      ok: false,
      provider,
      model,
      imageVerificationStatus,
      serviceScope: getAiServiceScope(provider),
      message:
        imageVerificationStatus === "failed"
          ? "当前模型的图片验证失败，不能用于图片文字提取。"
          : "该模型的图片能力尚未验证。请先在设置中执行图片验证。",
    };
  }

  return {
    ok: true,
    provider,
    model,
    imageVerificationStatus,
    serviceScope: getAiServiceScope(provider),
    message: "已配置可用的图片文字提取模型。",
  };
}

export function getAiServiceScope(provider: AiProviderConfig): "local" | "external" {
  if (provider.isLocal || provider.providerType === "local") return "local";

  const baseUrl = getEffectiveProviderBaseUrl(provider);

  try {
    const url = new URL(baseUrl);
    const host = url.hostname.toLowerCase();

    if (host === "localhost" || host === "127.0.0.1") return "local";
  } catch {
    // Invalid URLs are handled by the request builder.
  }

  return "external";
}

export function buildImageTextExtractionPrompt() {
  return [
    "Extract the text visible in the image, including English and Chinese.",
    "Keep the original language and reading order.",
    "Preserve paragraphs and line breaks when they help readability.",
    "Do not translate, summarize, polish, explain, or add missing content.",
    "Write [无法辨认] for unreadable parts.",
    "For chat screenshots, keep speaker labels when visible.",
    "For webpage screenshots, ignore navigation, ads, buttons, and unrelated interface text.",
    "If there is no readable text in any language, return an empty response.",
  ].join("\n");
}

function inferImageMimeType(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();

  if (extension === "png") return "image/png";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "webp") return "image/webp";
  return "application/octet-stream";
}
