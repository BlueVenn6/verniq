import type {
  AiContentPreferences,
  AiConnectionTestResult,
  AiPrivacySettings,
  AiAdapterProtocol,
  AiModelCapability,
  AiModelConfig,
  AiProviderConfig,
  AiProviderConnectionMode,
  AiProviderFamily,
  AiProviderKind,
  AiTaskRouting,
  LegacyAiSettings,
} from "@/src/lib/types";

export const DEFAULT_AI_PROVIDER_ID = "provider-openai";
export const DEFAULT_AI_ANALYSIS_MODEL_ID = "model-openai-gpt-5-6-terra";
export const DEFAULT_AI_REWRITE_MODEL_ID = "model-openai-gpt-5-6-sol";
export const DEFAULT_AI_CUSTOM_PROVIDER_ID = "provider-custom";
export const DEFAULT_AI_LOCAL_PROVIDER_ID = "provider-lm-studio";
export const DEFAULT_AI_GEMINI_PROVIDER_ID = "provider-gemini";
export const DEFAULT_AI_ANTHROPIC_PROVIDER_ID = "provider-anthropic";
export const SUPPORTED_AI_PROVIDER_IDS = [
  DEFAULT_AI_PROVIDER_ID,
  DEFAULT_AI_CUSTOM_PROVIDER_ID,
  DEFAULT_AI_LOCAL_PROVIDER_ID,
  DEFAULT_AI_GEMINI_PROVIDER_ID,
  DEFAULT_AI_ANTHROPIC_PROVIDER_ID,
] as const;

export const AI_PROVIDER_FAMILY_LABELS: Record<AiProviderFamily, string> = {
  openai: "OpenAI",
  gemini: "Gemini",
  anthropic: "Anthropic",
  claude: "Claude",
  qwen: "Qwen",
  deepseek: "DeepSeek",
  glm: "GLM",
  moonshot: "Moonshot",
  kimi: "Kimi",
  minimax: "MiniMax",
  local: "本地",
  custom: "自定义接入",
};

export const AI_CONNECTION_MODE_LABELS: Record<AiProviderConnectionMode, string> = {
  official: "官方接口",
  compatible: "兼容接口",
  custom_base_url: "自定义服务地址",
};

export const DEFAULT_AI_PROVIDERS: AiProviderConfig[] = [
  createProviderPreset("openai", {
    id: DEFAULT_AI_PROVIDER_ID,
    name: "OpenAI 原生",
    providerType: "openai_official",
    connectionMode: "official",
    enabled: false,
    baseUrl: "https://api.openai.com/v1",
    notes: "OpenAI 官方 API。填入 OpenAI API 密钥后，可以自行编辑模型 ID。",
  }),
  createProviderPreset("custom", {
    id: DEFAULT_AI_CUSTOM_PROVIDER_ID,
    name: "OpenAI-compatible 中转",
    providerType: "openai_compatible",
    connectionMode: "custom_base_url",
    enabled: false,
    notes: "用于中转或任何兼容 /v1/chat/completions 的服务。填写服务地址、API 密钥和模型 ID。",
  }),
  createProviderPreset("local", {
    id: DEFAULT_AI_LOCAL_PROVIDER_ID,
    name: "LM Studio",
    providerType: "local",
    connectionMode: "compatible",
    baseUrl: "http://localhost:1234/v1",
    enabled: false,
    authMode: "none",
    notes: "本机 LM Studio 服务。通常不需要 API 密钥。",
  }),
];

export const CUSTOM_AI_SERVICE_PRESETS = [
  {
    id: "openai-native",
    label: "OpenAI 原生",
    providerFamily: "openai" as const,
    providerType: "openai_official" as const,
    connectionMode: "official" as const,
    adapterProtocol: "openai_chat_completions" as const,
    endpointMode: "chat_completions" as const,
    baseUrl: "https://api.openai.com/v1",
    authMode: "bearer" as const,
    apiKeyRequired: true,
  },
  {
    id: "openai-compatible",
    label: "OpenAI-compatible",
    providerFamily: "custom" as const,
    providerType: "openai_compatible" as const,
    connectionMode: "custom_base_url" as const,
    adapterProtocol: "openai_chat_completions" as const,
    endpointMode: "chat_completions" as const,
    baseUrl: "https://api.example.com/v1",
    authMode: "bearer" as const,
    apiKeyRequired: true,
  },
  {
    id: "openai-images-native",
    label: "OpenAI 原生图片 API",
    providerFamily: "openai" as const,
    providerType: "openai_official" as const,
    connectionMode: "official" as const,
    adapterProtocol: "openai_images" as const,
    endpointMode: "image_generations" as const,
    baseUrl: "https://api.openai.com/v1",
    authMode: "bearer" as const,
    apiKeyRequired: true,
  },
  {
    id: "dragtoken-images",
    label: "DragToken 图片中转",
    providerFamily: "custom" as const,
    providerType: "openai_compatible" as const,
    connectionMode: "custom_base_url" as const,
    adapterProtocol: "openai_images" as const,
    endpointMode: "image_generations" as const,
    baseUrl: "https://draw.dragtokens.com/v1",
    authMode: "bearer" as const,
    apiKeyRequired: true,
  },
  {
    id: "kimi",
    label: "Kimi",
    providerFamily: "kimi" as const,
    providerType: "openai_compatible" as const,
    connectionMode: "custom_base_url" as const,
    adapterProtocol: "openai_chat_completions" as const,
    endpointMode: "chat_completions" as const,
    baseUrl: "https://api.moonshot.cn/v1",
    authMode: "bearer" as const,
    apiKeyRequired: true,
  },
  {
    id: "minimax",
    label: "MiniMax",
    providerFamily: "minimax" as const,
    providerType: "openai_compatible" as const,
    connectionMode: "custom_base_url" as const,
    adapterProtocol: "openai_chat_completions" as const,
    endpointMode: "chat_completions" as const,
    baseUrl: "https://api.minimax.chat/v1",
    authMode: "bearer" as const,
    apiKeyRequired: true,
  },
  {
    id: "lm-studio-local",
    label: "LM Studio / 本机兼容接口",
    providerFamily: "local" as const,
    providerType: "local" as const,
    connectionMode: "compatible" as const,
    adapterProtocol: "openai_chat_completions" as const,
    endpointMode: "chat_completions" as const,
    baseUrl: "http://localhost:1234/v1",
    authMode: "none" as const,
    apiKeyRequired: false,
  },
  {
    id: "gemini-native",
    label: "Gemini native",
    providerFamily: "gemini" as const,
    providerType: "openai_official" as const,
    connectionMode: "official" as const,
    adapterProtocol: "gemini_native" as const,
    endpointMode: "gemini_generate_content" as const,
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    authMode: "google_api_key" as const,
    apiKeyRequired: true,
  },
  {
    id: "gemini-compatible",
    label: "Gemini OpenAI-compatible",
    providerFamily: "gemini" as const,
    providerType: "openai_compatible" as const,
    connectionMode: "custom_base_url" as const,
    adapterProtocol: "openai_chat_completions" as const,
    endpointMode: "chat_completions" as const,
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    authMode: "bearer" as const,
    apiKeyRequired: true,
  },
  {
    id: "anthropic-messages",
    label: "Anthropic Messages",
    providerFamily: "anthropic" as const,
    providerType: "openai_official" as const,
    connectionMode: "official" as const,
    adapterProtocol: "anthropic_messages" as const,
    endpointMode: "anthropic_messages" as const,
    baseUrl: "https://api.anthropic.com/v1",
    authMode: "anthropic_api_key" as const,
    apiKeyRequired: true,
  },
  {
    id: "anthropic-relay",
    label: "Claude 原生协议中转",
    providerFamily: "anthropic" as const,
    providerType: "openai_compatible" as const,
    connectionMode: "custom_base_url" as const,
    adapterProtocol: "anthropic_messages" as const,
    endpointMode: "anthropic_messages" as const,
    baseUrl: "https://api.example.com/v1",
    authMode: "anthropic_api_key" as const,
    apiKeyRequired: true,
  },
] as const;

