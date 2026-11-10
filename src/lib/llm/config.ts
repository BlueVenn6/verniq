import {
  aiModelDeclaresImageInput,
  aiModelImageInputVerified,
  aiProviderSupportsImageInput,
  getAiTaskModelLabel,
} from "@/src/lib/aiConfig";
import { readCredentialSecret } from "@/src/lib/secrets/secretStore";
import { validateDesktopNetworkUrl } from "@/src/lib/security/url";
import type {
  AiModelCapability,
  AiModelConfig,
  AiProviderConfig,
  AiTaskRouting,
} from "@/src/lib/types";
import type { LlmProvider, LlmRequest } from "@/src/lib/llm/types";

export type LlmRuntimeConfig =
  | {
      ok: true;
      provider: AiProviderConfig;
      model: AiModelConfig;
      request: LlmRequest;
      modelLabel: string;
    }
  | {
      ok: false;
      error: string;
    };

const TASK_LABELS: Record<keyof AiTaskRouting, string> = {
  analysis: "分析",
  languageAnalysis: "语言分析",
  phraseAnalysis: "短语分析",
  sentenceGrammarAnalysis: "句子语法分析",
  segmentAnalysis: "段落分析",
  feynmanFeedback: "费曼反馈",
  outputDraft: "写作草稿",
  contentAnalysis: "内容分析",
  rewrite: "改写",
  publishPackage: "发布包",
  videoScript: "视频脚本",
  imageTextExtraction: "图片文字提取",
  imageGeneration: "图片生成",
  imageEditing: "图片编辑",
};

const TASK_FALLBACKS: Partial<Record<keyof AiTaskRouting, keyof AiTaskRouting>> = {
  languageAnalysis: "analysis",
  phraseAnalysis: "languageAnalysis",
  sentenceGrammarAnalysis: "languageAnalysis",
  segmentAnalysis: "analysis",
  feynmanFeedback: "analysis",
  contentAnalysis: "analysis",
  outputDraft: "rewrite",
};

export async function resolveTaskRuntimeConfig({
  task,
  capability,
  aiProviders,
  aiModels,
  aiTaskRouting,
}: {
  task: keyof AiTaskRouting;
  capability: AiModelCapability;
  aiProviders: AiProviderConfig[];
  aiModels: AiModelConfig[];
  aiTaskRouting: AiTaskRouting;
}): Promise<LlmRuntimeConfig> {
  const route =
    task === "imageTextExtraction"
      ? aiTaskRouting.imageTextExtraction
      : resolveTaskRoute(task, aiTaskRouting);
  const taskLabel = TASK_LABELS[task];

  if (!route?.providerId || !route.modelId) {
    return {
      ok: false,
      error:
        task === "imageTextExtraction"
          ? "尚未配置图片文字提取模型。请先在设置中添加图片 AI 服务、验证图片能力，并选择该模型。"
          : `${taskLabel}任务尚未选择模型，请在设置中配置。`,
    };
  }

  const provider = aiProviders.find((item) => item.id === route.providerId);

  if (!provider) {
    return {
      ok: false,
      error: `${taskLabel}任务尚未绑定 AI 服务，请先在设置中完成任务路由。`,
    };
  }

  if (!provider.enabled) {
    return {
      ok: false,
      error: `“${provider.name}”尚未启用，请先在设置中打开。`,
    };
  }

  const model = aiModels.find((item) => item.id === route.modelId);

  if (!model) {
    return {
      ok: false,
      error: `${taskLabel}任务尚未选择模型，请先在设置中补上。`,
    };
  }

  if (!model.enabled) {
    return {
      ok: false,
      error: `“${model.displayName}”当前未启用，请先在设置中打开这个模型。`,
    };
  }

  if (model.providerId !== provider.id) {
    return {
      ok: false,
      error: `${taskLabel}任务的模型和 AI 服务不一致，请在设置中重新选择。`,
    };
  }

  if (!model.capabilities.includes(capability)) {
    if (!modelSupportsCapability(model, capability)) {
      return {
        ok: false,
        error: `“${model.displayName}”没有${taskLabel}能力，不能用于当前任务。`,
      };
    }
  }

  if (task === "imageTextExtraction" || capability === "vision") {
    if (!aiProviderSupportsImageInput(provider)) {
      return {
        ok: false,
        error: "当前 AI 服务协议未接入图片输入，请选择支持图片的服务和模型。",
      };
    }

    if (!aiModelDeclaresImageInput(model)) {
      return {
        ok: false,
        error: "尚未配置支持图片的模型。请先在设置中选择并验证视觉模型。",
      };
    }
  }

  if (task === "imageTextExtraction" && !aiModelImageInputVerified(model)) {
    return {
      ok: false,
      error: "尚未配置支持图片的模型。请先在设置中选择并验证视觉模型。",
    };
  }

  const baseRequest = await buildProviderRequest(provider, model);

  if (!baseRequest.ok) {
    return baseRequest;
  }

  const request =
    task === "imageTextExtraction" && baseRequest.request.provider === "openai-compatible"
      ? {
          ...baseRequest.request,
          customEndpointPath: imageInputEndpointPath(baseRequest.request.customEndpointPath),
        }
      : baseRequest.request;

  return {
    ok: true,
    provider,
    model,
    modelLabel: getAiTaskModelLabel(task, aiProviders, aiModels, aiTaskRouting),
    request: {
      ...request,
      temperature: route.temperatureOverride ?? request.temperature,
      maxTokens: route.maxTokensOverride ?? request.maxTokens,
      configSource: "saved-config",
      configName: provider.displayName ?? provider.name,
      requestType: "chat",
      messages: [],
    },
  };
}

