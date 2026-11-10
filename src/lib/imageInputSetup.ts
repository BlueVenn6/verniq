import { aiProviderSupportsImageInput } from "@/src/lib/aiConfig";
import type { AiConnectionTestResult, AiModelConfig, AiProviderConfig, AiTaskRouting } from "@/src/lib/types";

type ImageInputConfiguration = {
  aiProviders: AiProviderConfig[];
  aiModels: AiModelConfig[];
  aiTaskRouting: AiTaskRouting;
};

export function getImageInputCandidates(config: Pick<ImageInputConfiguration, "aiProviders" | "aiModels">) {
  return config.aiModels.flatMap((model) => {
    const provider = config.aiProviders.find((item) => item.id === model.providerId);
    return provider?.enabled && model.enabled && model.modelId.trim() && aiProviderSupportsImageInput(provider)
      ? [{ provider, model }]
      : [];
  });
}

// A real image probe, not the model name or a text connection test, enables OCR.
export function applyImageInputVerification(config: ImageInputConfiguration, result: AiConnectionTestResult): ImageInputConfiguration {
  const candidate = getImageInputCandidates(config).find(({ provider, model }) => provider.id === result.providerId && model.id === result.modelId);
  if (!candidate || result.capability !== "image" || !result.checkedAt) {
    throw new Error("识图配置已变更，请重新验证当前模型。");
  }
  const record = { status: result.success ? "verified" as const : "failed" as const, checkedAt: result.checkedAt, requestUrl: result.requestUrl, message: result.message };
  return {
    aiProviders: result.success ? config.aiProviders.map((provider) => provider.id === result.providerId ? { ...provider, connectionVerification: record } : provider) : config.aiProviders,
    aiModels: config.aiModels.map((model) => model.id === result.modelId ? {
      ...model,
      supportsVision: result.success || model.supportsVision,
      capabilities: result.success ? [...new Set([...model.capabilities, "vision" as const])] : model.capabilities,
      capabilityVerification: { ...model.capabilityVerification, image: record.status },
      capabilityVerificationDetails: { ...model.capabilityVerificationDetails, image: record },
    } : model),
    aiTaskRouting: result.success ? { ...config.aiTaskRouting, imageTextExtraction: { ...config.aiTaskRouting.imageTextExtraction, providerId: result.providerId, modelId: candidate.model.id, enabled: true, contentPolicy: "default" } } : config.aiTaskRouting,
  };
}