export const DEFAULT_AI_MODELS: AiModelConfig[] = [
  {
    id: DEFAULT_AI_ANALYSIS_MODEL_ID,
    providerId: DEFAULT_AI_PROVIDER_ID,
    modelId: "gpt-5.6-terra",
    modelName: "gpt-5.6-terra",
    displayName: "OpenAI · GPT-5.6 Terra",
    capabilities: ["analysis", "rewrite", "publish_package", "video_script"],
    contextWindowTokens: 256000,
    defaultTemperature: 0.3,
    defaultMaxTokens: 2400,
    timeoutMs: 90000,
    supportsText: true,
    supportsJsonMode: true,
    supportsVision: false,
    supportsStructuredOutput: true,
    supportsReasoning: false,
    supportsStreaming: false,
    reasoningEffort: "provider_default",
    capabilityVerification: {
      text: "unverified",
      image: "unverified",
      structuredOutput: "unverified",
      reasoning: "unverified",
      streaming: "unverified",
    },
    isLocal: false,
    allowFullMaterial: false,
    allowSensitiveContent: false,
    enabled: true,
  },
  {
    id: DEFAULT_AI_REWRITE_MODEL_ID,
    providerId: DEFAULT_AI_PROVIDER_ID,
    modelId: "gpt-5.6-sol",
    modelName: "gpt-5.6-sol",
    displayName: "OpenAI · GPT-5.6 Sol",
    capabilities: ["analysis", "rewrite", "publish_package", "video_script"],
    contextWindowTokens: 512000,
    defaultTemperature: 0.4,
    defaultMaxTokens: 3200,
    timeoutMs: 120000,
    supportsText: true,
    supportsJsonMode: true,
    supportsVision: false,
    supportsStructuredOutput: true,
    supportsReasoning: false,
    supportsStreaming: false,
    reasoningEffort: "provider_default",
    capabilityVerification: {
      text: "unverified",
      image: "unverified",
      structuredOutput: "unverified",
      reasoning: "unverified",
      streaming: "unverified",
    },
    isLocal: false,
    allowFullMaterial: false,
    allowSensitiveContent: false,
    enabled: true,
  },
  {
    id: "model-lm-studio-default",
    providerId: DEFAULT_AI_LOCAL_PROVIDER_ID,
    modelId: "local-model",
    modelName: "local-model",
    displayName: "LM Studio · 自定义本地模型",
    capabilities: ["analysis", "rewrite", "video_script"],
    contextWindowTokens: 64000,
    defaultTemperature: 0.4,
    defaultMaxTokens: 1800,
    timeoutMs: 120000,
    supportsText: true,
    supportsJsonMode: false,
    supportsVision: false,
    supportsStructuredOutput: false,
    supportsReasoning: false,
    supportsStreaming: false,
    reasoningEffort: "provider_default",
    capabilityVerification: {
      text: "unverified",
      image: "unverified",
      structuredOutput: "unverified",
      reasoning: "unverified",
      streaming: "unverified",
    },
    isLocal: true,
    allowFullMaterial: true,
    allowSensitiveContent: true,
    enabled: true,
  },
  {
    id: "model-custom-default",
    providerId: DEFAULT_AI_CUSTOM_PROVIDER_ID,
    modelId: "",
    modelName: "",
    displayName: "中转/兼容 · 自定义模型",
    capabilities: ["analysis", "rewrite", "publish_package", "video_script"],
    contextWindowTokens: 128000,
    defaultTemperature: 0.4,
    defaultMaxTokens: 2400,
    timeoutMs: 90000,
    supportsText: true,
    supportsJsonMode: false,
    supportsVision: false,
    supportsStructuredOutput: false,
    supportsReasoning: false,
    supportsStreaming: false,
    reasoningEffort: "provider_default",
    capabilityVerification: {
      text: "unverified",
      image: "unverified",
      structuredOutput: "unverified",
      reasoning: "unverified",
      streaming: "unverified",
    },
    isLocal: false,
    allowFullMaterial: false,
    allowSensitiveContent: false,
    enabled: false,
  },
];

export const DEFAULT_AI_TASK_ROUTING: AiTaskRouting = {
  analysis: {
    providerId: DEFAULT_AI_PROVIDER_ID,
    modelId: DEFAULT_AI_ANALYSIS_MODEL_ID,
    enabled: false,
    requireUserConfirmForRemote: true,
    contentPolicy: "default",
  },
  languageAnalysis: {
    providerId: DEFAULT_AI_PROVIDER_ID,
    modelId: DEFAULT_AI_ANALYSIS_MODEL_ID,
    enabled: false,
    requireUserConfirmForRemote: true,
    contentPolicy: "source_material",
  },
  segmentAnalysis: {
    providerId: DEFAULT_AI_PROVIDER_ID,
    modelId: DEFAULT_AI_ANALYSIS_MODEL_ID,
    enabled: false,
    requireUserConfirmForRemote: true,
    contentPolicy: "current_segment_only",
  },
  feynmanFeedback: {
    providerId: DEFAULT_AI_PROVIDER_ID,
    modelId: DEFAULT_AI_ANALYSIS_MODEL_ID,
    enabled: false,
    requireUserConfirmForRemote: true,
    contentPolicy: "feynman_note_only",
  },
  contentAnalysis: {
    providerId: DEFAULT_AI_PROVIDER_ID,
    modelId: DEFAULT_AI_ANALYSIS_MODEL_ID,
    enabled: false,
    requireUserConfirmForRemote: true,
    contentPolicy: "content_item",
  },
  rewrite: {
    providerId: DEFAULT_AI_PROVIDER_ID,
    modelId: DEFAULT_AI_REWRITE_MODEL_ID,
    enabled: false,
    requireUserConfirmForRemote: true,
    contentPolicy: "content_item",
  },
  outputDraft: {
    providerId: DEFAULT_AI_PROVIDER_ID,
    modelId: DEFAULT_AI_REWRITE_MODEL_ID,
    enabled: false,
    requireUserConfirmForRemote: true,
    contentPolicy: "output_draft_context_only",
  },
  publishPackage: {
    providerId: DEFAULT_AI_PROVIDER_ID,
    modelId: DEFAULT_AI_REWRITE_MODEL_ID,
    enabled: false,
    requireUserConfirmForRemote: true,
    contentPolicy: "content_item",
  },
  videoScript: {
    providerId: DEFAULT_AI_PROVIDER_ID,
    modelId: DEFAULT_AI_REWRITE_MODEL_ID,
    enabled: false,
    requireUserConfirmForRemote: true,
    contentPolicy: "content_item",
  },
  imageTextExtraction: {
    providerId: "",
    modelId: "",
    enabled: false,
    requireUserConfirmForRemote: true,
    contentPolicy: "selected_text_only",
    temperatureOverride: 0,
    maxTokensOverride: 2000,
  },
  imageGeneration: {
    providerId: "",
    modelId: "",
    enabled: false,
    requireUserConfirmForRemote: true,
    contentPolicy: "default",
  },
  imageEditing: {
    providerId: "",
    modelId: "",
    enabled: false,
    requireUserConfirmForRemote: true,
    contentPolicy: "default",
  },
};