export async function buildProviderTestRequest(
  provider: AiProviderConfig,
  aiModels: AiModelConfig[],
  modelId?: string,
  capability: "text" | "image" = "text",
): Promise<LlmRuntimeConfig> {
  const model = modelId
    ? aiModels.find((item) => item.id === modelId && item.providerId === provider.id)
    : aiModels.find((item) => item.providerId === provider.id && item.enabled);

  if (!model) {
    return {
      ok: false,
      error: modelId ? "这个模型不属于当前 AI 服务。" : "当前 AI 服务暂无可用模型。",
    };
  }

  if (!model.enabled) {
    return {
      ok: false,
      error: "这个模型尚未启用。",
    };
  }

  if (capability === "image") {
    if (!aiProviderSupportsImageInput(provider)) {
      return {
        ok: false,
        error: "当前协议未接入图片输入。",
      };
    }

    // A probe establishes capability; a manual checkbox must not be required
    // before the user can test an existing text/multimodal model.
  }

  const baseRequest = await buildProviderRequest(provider, model);

  if (!baseRequest.ok) {
    return baseRequest;
  }

  const request =
    capability === "image" && baseRequest.request.provider === "openai-compatible"
      ? {
          ...baseRequest.request,
          customEndpointPath: imageInputEndpointPath(baseRequest.request.customEndpointPath),
        }
      : baseRequest.request;

  return {
    ok: true,
    provider,
    model,
    modelLabel: `${provider.name} · ${model.displayName}`,
    request: {
      ...request,
      configSource: "current-form",
      configName: provider.name,
      requestType: capability === "image" ? "image-test" : "test",
      messages: [],
    },
  };
}

function imageInputEndpointPath(path?: string) {
  // Preserve custom chat gateways while migrating old drawing-only endpoints.
  return path && /\/(?:images(?:\/|$)|image-generation(?:\/|$))/i.test(path)
    ? undefined
    : path;
}

export function mapProviderToLlmProvider(provider: AiProviderConfig): LlmProvider | null {
  if (provider.adapterProtocol === "openai_images") {
    return null;
  }

  if (isOpenAiOfficialProvider(provider)) {
    return "openai";
  }

  if (provider.providerType === "local" || provider.isLocal) {
    return "local";
  }

  if (provider.adapterProtocol === "openai_chat_completions") {
    return "openai-compatible";
  }

  if (provider.adapterProtocol === "gemini_native") {
    return "gemini";
  }

  if (provider.adapterProtocol === "anthropic_messages") {
    return "claude";
  }

  if (provider.providerFamily === "openai") {
    return provider.connectionMode === "official" ? "openai" : "openai-compatible";
  }

  if (provider.providerFamily === "gemini") {
    return provider.connectionMode === "official" ? "gemini" : "openai-compatible";
  }

  if (provider.providerFamily === "anthropic" || provider.providerFamily === "claude") {
    return provider.connectionMode === "official" ? "claude" : "openai-compatible";
  }

  if (
    ["qwen", "deepseek", "glm", "moonshot", "kimi", "minimax"].includes(
      provider.providerFamily,
    )
  ) {
    return "openai-compatible";
  }

  if (provider.providerFamily === "local") {
    return "local";
  }

  if (provider.providerFamily === "custom") {
    return provider.providerType === "openai_compatible" ? "openai-compatible" : null;
  }

  return null;
}

async function buildProviderRequest(
  provider: AiProviderConfig,
  model: AiModelConfig,
): Promise<
  | {
      ok: true;
      request: LlmRequest;
    }
  | {
      ok: false;
      error: string;
    }
