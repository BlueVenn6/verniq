import {
  buildImageTextExtractionPrompt,
  parseImageDataUrl,
} from "@/src/lib/imageTextExtraction";
import { resolveTaskRuntimeConfig } from "@/src/lib/llm/config";
import { routeLlmChat } from "@/src/lib/llm/router";
import { checkAiSendPolicy, createAiSendPlan } from "@/src/lib/llm/sendPlan";
import type {
  AiModelConfig,
  AiPrivacySettings,
  AiProviderConfig,
  AiTaskRouting,
} from "@/src/lib/types";

export type ExtractImageTextInput = {
  imageDataUrl: string;
  aiProviders: AiProviderConfig[];
  aiModels: AiModelConfig[];
  aiTaskRouting: AiTaskRouting;
  aiPrivacySettings?: AiPrivacySettings;
  signal?: AbortSignal;
};

export type ExtractImageTextResult = {
  text: string;
  providerName: string;
  modelId: string;
};

export async function extractImageTextWithAi({
  imageDataUrl,
  aiProviders,
  aiModels,
  aiTaskRouting,
  aiPrivacySettings,
  signal,
}: ExtractImageTextInput): Promise<ExtractImageTextResult> {
  const parsedImage = parseImageDataUrl(imageDataUrl);
  const runtime = await resolveTaskRuntimeConfig({
    task: "imageTextExtraction",
    capability: "vision",
    aiProviders,
    aiModels,
    aiTaskRouting,
  });

  if (!runtime.ok) {
    throw new Error(runtime.error);
  }

  const plan = createAiSendPlan({
    task: "imageTextExtraction",
    provider: runtime.provider,
    model: runtime.model,
    contentScope: "image_upload",
    contentText: "",
    includesFullMaterial: false,
    includesSensitiveContent: false,
    privacySettings: aiPrivacySettings,
  });
  const policy = checkAiSendPolicy(plan, aiPrivacySettings);
  if (!policy.allowed) throw new Error(policy.reason || "当前 AI 设置阻止了图片文字提取。");

  const result = await routeLlmChat({
    ...runtime.request,
    signal,
    requestType: "image-text-extraction",
    temperature: 0,
    maxTokens: runtime.request.maxTokens ?? 2000,
    messages: [
      {
        role: "user",
        content: buildImageTextExtractionPrompt(),
      },
    ],
    images: [
      {
        mimeType: parsedImage.mimeType,
        data: parsedImage.base64,
      },
    ],
  });
  const text = result.text.trim();

  if (!text) {
    throw new Error("未能识别图片中的文字，可以尝试更清晰的图片，或手动粘贴正文。");
  }

  return {
    text,
    providerName: runtime.provider.name,
    modelId: runtime.model.modelId.trim(),
  };
}