export const DEFAULT_AI_CONTENT_PREFERENCES: AiContentPreferences = {
  defaultOutputLanguage: "en",
  rewriteTone: "natural",
  rewriteStrategy: "localized",
  autoGenerateMultiPlatformVersions: true,
};

export const DEFAULT_AI_PRIVACY_SETTINGS: AiPrivacySettings = {
  allowRemoteAi: true,
  onlyUseLocalModels: false,
  requireConfirmationBeforeRemoteSend: true,
  allowFullMaterialToRemote: false,
  allowSensitiveContentToRemote: false,
};

export function getAiTaskModelLabel(
  task: keyof AiTaskRouting,
  providers: AiProviderConfig[],
  models: AiModelConfig[],
  routing: AiTaskRouting,
) {
  const route =
    routing[task] ?? (task === "imageTextExtraction" ? undefined : routing.analysis);

  if (!route?.providerId || !route.modelId) {
    return "尚未选择模型";
  }
  const provider = providers.find((item) => item.id === route.providerId);
  const model = models.find((item) => item.id === route.modelId);

  if (!provider || !model) {
    return "尚未选择模型";
  }

  return `${provider.name} · ${model.displayName}`;
}

export function getProviderModeDescription(provider: AiProviderConfig) {
  const familyLabel = AI_PROVIDER_FAMILY_LABELS[provider.providerFamily];
  const modeLabel = AI_CONNECTION_MODE_LABELS[provider.connectionMode];

  if (provider.providerType === "local") {
    return `${familyLabel} · 本地运行`;
  }

  return `${familyLabel} · ${modeLabel}`;
}

export function maskApiKey(value: string | undefined) {
  if (!value?.trim()) {
    return "尚未填写";
  }

  const trimmed = value.trim();
  if (trimmed.length <= 6) {
    return `${trimmed.slice(0, 2)}***`;
  }

  return `${trimmed.slice(0, 3)}***${trimmed.slice(-2)}`;
}

export function normalizeAiConfiguration({
  aiProviders,
  aiModels,
  aiTaskRouting,
  resetLegacyDefaults = false,
}: {
  aiProviders?: AiProviderConfig[];
  aiModels?: AiModelConfig[];
  aiTaskRouting?: AiTaskRouting;
  resetLegacyDefaults?: boolean;
}) {
  const normalizedProviders = normalizeAiProviders(aiProviders ?? []);
  const normalizedModels = normalizeAiModels(
    aiModels ?? [],
    normalizedProviders,
    resetLegacyDefaults,
  );
  const normalizedRouting = normalizeAiTaskRouting(
    aiTaskRouting,
    normalizedModels,
    normalizedProviders,
    resetLegacyDefaults,
  );

  return {
    aiProviders: normalizedProviders,
    aiModels: normalizedModels,
    aiTaskRouting: normalizedRouting,
  };
}

export function createCustomAiProviderConfig({
  presetId = "openai-compatible",
  id,
  name,
  baseUrl,
  apiKeyRequired,
}: {
  presetId?: (typeof CUSTOM_AI_SERVICE_PRESETS)[number]["id"];
  id?: string;
  name?: string;
  baseUrl?: string;
  apiKeyRequired?: boolean;
} = {}): AiProviderConfig {
  const preset =
    CUSTOM_AI_SERVICE_PRESETS.find((item) => item.id === presetId) ??
    CUSTOM_AI_SERVICE_PRESETS[0];
  const isLocalProvider = preset.providerType === "local";

  return {
    id: id ?? createConfigId("provider"),
    name: name?.trim() || preset.label,
    displayName: name?.trim() || preset.label,
    providerKind: inferProviderKind(preset.providerType),
    providerFamily: preset.providerFamily,
    providerType: preset.providerType,
    connectionMode: preset.connectionMode,
    adapterProtocol: preset.adapterProtocol,
    baseUrl: baseUrl?.trim() ?? preset.baseUrl,
    endpointMode: preset.endpointMode,
    customEndpointPath: "",
    sourcePresetId: preset.id,
    credentialRef: "",
    apiKeyRef: "",
    apiKeyRequired: apiKeyRequired ?? preset.apiKeyRequired,
    authMode: preset.authMode,
    authHeaderName: "",
    extraHeaders: [],
    isLocal: isLocalProvider,
    isRemote: !isLocalProvider,
    allowSensitiveContent: isLocalProvider,
    allowFullMaterial: isLocalProvider,
    timeoutMs: isLocalProvider ? 120000 : 180000,
    enabled: false,
    connectionVerification: { status: "unverified" },
    notes: "接口地址和模型 ID 可能随服务商更新，请以服务商当前文档为准。",
  };
}

export function createCustomAiModelConfig(
  provider: AiProviderConfig,
  overrides: Partial<AiModelConfig> = {},
): AiModelConfig {
  const isLocal = provider.providerType === "local" || Boolean(provider.isLocal);
  const supportsVision = Boolean(overrides.supportsVision);
  const capabilities = normalizeModelCapabilities(
    overrides.capabilities ?? ["analysis", "rewrite"],
    supportsVision,
    overrides.supportsText ?? true,
  );

  return {
    id: overrides.id ?? createConfigId("model"),
    providerId: provider.id,
    modelId: overrides.modelId ?? "",
    modelName: overrides.modelName ?? overrides.modelId ?? "",
    displayName: overrides.displayName ?? "",
    capabilities,
    contextWindowTokens: overrides.contextWindowTokens ?? (isLocal ? 64000 : 128000),
    defaultTemperature: overrides.defaultTemperature ?? 0.35,
    defaultMaxTokens: overrides.defaultMaxTokens ?? (isLocal ? 1800 : 2400),
    timeoutMs: overrides.timeoutMs ?? (isLocal ? 120000 : 90000),
    supportsText: overrides.supportsText ?? true,
    supportsJsonMode: overrides.supportsJsonMode ?? false,
    supportsVision,
    supportsStructuredOutput: overrides.supportsStructuredOutput ?? false,
    supportsReasoning: overrides.supportsReasoning ?? false,
    supportsStreaming: overrides.supportsStreaming ?? false,
    reasoningEffort: overrides.reasoningEffort ?? "provider_default",
    capabilityVerification: normalizeCapabilityVerification(overrides.capabilityVerification),
    capabilityVerificationDetails: normalizeCapabilityVerificationDetails(
      overrides.capabilityVerificationDetails,
    ),
    isLocal,
    allowFullMaterial: overrides.allowFullMaterial ?? isLocal,
    allowSensitiveContent: overrides.allowSensitiveContent ?? isLocal,
    enabled: overrides.enabled ?? true,
  };
}