> {
  const credentialResult = await resolveProviderCredential(provider);
  const requestModelId = model.modelId.trim();

  if (!requestModelId) {
    return {
      ok: false,
      error: `“${model.displayName || model.id}”尚未填写模型 ID。`,
    };
  }

  const requiresApiKey =
    provider.apiKeyRequired ?? (provider.providerType !== "local" && provider.authMode !== "none");

  if (requiresApiKey && provider.authMode !== "none" && !credentialResult.key) {
    return {
      ok: false,
      error:
        credentialResult.error ??
        `“${provider.name}”尚未填写 API 密钥，请先填写并保存。`,
    };
  }

  if (
    provider.connectionMode !== "official" &&
    provider.providerType !== "local" &&
    !provider.baseUrl.trim()
  ) {
    return {
      ok: false,
      error: `“${provider.name}”尚未填写服务地址，请先填写 Base URL。`,
    };
  }

  const baseUrl = getEffectiveProviderBaseUrl(provider);

  if (baseUrl) {
    const urlValidation = validateDesktopNetworkUrl(baseUrl, "AI 接口地址");

    if (!urlValidation.ok) {
      return {
        ok: false,
        error: urlValidation.message,
      };
    }
  }

  if (provider.authMode === "header" && !provider.authHeaderName?.trim()) {
    return {
      ok: false,
      error: `“${provider.name}”使用自定义请求头认证，但 Header 名称尚未填写。`,
    };
  }

  const mappedProvider = mapProviderToLlmProvider(provider);

  if (!mappedProvider) {
    return {
      ok: false,
      error: `“${provider.name}”当前接入方式不可用，请改成官方接口或兼容接口。`,
    };
  }

  return {
    ok: true,
    request: {
      provider: mappedProvider,
      model: requestModelId,
      apiKey: credentialResult.key,
      baseUrl: baseUrl || undefined,
      customEndpointPath: provider.customEndpointPath?.trim() || undefined,
      authMode: provider.authMode,
      authHeaderName: provider.authHeaderName?.trim() || undefined,
      extraHeaders: normalizeRequestExtraHeaders(provider.extraHeaders),
      timeoutMs: provider.timeoutMs,
      temperature: model.defaultTemperature,
      maxTokens: model.defaultMaxTokens,
      messages: [],
      credentialWarning: credentialResult.warning,
    },
  };
}

function normalizeRequestExtraHeaders(value: AiProviderConfig["extraHeaders"]) {
  return (value ?? [])
    .filter((header) => header.enabled ?? true)
    .map((header) => ({
      name: header.name.trim(),
      value: header.value,
    }))
    .filter((header) => header.name && header.value);
}

export function getEffectiveProviderBaseUrl(provider: AiProviderConfig) {
  if (isOpenAiOfficialProvider(provider)) {
    return "https://api.openai.com/v1";
  }

  return provider.baseUrl.trim();
}

export function modelSupportsCapability(model: AiModelConfig, capability: AiModelCapability) {
  if (capability === "text") return model.supportsText ?? true;
  if (capability === "vision") {
    return aiModelDeclaresImageInput(model);
  }
  if (capability === "structured_output") {
    return Boolean(model.supportsStructuredOutput || model.supportsJsonMode);
  }
  if (capability === "reasoning") return Boolean(model.supportsReasoning);
  if (capability === "streaming") return Boolean(model.supportsStreaming);
  return model.capabilities.includes(capability);
}

function isOpenAiOfficialProvider(provider: AiProviderConfig) {
  return (
    provider.id === "provider-openai" ||
    (provider.providerFamily === "openai" &&
      provider.providerType === "openai_official" &&
      provider.connectionMode === "official")
  );
}

function resolveTaskRoute(task: keyof AiTaskRouting, routing: AiTaskRouting) {
  return routing[task] ?? routing[TASK_FALLBACKS[task] ?? "analysis"] ?? routing.analysis;
}

export async function resolveProviderCredential(provider: AiProviderConfig): Promise<{
  key?: string;
  warning?: string;
  error?: string;
}> {
  if (provider.authMode === "none" || provider.providerType === "local") {
    return {};
  }

  const credentialRef = provider.credentialRef?.trim();

  if (credentialRef) {
    const secret = await readCredentialSecret(credentialRef);

    if (!secret) {
      return {
        error: "未找到已保存的 API 密钥，请重新填写后再试。",
      };
    }

    return { key: secret };
  }

  const legacyKey = provider.apiKeyRef?.trim();

  if (legacyKey) {
    return {
      key: legacyKey,
      warning:
        "当前 AI 服务仍在使用旧的明文 API 密钥，建议迁移到安全存储。",
    };
  }

  return {};
}