export type AiProviderSetupStatus =
  | "not_configured"
  | "configured"
  | "verified"
  | "failed"
  | "disabled";

export function isAiServiceInstance(
  provider: AiProviderConfig,
  models: AiModelConfig[] = [],
) {
  if (!(SUPPORTED_AI_PROVIDER_IDS as readonly string[]).includes(provider.id)) {
    return true;
  }

  return provider.enabled || hasProviderCredential(provider) || hasUserEditedProvider(provider) || hasUserModel(provider, models);
}

export function isAiProviderConfigured(
  provider: AiProviderConfig,
  models: AiModelConfig[] = [],
) {
  const hasBaseUrl =
    isOpenAiOfficialProviderConfig(provider) ||
    Boolean(provider.baseUrl?.trim()) ||
    provider.providerType === "local";
  const hasCredential =
    !aiProviderRequiresApiKey(provider) || hasProviderCredential(provider);
  const hasModel = models.some(
    (model) => model.providerId === provider.id && model.enabled && model.modelId.trim(),
  );

  return hasBaseUrl && hasCredential && hasModel;
}

export function getAiProviderSetupStatus(
  provider: AiProviderConfig,
  models: AiModelConfig[] = [],
  connectionTest?: AiConnectionTestResult,
): AiProviderSetupStatus {
  if (!isAiProviderConfigured(provider, models)) return "not_configured";

  if (!provider.enabled) return "disabled";

  if (connectionTest) return connectionTest.success ? "verified" : "failed";
  if (provider.connectionVerification?.status === "verified") return "verified";
  if (provider.connectionVerification?.status === "failed") return "failed";

  return "configured";
}

export function getAiProviderSetupStatusLabel(status: AiProviderSetupStatus) {
  if (status === "not_configured") return "未配置";
  if (status === "configured") return "待验证";
  if (status === "verified") return "可用";
  if (status === "failed") return "验证失败";
  return "已停用";
}

export function getAiProviderConfigurationHint(
  provider: AiProviderConfig,
  models: AiModelConfig[] = [],
) {
  if (aiProviderRequiresApiKey(provider) && !hasProviderCredential(provider)) {
    return "待填写密钥";
  }

  if (!isOpenAiOfficialProviderConfig(provider) && !provider.baseUrl?.trim()) {
    return "待填写服务地址";
  }

  if (!models.some((model) => model.providerId === provider.id && model.modelId.trim())) {
    return "待添加模型";
  }

  if (!provider.enabled) {
    return "已停用";
  }

  return "待验证";
}

export function getAiProviderProtocolLabel(provider: AiProviderConfig) {
  if (provider.adapterProtocol === "openai_images") {
    return "OpenAI Images API";
  }

  if (provider.adapterProtocol === "gemini_native") {
    return "Gemini native · generateContent";
  }

  if (provider.adapterProtocol === "anthropic_messages") {
    return "Anthropic Messages";
  }

  if (provider.providerType === "local" || provider.providerFamily === "local") {
    return "OpenAI-compatible local";
  }

  return "OpenAI Chat Completions";
}

export function getAiProviderPresetLabel(provider: AiProviderConfig) {
  const preset = CUSTOM_AI_SERVICE_PRESETS.find((item) => item.id === provider.sourcePresetId);

  if (preset) return `${preset.label} 预设`;
  if (provider.providerFamily === "openai") return "OpenAI 原生";
  if (provider.providerFamily === "gemini") return "Gemini 原生";
  if (provider.providerFamily === "anthropic" || provider.providerFamily === "claude") {
    return "Anthropic 原生";
  }
  if (provider.providerFamily === "kimi") return "Kimi 预设";
  if (provider.providerFamily === "minimax") return "MiniMax 预设";
  if (provider.providerType === "local") return "LM Studio";
  return "自定义兼容服务";
}

export function aiProviderRequiresApiKey(provider: AiProviderConfig) {
  return provider.apiKeyRequired ?? (provider.authMode !== "none" && provider.providerType !== "local");
}

export function aiProviderSupportsImageInput(provider: AiProviderConfig) {
  if (provider.adapterProtocol === "openai_images") return false;
  if (provider.adapterProtocol === "anthropic_messages") return false;
  if (provider.adapterProtocol === "gemini_native") return true;
  if (provider.adapterProtocol === "openai_chat_completions") return true;
  if (provider.providerType === "local" || provider.isLocal) return true;
  if (provider.providerType === "openai_compatible") return true;
  if (provider.providerFamily === "openai") return true;

  return false;
}

export function aiModelDeclaresImageInput(model: AiModelConfig) {
  return Boolean(model.supportsVision || model.capabilities.includes("vision"));
}

export function aiModelImageInputVerified(model: AiModelConfig) {
  return model.capabilityVerification?.image === "verified";
}

export function aiModelCanRouteImageTask(
  provider: AiProviderConfig,
  model: AiModelConfig,
) {
  return (
    provider.enabled &&
    provider.connectionVerification?.status === "verified" &&
    model.enabled &&
    aiProviderSupportsImageInput(provider) &&
    aiModelDeclaresImageInput(model) &&
    aiModelImageInputVerified(model)
  );
}

export function aiProviderHasReasoningParameterMapping(provider: AiProviderConfig) {
  void provider;
  return false;
}

export function migrateLegacyAiSettings(
  legacy: LegacyAiSettings | undefined,
): {
  aiProviders: AiProviderConfig[];
  aiModels: AiModelConfig[];
  aiTaskRouting: AiTaskRouting;
  aiContentPreferences: AiContentPreferences;
  aiPrivacySettings: AiPrivacySettings;
} {
  if (!legacy) {
    return {
      aiProviders: DEFAULT_AI_PROVIDERS,
      aiModels: DEFAULT_AI_MODELS,
      aiTaskRouting: DEFAULT_AI_TASK_ROUTING,
      aiContentPreferences: DEFAULT_AI_CONTENT_PREFERENCES,
      aiPrivacySettings: DEFAULT_AI_PRIVACY_SETTINGS,
    };
  }

  const providerId = DEFAULT_AI_PROVIDER_ID;
  const modelId = "model-legacy-default";
  const providerType =
    legacy.defaultProvider.toLowerCase().includes("compatible")
      ? "openai_compatible"
      : legacy.defaultProvider.toLowerCase().includes("local")
        ? "local"
        : "openai_official";

  return {
    aiProviders: [
      {
        ...createProviderPreset("openai", {
          id: providerId,
          name: legacy.defaultProvider || "迁移过来的 AI 服务",
          providerType,
          connectionMode: providerType === "openai_compatible" ? "compatible" : "official",
          enabled: true,
        }),
        notes: "这是从旧版 AI 整理配置迁过来的默认接入。",
        authMode: providerType === "local" ? "none" : "bearer",
      },
    ],
    aiModels: [
      {
        id: modelId,
        providerId,
        modelId: legacy.defaultModel || "legacy-default",
        modelName: legacy.defaultModel || "legacy-default",
        displayName: legacy.defaultModel || "迁移过来的默认模型",
        capabilities: ["analysis", "rewrite", "publish_package", "video_script"],
        enabled: true,
      },
    ],
    aiTaskRouting: {
      analysis: { providerId, modelId },
      languageAnalysis: { providerId, modelId },
      segmentAnalysis: { providerId, modelId },
      feynmanFeedback: { providerId, modelId },
      contentAnalysis: { providerId, modelId },
      rewrite: { providerId, modelId },
      outputDraft: { providerId, modelId },
      publishPackage: { providerId, modelId },
      videoScript: { providerId, modelId },
      imageTextExtraction: { providerId, modelId },
    },
    aiContentPreferences: {
      defaultOutputLanguage: legacy.defaultOutputLanguage === "中文" ? "zh" : "en",
      rewriteTone: normalizeLegacyTone(legacy.defaultTone),
      rewriteStrategy: normalizeLegacyStrategy(legacy.defaultTranslationStrategy),
      autoGenerateMultiPlatformVersions: legacy.autoGenerateMultiPlatformOutputs,
    },
    aiPrivacySettings: DEFAULT_AI_PRIVACY_SETTINGS,
  };
}

function normalizeAiProviders(inputProviders: AiProviderConfig[]) {
  const normalizedDefaultProviders = DEFAULT_AI_PROVIDERS.map((defaultProvider) => {
    const incomingProvider = findIncomingProviderForDefault(defaultProvider, inputProviders);

    if (!incomingProvider) {
      return { ...cloneConfig(defaultProvider), connectionVerification: normalizeVerificationRecord(defaultProvider.connectionVerification) };
    }

    return {
      ...defaultProvider,
      enabled: Boolean(incomingProvider.enabled),
      baseUrl: incomingProvider.baseUrl?.trim() || defaultProvider.baseUrl,
      customEndpointPath: incomingProvider.customEndpointPath ?? defaultProvider.customEndpointPath ?? "",
      sourcePresetId: incomingProvider.sourcePresetId ?? defaultProvider.sourcePresetId ?? "",
      credentialRef: incomingProvider.credentialRef ?? "",
      apiKeyRef: incomingProvider.apiKeyRef ?? "",
      apiKeyRequired:
        incomingProvider.apiKeyRequired ??
        defaultProvider.apiKeyRequired ??
        defaultProvider.authMode !== "none",
      authMode: incomingProvider.authMode ?? defaultProvider.authMode,
      authHeaderName: incomingProvider.authHeaderName ?? "",
      extraHeaders: normalizeProviderExtraHeaders(incomingProvider.extraHeaders),
      allowSensitiveContent:
        incomingProvider.allowSensitiveContent ?? defaultProvider.allowSensitiveContent,
      allowFullMaterial: incomingProvider.allowFullMaterial ?? defaultProvider.allowFullMaterial,
      timeoutMs: incomingProvider.timeoutMs ?? defaultProvider.timeoutMs,
      connectionVerification: normalizeVerificationRecord(
        incomingProvider.connectionVerification,
      ),
    };
  });

  const defaultProviderIds = new Set(DEFAULT_AI_PROVIDERS.map((provider) => provider.id));
  const customProviders = inputProviders
    .filter((provider) => !defaultProviderIds.has(provider.id))
    .filter(isSupportedCustomProvider)
    .map(normalizeCustomProvider);

  return [...normalizedDefaultProviders, ...customProviders];
}

function normalizeAiModels(
  inputModels: AiModelConfig[],
  inputProviders: AiProviderConfig[],
  resetLegacyDefaults: boolean,
) {
  const normalizedModels = new Map(
    DEFAULT_AI_MODELS.map((model) => [model.id, { ...cloneConfig(model), capabilityVerificationDetails: normalizeCapabilityVerificationDetails(model.capabilityVerificationDetails) }]),
  );
  const supportedProviderIds = new Set<string>([
    ...inputProviders.map((provider) => provider.id),
  ]);

  inputModels.forEach((model) => {
    const providerId = normalizeProviderId(model.providerId, inputProviders);

    if (
      !supportedProviderIds.has(providerId) ||
      isRetiredBuiltInModel(model) ||
      (resetLegacyDefaults && isLegacyDefaultModel(model))
    ) {
      return;
    }

    const existing = normalizedModels.get(model.id);
    const nextSupportsText = model.supportsText ?? existing?.supportsText ?? true;
    const nextSupportsStructuredOutput =
      model.supportsStructuredOutput ?? model.supportsJsonMode ?? existing?.supportsStructuredOutput ?? existing?.supportsJsonMode ?? false;
    const nextSupportsVision = model.supportsVision ?? existing?.supportsVision ?? model.capabilities?.includes("vision") ?? false;
    const nextSupportsReasoning = model.supportsReasoning ?? existing?.supportsReasoning ?? false;
    const nextSupportsStreaming = model.supportsStreaming ?? existing?.supportsStreaming ?? false;
    normalizedModels.set(model.id, {
      ...(existing ?? createModelShell(model, providerId)),
      ...model,
      providerId,
      modelId:
        typeof model.modelId === "string"
          ? model.modelId
          : existing?.modelId || "",
      modelName:
        typeof model.modelName === "string"
          ? model.modelName
          : typeof model.modelId === "string"
            ? model.modelId
            : existing?.modelName || "",
      displayName:
        typeof model.displayName === "string"
          ? model.displayName
          : existing?.displayName ||
            `${providerId === DEFAULT_AI_LOCAL_PROVIDER_ID ? "LM Studio" : "自定义模型"} · ${
              model.modelId || ""
            }`,
      supportsText: nextSupportsText,
      supportsJsonMode: model.supportsJsonMode ?? existing?.supportsJsonMode ?? nextSupportsStructuredOutput,
      supportsVision: nextSupportsVision,
      supportsStructuredOutput: nextSupportsStructuredOutput,
      supportsReasoning: nextSupportsReasoning,
      supportsStreaming: nextSupportsStreaming,
      reasoningEffort: model.reasoningEffort ?? existing?.reasoningEffort ?? "provider_default",
      capabilityVerification: normalizeCapabilityVerification(
        model.capabilityVerification ?? existing?.capabilityVerification,
      ),
      capabilityVerificationDetails: normalizeCapabilityVerificationDetails(
        model.capabilityVerificationDetails ?? existing?.capabilityVerificationDetails,
      ),
      enabled: model.enabled ?? existing?.enabled ?? true,
    });
  });

  return [...normalizedModels.values()];
}

function normalizeAiTaskRouting(
  routing: AiTaskRouting | undefined,
  normalizedModels: AiModelConfig[],
  normalizedProviders: AiProviderConfig[],
  resetLegacyDefaults: boolean,
): AiTaskRouting {
  return {
    analysis: normalizeRoute(
      routing?.analysis,
      DEFAULT_AI_TASK_ROUTING.analysis,
      "analysis",
      normalizedModels,
      normalizedProviders,
      resetLegacyDefaults,
    ),
    languageAnalysis: normalizeRoute(
      routing?.languageAnalysis,
      DEFAULT_AI_TASK_ROUTING.languageAnalysis ?? DEFAULT_AI_TASK_ROUTING.analysis,
      "analysis",
      normalizedModels,
      normalizedProviders,
      resetLegacyDefaults,
    ),
    ...(routing?.phraseAnalysis
      ? {
          phraseAnalysis: normalizeRoute(
            routing.phraseAnalysis,
            DEFAULT_AI_TASK_ROUTING.languageAnalysis ?? DEFAULT_AI_TASK_ROUTING.analysis,
            "analysis",
            normalizedModels,
            normalizedProviders,
            resetLegacyDefaults,
          ),
        }
      : {}),
    ...(routing?.sentenceGrammarAnalysis
      ? {
          sentenceGrammarAnalysis: normalizeRoute(
            routing.sentenceGrammarAnalysis,
            DEFAULT_AI_TASK_ROUTING.languageAnalysis ?? DEFAULT_AI_TASK_ROUTING.analysis,
            "analysis",
            normalizedModels,
            normalizedProviders,
            resetLegacyDefaults,
          ),
        }
      : {}),
    segmentAnalysis: normalizeRoute(
      routing?.segmentAnalysis,
      DEFAULT_AI_TASK_ROUTING.segmentAnalysis ?? DEFAULT_AI_TASK_ROUTING.analysis,
      "analysis",
      normalizedModels,
      normalizedProviders,
      resetLegacyDefaults,
    ),
    feynmanFeedback: normalizeRoute(
      routing?.feynmanFeedback,
      DEFAULT_AI_TASK_ROUTING.feynmanFeedback ?? DEFAULT_AI_TASK_ROUTING.analysis,
      "analysis",
      normalizedModels,
      normalizedProviders,
      resetLegacyDefaults,
    ),
    contentAnalysis: normalizeRoute(
      routing?.contentAnalysis,
      DEFAULT_AI_TASK_ROUTING.contentAnalysis ?? DEFAULT_AI_TASK_ROUTING.analysis,
      "analysis",
      normalizedModels,
      normalizedProviders,
      resetLegacyDefaults,
    ),
    rewrite: normalizeRoute(
      routing?.rewrite,
      DEFAULT_AI_TASK_ROUTING.rewrite,
      "rewrite",
      normalizedModels,
      normalizedProviders,
      resetLegacyDefaults,
    ),
    outputDraft: normalizeRoute(
      routing?.outputDraft,
      DEFAULT_AI_TASK_ROUTING.outputDraft ?? DEFAULT_AI_TASK_ROUTING.rewrite,
      "rewrite",
      normalizedModels,
      normalizedProviders,
      resetLegacyDefaults,
    ),
    publishPackage: normalizeRoute(
      routing?.publishPackage,
      DEFAULT_AI_TASK_ROUTING.publishPackage,
      "publish_package",
      normalizedModels,
      normalizedProviders,
      resetLegacyDefaults,
    ),
    videoScript: normalizeRoute(
      routing?.videoScript,
      DEFAULT_AI_TASK_ROUTING.videoScript,
      "video_script",
      normalizedModels,
      normalizedProviders,
      resetLegacyDefaults,
    ),
    ...(routing?.imageTextExtraction
      ? (() => {
          const imageRoute = normalizeImageTaskRoute(
            routing.imageTextExtraction,
            normalizedModels,
            normalizedProviders,
            resetLegacyDefaults,
          );
          return imageRoute ? { imageTextExtraction: imageRoute } : {};
        })()
      : {}),
    ...(routing?.imageGeneration
      ? (() => {
          const imageRoute = normalizeImageApiTaskRoute(
            routing.imageGeneration,
            normalizedModels,
            normalizedProviders,
          );
          return imageRoute ? { imageGeneration: imageRoute } : {};
        })()
      : {}),
    ...(routing?.imageEditing
      ? (() => {
          const imageRoute = normalizeImageApiTaskRoute(
            routing.imageEditing,
            normalizedModels,
            normalizedProviders,
          );
          return imageRoute ? { imageEditing: imageRoute } : {};
        })()
      : {}),
  };
}

function normalizeImageTaskRoute(
  route: AiTaskRouting["imageTextExtraction"],
  normalizedModels: AiModelConfig[],
  normalizedProviders: AiProviderConfig[],
  resetLegacyDefaults: boolean,
): AiTaskRouting["imageTextExtraction"] | undefined {
  if (!route?.providerId || !route.modelId) return undefined;

  const model = normalizedModels.find(
    (item) => item.id === route.modelId && item.providerId === route.providerId,
  );
  const provider = model
    ? normalizedProviders.find((item) => item.id === model.providerId)
    : undefined;

  if (
    !model ||
    !provider ||
    !provider.enabled ||
    !model.enabled ||
    (resetLegacyDefaults && isLegacyDefaultModel(model)) ||
    !modelHasRouteCapability(model, "vision", provider)
  ) {
    return undefined;
  }

  return {
    ...route,
    providerId: model.providerId,
    modelId: model.id,
  };
}

function normalizeImageApiTaskRoute(
  route: AiTaskRouting["imageGeneration"],
  normalizedModels: AiModelConfig[],
  normalizedProviders: AiProviderConfig[],
): AiTaskRouting["imageGeneration"] | undefined {
  if (!route?.providerId || !route.modelId) return undefined;

  const model = normalizedModels.find(
    (item) => item.id === route.modelId && item.providerId === route.providerId,
  );
  const provider = model
    ? normalizedProviders.find((item) => item.id === model.providerId)
    : undefined;

  if (
    !model ||
    !provider ||
    !provider.enabled ||
    !model.enabled ||
    provider.adapterProtocol !== "openai_images" ||
    !model.capabilities.includes("image")
  ) {
    return undefined;
  }

  return {
    ...route,
    providerId: model.providerId,
    modelId: model.id,
  };
}

function normalizeRoute(
  route: AiTaskRouting["analysis"] | undefined,
  fallbackRoute: AiTaskRouting["analysis"],
  capability: AiModelConfig["capabilities"][number],
  normalizedModels: AiModelConfig[],
  normalizedProviders: AiProviderConfig[],
  resetLegacyDefaults: boolean,
) {
  const model = route
    ? normalizedModels.find(
        (item) =>
          item.id === route.modelId &&
          item.providerId === route.providerId &&
          modelHasRouteCapability(
            item,
            capability,
            normalizedProviders.find((provider) => provider.id === item.providerId),
          ),
      ) ??
      normalizedModels.find(
        (item) =>
          item.id === route.modelId &&
          modelHasRouteCapability(
            item,
            capability,
            normalizedProviders.find((provider) => provider.id === item.providerId),
          ),
      )
    : null;

  if (
    !model ||
    (resetLegacyDefaults && isLegacyDefaultModel(model))
  ) {
    return cloneConfig(fallbackRoute);
  }

  return {
    ...fallbackRoute,
    ...route,
    providerId: model.providerId,
    modelId: model.id,
  };
}

function modelHasRouteCapability(
  model: AiModelConfig,
  capability: AiModelCapability,
  provider?: AiProviderConfig,
) {
  if (capability === "vision") {
    return Boolean(provider && aiModelCanRouteImageTask(provider, model));
  }

  if (model.capabilities.includes(capability)) return true;

  return false;
}

function isSupportedCustomProvider(provider: AiProviderConfig) {
  if (!provider.id?.trim()) return false;

  return (
    provider.adapterProtocol === "openai_chat_completions" ||
    provider.adapterProtocol === "openai_images" ||
    provider.adapterProtocol === "gemini_native" ||
    provider.adapterProtocol === "anthropic_messages" ||
    provider.providerFamily === "gemini" ||
    provider.providerFamily === "anthropic" ||
    provider.providerFamily === "claude" ||
    provider.providerType === "openai_compatible" ||
    provider.providerType === "local"
  );
}

function hasProviderCredential(provider: AiProviderConfig) {
  return Boolean(provider.credentialRef?.trim() || provider.apiKeyRef?.trim());
}

function hasUserEditedProvider(provider: AiProviderConfig) {
  const defaultProvider = DEFAULT_AI_PROVIDERS.find((item) => item.id === provider.id);

  if (!defaultProvider) return true;

  return (
    provider.displayName?.trim() !== defaultProvider.displayName?.trim() ||
    provider.name.trim() !== defaultProvider.name.trim() ||
    provider.baseUrl.trim() !== defaultProvider.baseUrl.trim() ||
    (provider.customEndpointPath ?? "").trim() !== (defaultProvider.customEndpointPath ?? "").trim() ||
    provider.authMode !== defaultProvider.authMode ||
    provider.authHeaderName?.trim() !== defaultProvider.authHeaderName?.trim() ||
    provider.apiKeyRequired !== defaultProvider.apiKeyRequired ||
    (provider.extraHeaders ?? []).some((header) => header.name.trim() || header.value.trim())
  );
}

function hasUserModel(provider: AiProviderConfig, models: AiModelConfig[]) {
  return models.some((model) => model.providerId === provider.id && !isDefaultAiModel(model));
}

function isDefaultAiModel(model: AiModelConfig) {
  return DEFAULT_AI_MODELS.some((item) => item.id === model.id);
}

function isOpenAiOfficialProviderConfig(provider: AiProviderConfig) {
  return (
    provider.id === DEFAULT_AI_PROVIDER_ID ||
    (provider.providerFamily === "openai" &&
      provider.providerType === "openai_official" &&
      provider.connectionMode === "official")
  );
}

function normalizeCustomProvider(provider: AiProviderConfig): AiProviderConfig {
  const providerType =
    provider.providerType === "local"
      ? "local"
      : provider.adapterProtocol === "gemini_native"
        ? "openai_official"
        : provider.adapterProtocol === "anthropic_messages"
          ? "openai_official"
          : provider.providerType === "custom_rest"
            ? "openai_compatible"
            : provider.providerType;
  const adapterProtocol =
    provider.adapterProtocol ?? inferAdapterProtocol(provider.providerFamily, providerType);
  const isLocalProvider = providerType === "local" || provider.providerFamily === "local";
  const authMode = provider.authMode ?? (
    adapterProtocol === "gemini_native"
      ? "google_api_key"
      : adapterProtocol === "anthropic_messages"
        ? "anthropic_api_key"
        : (isLocalProvider ? "none" : "bearer"));

  return {
    ...provider,
    name: provider.name?.trim() || provider.displayName?.trim() || "自定义 AI 服务",
    displayName: provider.displayName?.trim() || provider.name?.trim() || "自定义 AI 服务",
    providerKind: provider.providerKind ?? inferProviderKind(providerType),
    providerType,
    connectionMode:
      provider.connectionMode ?? (isLocalProvider ? "compatible" : "custom_base_url"),
    adapterProtocol,
    baseUrl: provider.baseUrl?.trim() ?? "",
    endpointMode:
      provider.endpointMode ??
      (adapterProtocol === "openai_images"
        ? "image_generations"
        : inferEndpointMode(provider.providerFamily, providerType)),
    customEndpointPath: provider.customEndpointPath ?? "",
    sourcePresetId: provider.sourcePresetId ?? "",
    credentialRef: provider.credentialRef ?? "",
    apiKeyRef: provider.apiKeyRef ?? "",
    apiKeyRequired: provider.apiKeyRequired ?? (authMode !== "none" && providerType !== "local"),
    authMode,
    authHeaderName: provider.authHeaderName ?? "",
    extraHeaders: normalizeProviderExtraHeaders(provider.extraHeaders),
    isLocal: provider.isLocal ?? isLocalProvider,
    isRemote: provider.isRemote ?? !isLocalProvider,
    allowSensitiveContent: provider.allowSensitiveContent ?? isLocalProvider,
    allowFullMaterial: provider.allowFullMaterial ?? isLocalProvider,
    timeoutMs: provider.timeoutMs ?? (isLocalProvider ? 120000 : 45000),
    enabled: Boolean(provider.enabled),
    connectionVerification: normalizeVerificationRecord(provider.connectionVerification),
    notes:
      provider.notes ??
      "接口地址和模型 ID 可能随服务商更新，请以服务商当前文档为准。",
  };
}

function normalizeProviderExtraHeaders(value: AiProviderConfig["extraHeaders"]) {
  return (value ?? [])
    .map((header) => ({
      id: header.id || createConfigId("header"),
      name: header.name ?? "",
      value: header.value ?? "",
      enabled: header.enabled ?? true,
    }))
    .filter((header) => header.name.trim() || header.value.trim());
}

function findIncomingProviderForDefault(
  defaultProvider: AiProviderConfig,
  inputProviders: AiProviderConfig[],
) {
  const direct = inputProviders.find((provider) => provider.id === defaultProvider.id);

  if (direct) {
    return direct;
  }

  return undefined;
}

function normalizeProviderId(providerId: string, inputProviders: AiProviderConfig[]) {
  const provider = inputProviders.find((item) => item.id === providerId);

  if (provider) {
    return providerId;
  }

  return inputProviders.some((item) => item.id === DEFAULT_AI_PROVIDER_ID)
    ? DEFAULT_AI_PROVIDER_ID
    : inputProviders[0]?.id ?? DEFAULT_AI_PROVIDER_ID;
}

function isRetiredBuiltInModel(model: AiModelConfig) {
  return ["model-openai-gpt-5-5-mini", "model-openai-gpt-5-5", "model-custom-default"].includes(model.id)
    && /^gpt-5\.5(?:-mini)?$/.test(model.modelId);
}

function isLegacyDefaultModel(model: AiModelConfig) {
  // Older versions matched names such as "claude" anywhere, deleting user models.
  return ["legacy-default-model", "model-legacy-default"].includes(model.id)
    && /^gpt-(?:4\.1|5\.4)(?:-mini|-nano)?$/.test(model.modelId);
}

function createModelShell(model: AiModelConfig, providerId: string): AiModelConfig {
  return {
    id: model.id,
    providerId,
    modelId: model.modelId || "",
    modelName: model.modelName || model.modelId || "",
    displayName: model.displayName || "自定义模型",
    capabilities: model.capabilities?.length
      ? model.capabilities
      : ["analysis", "rewrite", "publish_package", "video_script"],
    supportsText: model.supportsText ?? true,
    supportsVision: model.supportsVision ?? model.capabilities?.includes("vision") ?? false,
    supportsStructuredOutput: model.supportsStructuredOutput ?? model.supportsJsonMode ?? false,
    supportsReasoning: model.supportsReasoning ?? false,
    supportsStreaming: model.supportsStreaming ?? false,
    reasoningEffort: model.reasoningEffort ?? "provider_default",
    capabilityVerification: normalizeCapabilityVerification(model.capabilityVerification),
    capabilityVerificationDetails: normalizeCapabilityVerificationDetails(
      model.capabilityVerificationDetails,
    ),
    enabled: true,
  };
}

function normalizeModelCapabilities(
  capabilities: AiModelCapability[],
  supportsVision: boolean,
  supportsText: boolean,
): AiModelCapability[] {
  const values = new Set<AiModelCapability>(capabilities.length ? capabilities : ["analysis", "rewrite"]);

  if (supportsText) {
    values.add("text");
  } else {
    values.delete("text");
  }

  if (supportsVision) {
    values.add("vision");
  } else {
    values.delete("vision");
  }

  return [...values];
}

function normalizeCapabilityVerification(
  value: AiModelConfig["capabilityVerification"] | undefined,
): NonNullable<AiModelConfig["capabilityVerification"]> {
  return {
    text: value?.text ?? "unverified",
    image: value?.image ?? "unverified",
    structuredOutput: value?.structuredOutput ?? "unverified",
    reasoning: value?.reasoning ?? "unverified",
    streaming: value?.streaming ?? "unverified",
  };
}

function normalizeCapabilityVerificationDetails(
  value: AiModelConfig["capabilityVerificationDetails"] | undefined,
): NonNullable<AiModelConfig["capabilityVerificationDetails"]> {
  return {
    ...(value?.text ? { text: normalizeVerificationRecord(value.text) } : {}),
    ...(value?.image ? { image: normalizeVerificationRecord(value.image) } : {}),
  };
}

function normalizeVerificationRecord(
  value: AiProviderConfig["connectionVerification"],
): NonNullable<AiProviderConfig["connectionVerification"]> {
  const status = value?.status;

  return {
    status:
      status === "verified" || status === "failed" || status === "unverified"
        ? status
        : "unverified",
    ...(value?.checkedAt ? { checkedAt: value.checkedAt } : {}),
    ...(value?.requestUrl ? { requestUrl: value.requestUrl } : {}),
    ...(value?.message ? { message: value.message } : {}),
  };
}

function cloneConfig<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createConfigId(prefix: string) {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createProviderPreset(
  providerFamily: AiProviderFamily,
  overrides: Partial<AiProviderConfig> &
    Pick<AiProviderConfig, "id" | "name" | "providerType" | "connectionMode" | "enabled">,
): AiProviderConfig {
  const isLocalProvider = providerFamily === "local" || overrides.providerType === "local";

  return {
    id: overrides.id,
    name: overrides.name,
    displayName: overrides.displayName ?? overrides.name,
    providerKind: overrides.providerKind ?? inferProviderKind(overrides.providerType),
    providerFamily,
    providerType: overrides.providerType,
    connectionMode: overrides.connectionMode,
    adapterProtocol:
      overrides.adapterProtocol ?? inferAdapterProtocol(providerFamily, overrides.providerType),
    baseUrl: overrides.baseUrl ?? "",
    endpointMode: overrides.endpointMode ?? inferEndpointMode(providerFamily, overrides.providerType),
    customEndpointPath: overrides.customEndpointPath ?? "",
    sourcePresetId: overrides.sourcePresetId ?? "",
    credentialRef: overrides.credentialRef ?? "",
    apiKeyRef: overrides.apiKeyRef ?? "",
    apiKeyRequired:
      overrides.apiKeyRequired ??
      ((overrides.authMode ?? (providerFamily === "local" ? "none" : "bearer")) !== "none"),
    authMode: overrides.authMode ?? (providerFamily === "local" ? "none" : "bearer"),
    authHeaderName: overrides.authHeaderName ?? "",
    extraHeaders: normalizeProviderExtraHeaders(overrides.extraHeaders),
    isLocal: overrides.isLocal ?? isLocalProvider,
    isRemote: overrides.isRemote ?? !isLocalProvider,
    allowSensitiveContent:
      overrides.allowSensitiveContent ??
      isLocalProvider,
    allowFullMaterial: overrides.allowFullMaterial ?? isLocalProvider,
    timeoutMs: overrides.timeoutMs ?? (providerFamily === "local" ? 120000 : 45000),
    enabled: overrides.enabled,
    notes:
      overrides.notes ??
      (providerFamily === "custom"
        ? "先选择兼容接口或自定义地址，再填写服务地址和 API 密钥。"
        : "默认使用预设配置；需要兼容接口或中转服务时，可在高级设置中调整。"),
  };
}

function inferProviderKind(providerType: AiProviderConfig["providerType"]): AiProviderKind {
  if (providerType === "local") return "local";
  if (providerType === "openai_compatible") return "openai_compatible";
  if (providerType === "custom_rest") return "custom";
  return "native";
}

function inferAdapterProtocol(
  providerFamily: AiProviderFamily,
  providerType: AiProviderConfig["providerType"],
): AiAdapterProtocol {
  if (providerType === "openai_compatible" || providerType === "local") {
    return "openai_chat_completions";
  }

  if (providerFamily === "gemini") return "gemini_native";
  if (providerFamily === "anthropic" || providerFamily === "claude") return "anthropic_messages";
  if (providerFamily === "openai") return "openai_chat_completions";

  return "openai_chat_completions";
}

function inferEndpointMode(
  providerFamily: AiProviderFamily,
  providerType: AiProviderConfig["providerType"],
) {
  const protocol = inferAdapterProtocol(providerFamily, providerType);

  if (protocol === "gemini_native") return "gemini_generate_content";
  if (protocol === "anthropic_messages") return "anthropic_messages";
  if (protocol === "openai_images") return "image_generations";
  if (protocol === "openai_chat_completions") return "chat_completions";
  return "custom";
}

function normalizeLegacyTone(value: string): AiContentPreferences["rewriteTone"] {
  if (value.includes("专业")) return "professional";
  if (value.includes("克制") || value.includes("平静")) return "calm";
  if (value.includes("直接")) return "direct";
  return "natural";
}

function normalizeLegacyStrategy(
  value: LegacyAiSettings["defaultTranslationStrategy"],
): AiContentPreferences["rewriteStrategy"] {
  if (value === "直译") return "literal";
  if (value === "深度重写") return "deep_rewrite";
  return "localized";
}
