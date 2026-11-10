import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CUSTOM_AI_SERVICE_PRESETS,
  DEFAULT_AI_CUSTOM_PROVIDER_ID,
  DEFAULT_AI_LOCAL_PROVIDER_ID,
  DEFAULT_AI_MODELS,
  DEFAULT_AI_PROVIDER_ID,
  DEFAULT_AI_PROVIDERS,
  DEFAULT_AI_TASK_ROUTING,
  aiModelCanRouteImageTask,
  aiProviderHasReasoningParameterMapping,
  aiProviderSupportsImageInput,
  createCustomAiModelConfig,
  createCustomAiProviderConfig,
  getAiProviderProtocolLabel,
  getAiProviderSetupStatus,
  isAiProviderConfigured,
  isAiServiceInstance,
  normalizeAiConfiguration,
} from "@/src/lib/aiConfig";
import {
  buildProviderTestRequest,
  getEffectiveProviderBaseUrl,
  mapProviderToLlmProvider,
  modelSupportsCapability,
  resolveTaskRuntimeConfig,
} from "@/src/lib/llm/config";
import { anthropicAdapter } from "@/src/lib/llm/providers/anthropic";
import { geminiAdapter } from "@/src/lib/llm/providers/gemini";
import {
  buildOpenAiCompatibleEndpoint,
  openAICompatibleAdapter,
} from "@/src/lib/llm/providers/openaiCompatible";
import { createCredentialRef, saveCredentialSecret } from "@/src/lib/secrets/secretStore";
import type {
  AiModelConfig,
  AiProviderConfig,
  AiTaskRouting,
} from "@/src/lib/types";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function localProvider(): AiProviderConfig {
  return {
    ...clone(DEFAULT_AI_PROVIDERS.find((provider) => provider.id === DEFAULT_AI_LOCAL_PROVIDER_ID)!),
    enabled: true,
    authMode: "none",
    baseUrl: "http://localhost:1234/v1",
    connectionVerification: { status: "verified" },
  };
}

function localModel(overrides: Partial<AiModelConfig> = {}): AiModelConfig {
  return {
    ...clone(DEFAULT_AI_MODELS.find((model) => model.providerId === DEFAULT_AI_LOCAL_PROVIDER_ID)!),
    id: "local-custom-model",
    providerId: DEFAULT_AI_LOCAL_PROVIDER_ID,
    displayName: "Local display name",
    modelName: "Local display name",
    modelId: "gpt-5.5",
    enabled: true,
    supportsText: true,
    supportsVision: false,
    supportsReasoning: false,
    supportsStructuredOutput: false,
    supportsStreaming: false,
    capabilityVerification: {
      text: "unverified",
      image: "unverified",
      structuredOutput: "unverified",
      reasoning: "unverified",
      streaming: "unverified",
    },
    ...overrides,
  };
}

describe("AI provider routing", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps service templates out of configured service counts", () => {
    const normalized = normalizeAiConfiguration({});
    const serviceInstances = normalized.aiProviders.filter((provider) =>
      isAiServiceInstance(provider, normalized.aiModels),
    );

    expect(CUSTOM_AI_SERVICE_PRESETS.map((preset) => preset.id)).toContain("gemini-native");
    expect(CUSTOM_AI_SERVICE_PRESETS.map((preset) => preset.id)).toContain("anthropic-messages");
    expect(serviceInstances).toEqual([]);
    expect(normalized.aiProviders.some((provider) => provider.providerFamily === "gemini")).toBe(
      false,
    );
    expect(
      normalized.aiProviders.some((provider) => provider.providerFamily === "anthropic"),
    ).toBe(false);
    expect(normalized.aiModels.some((model) => model.providerId.includes("gemini"))).toBe(false);
    expect(normalized.aiModels.some((model) => model.providerId.includes("anthropic"))).toBe(
      false,
    );
  });

  it("persists an image relay service with base URL, credential reference, and exact model ID", () => {
    const provider = {
      ...createCustomAiProviderConfig({
        presetId: "openai-compatible",
        id: "provider-image-relay",
        name: "Image relay",
        baseUrl: "https://images.example.com/v1",
      }),
      customEndpointPath: "",
      endpointMode: "chat_completions" as const,
      credentialRef: createCredentialRef("provider-image-relay"),
      apiKeyRef: "",
      enabled: true,
      connectionVerification: { status: "verified" as const },
    };
    const model = createCustomAiModelConfig(provider, {
      id: "model-image-relay",
      displayName: "Image reader",
      modelId: "provider-model-id-exact",
      supportsVision: true,
      capabilities: ["text", "vision"],
      capabilityVerification: { image: "verified" },
    });
    const normalized = normalizeAiConfiguration({
      aiProviders: [provider],
      aiModels: [model],
      aiTaskRouting: {
        ...clone(DEFAULT_AI_TASK_ROUTING),
        imageTextExtraction: {
          providerId: provider.id,
          modelId: model.id,
          enabled: true,
        },
      },
    });
    const serialized = JSON.stringify(normalized);
    const savedProvider = normalized.aiProviders.find((item) => item.id === provider.id);
    const savedModel = normalized.aiModels.find((item) => item.id === model.id);

    expect(savedProvider?.baseUrl).toBe("https://images.example.com/v1");
    expect(savedProvider?.customEndpointPath).toBe("");
    expect(savedProvider?.endpointMode).toBe("chat_completions");
    expect(savedProvider?.credentialRef).toBe("verniq:ai-provider:provider-image-relay:api-key");
    expect(savedModel?.modelId).toBe("provider-model-id-exact");
    expect(normalized.aiTaskRouting.imageTextExtraction).toMatchObject({
      providerId: provider.id,
      modelId: model.id,
    });
    expect(serialized).not.toContain("sk-live-secret");
  });

  it("uses Chat Completions for image text extraction even when an old image-generation endpoint is saved", async () => {
    const provider = {
      ...createCustomAiProviderConfig({
        presetId: "openai-compatible",
        id: "provider-image-relay-old-endpoint",
        name: "Image relay",
        baseUrl: "https://draw.example.com/v1",
      }),
      authMode: "none" as const,
      apiKeyRequired: false,
      endpointMode: "custom" as const,
      customEndpointPath: "/v1/image-generation",
      enabled: true,
      connectionVerification: { status: "verified" as const },
    };
    const model = createCustomAiModelConfig(provider, {
      id: "model-image-relay-old-endpoint",
      displayName: "Image reader",
      modelId: "gpt-image-text-exact",
      supportsVision: true,
      capabilities: ["text", "vision"],
      capabilityVerification: { image: "verified" },
    });

    const runtime = await resolveTaskRuntimeConfig({
      task: "imageTextExtraction",
      capability: "vision",
      aiProviders: [provider],
      aiModels: [model],
      aiTaskRouting: {
        ...clone(DEFAULT_AI_TASK_ROUTING),
        imageTextExtraction: {
          providerId: provider.id,
          modelId: model.id,
          enabled: true,
        },
      },
    });

    expect(runtime.ok).toBe(true);

    if (runtime.ok) {
      expect(runtime.request.customEndpointPath).toBeUndefined();
      expect(buildOpenAiCompatibleEndpoint(runtime.request.baseUrl ?? "")).toBe(
        "https://draw.example.com/v1/chat/completions",
      );
      expect(runtime.request.model).toBe("gpt-image-text-exact");
    }
  });

  it("uses Chat Completions when validating image capability for an OpenAI-compatible relay", async () => {
    const provider = {
      ...createCustomAiProviderConfig({
        presetId: "openai-compatible",
        id: "provider-image-validation",
        name: "Image validation relay",
        baseUrl: "https://draw.example.com/v1",
      }),
      authMode: "none" as const,
      apiKeyRequired: false,
      endpointMode: "custom" as const,
      customEndpointPath: "/v1/image-generation",
      enabled: true,
      connectionVerification: { status: "verified" as const },
    };
    const model = createCustomAiModelConfig(provider, {
      id: "model-image-validation",
      displayName: "Image reader",
      modelId: "vision-exact",
      supportsVision: true,
      capabilities: ["text", "vision"],
    });
    const runtime = await buildProviderTestRequest(provider, [model], model.id, "image");

    expect(runtime.ok).toBe(true);

    if (runtime.ok) {
      expect(runtime.request.customEndpointPath).toBeUndefined();
      expect(buildOpenAiCompatibleEndpoint(runtime.request.baseUrl ?? "")).toBe(
        "https://draw.example.com/v1/chat/completions",
      );
      expect(runtime.request.model).toBe("vision-exact");
    }
  });

  it("can probe image input on an existing text model without a manual vision flag", async () => {
    const provider = localProvider();
    const model = localModel({ supportsVision: false, capabilities: ["text"] });
    const runtime = await buildProviderTestRequest(provider, [model], model.id, "image");
    expect(runtime.ok).toBe(true);
    expect(model.supportsVision).toBe(false);
    expect(aiModelCanRouteImageTask(provider, model)).toBe(false);
  });

  it("keeps a configured gateway chat endpoint for both image probing and extraction", async () => {
    const provider: AiProviderConfig = { ...localProvider(), providerType: "openai_compatible", providerFamily: "custom", isLocal: false, connectionMode: "custom_base_url", customEndpointPath: "/gateway/v1/chat/completions" };
    const model = localModel({ supportsVision: true, capabilities: ["text", "vision"], capabilityVerification: { image: "verified" } });
    const probe = await buildProviderTestRequest(provider, [model], model.id, "image");
    const extraction = await resolveTaskRuntimeConfig({ task: "imageTextExtraction", capability: "vision", aiProviders: [provider], aiModels: [model], aiTaskRouting: { ...clone(DEFAULT_AI_TASK_ROUTING), imageTextExtraction: { providerId: provider.id, modelId: model.id, enabled: true } } });
    for (const runtime of [probe, extraction]) {
      expect(runtime.ok).toBe(true);
      if (runtime.ok) expect(runtime.request.customEndpointPath).toBe(provider.customEndpointPath);
    }
  });

  it("keeps text and image service instances on different addresses", () => {
    const textProvider = createCustomAiProviderConfig({
      id: "provider-text-relay",
      name: "Text relay",
      baseUrl: "https://text.example.com/v1",
    });
    const imageProvider = createCustomAiProviderConfig({
      id: "provider-image-relay-2",
      name: "Image relay",
      baseUrl: "https://image.example.com/v2",
    });
    const normalized = normalizeAiConfiguration({
      aiProviders: [textProvider, imageProvider],
      aiModels: [],
      aiTaskRouting: DEFAULT_AI_TASK_ROUTING,
    });

    expect(normalized.aiProviders.find((item) => item.id === textProvider.id)?.baseUrl).toBe(
      "https://text.example.com/v1",
    );
    expect(normalized.aiProviders.find((item) => item.id === imageProvider.id)?.baseUrl).toBe(
      "https://image.example.com/v2",
    );
  });

  it("does not restore a deleted custom service or its model during normalization", () => {
    const normalized = normalizeAiConfiguration({
      aiProviders: DEFAULT_AI_PROVIDERS,
      aiModels: DEFAULT_AI_MODELS,
      aiTaskRouting: DEFAULT_AI_TASK_ROUTING,
    });

    expect(normalized.aiProviders.some((item) => item.id === "provider-deleted-test")).toBe(false);
    expect(normalized.aiModels.some((item) => item.providerId === "provider-deleted-test")).toBe(false);
  });

  it("keeps built-in text defaults out of image task routing", () => {
    const normalized = normalizeAiConfiguration({});
    const openAiModels = normalized.aiModels.filter(
      (model) => model.providerId === DEFAULT_AI_PROVIDER_ID,
    );

    expect(openAiModels.length).toBeGreaterThan(0);
    expect(openAiModels.every((model) => model.supportsVision !== true)).toBe(true);
    expect(openAiModels.every((model) => !model.capabilities.includes("vision"))).toBe(true);
  });

  it("does not fall back to language analysis when image routing is blank", async () => {
    const provider = localProvider();
    const model = localModel({
      supportsVision: true,
      capabilities: ["analysis", "rewrite", "vision"],
      capabilityVerification: {
        text: "verified",
        image: "verified",
        structuredOutput: "unverified",
        reasoning: "unverified",
        streaming: "unverified",
      },
    });
    const runtime = await resolveTaskRuntimeConfig({
      task: "imageTextExtraction",
      capability: "vision",
      aiProviders: [provider],
      aiModels: [model],
      aiTaskRouting: {
        ...clone(DEFAULT_AI_TASK_ROUTING),
        analysis: {
          ...clone(DEFAULT_AI_TASK_ROUTING.analysis),
          providerId: provider.id,
          modelId: model.id,
        },
        imageTextExtraction: {
          ...clone(DEFAULT_AI_TASK_ROUTING.imageTextExtraction!),
          providerId: "",
          modelId: "",
        },
      },
    });

    expect(runtime.ok).toBe(false);
    if (!runtime.ok) {
      expect(runtime.error).toContain("尚未配置图片文字提取模型");
    }
  });

  it("does not mark unconfigured Gemini or Anthropic services as usable", () => {
    const geminiProvider = {
      ...createCustomAiProviderConfig({
        presetId: "gemini-native",
        id: "provider-gemini-work",
        name: "Gemini work",
      }),
      enabled: true,
    };
    const anthropicProvider = {
      ...createCustomAiProviderConfig({
        presetId: "anthropic-messages",
        id: "provider-anthropic-work",
        name: "Anthropic work",
      }),
      enabled: true,
    };

    expect(isAiProviderConfigured(geminiProvider, [])).toBe(false);
    expect(isAiProviderConfigured(anthropicProvider, [])).toBe(false);
    expect(getAiProviderSetupStatus(geminiProvider, [])).toBe("not_configured");
    expect(getAiProviderSetupStatus(anthropicProvider, [])).toBe("not_configured");
  });

  it("preserves one Gemini native instance without regenerating a default duplicate", () => {
    const provider = createCustomAiProviderConfig({
      presetId: "gemini-native",
      id: "provider-gemini-personal",
      name: "Gemini personal",
    });
    const model = createCustomAiModelConfig(provider, {
      id: "model-gemini-personal",
      modelId: "gemini-user-model",
      displayName: "Gemini user model",
    });

    const normalized = normalizeAiConfiguration({
      aiProviders: [provider],
      aiModels: [model],
      aiTaskRouting: DEFAULT_AI_TASK_ROUTING,
    });
    const geminiProviders = normalized.aiProviders.filter(
      (item) => item.providerFamily === "gemini",
    );

    expect(geminiProviders).toHaveLength(1);
    expect(geminiProviders[0].id).toBe(provider.id);
    expect(normalized.aiProviders.some((item) => item.id === "provider-gemini")).toBe(false);
  });

  it("allows multiple instances of the same protocol with different provider IDs", () => {
    const workProvider = createCustomAiProviderConfig({
      presetId: "gemini-native",
      id: "provider-gemini-work",
      name: "Gemini work",
    });
    const personalProvider = createCustomAiProviderConfig({
      presetId: "gemini-native",
      id: "provider-gemini-personal",
      name: "Gemini personal",
    });

    const normalized = normalizeAiConfiguration({
      aiProviders: [workProvider, personalProvider],
      aiModels: [],
      aiTaskRouting: DEFAULT_AI_TASK_ROUTING,
    });
    const ids = normalized.aiProviders
      .filter((provider) => provider.providerFamily === "gemini")
      .map((provider) => provider.id);

    expect(ids).toEqual(["provider-gemini-work", "provider-gemini-personal"]);
  });

  it("does not merge a user-created OpenAI native instance into the built-in template", () => {
    const provider = createCustomAiProviderConfig({
      presetId: "openai-native",
      id: "provider-openai-work",
      name: "OpenAI work account",
    });
    const model = createCustomAiModelConfig(provider, {
      id: "model-openai-work",
      modelId: "gpt-5.5",
      displayName: "Work GPT 5.5",
    });
    const normalized = normalizeAiConfiguration({
      aiProviders: [provider],
      aiModels: [model],
      aiTaskRouting: DEFAULT_AI_TASK_ROUTING,
    });

    expect(normalized.aiProviders.some((item) => item.id === "provider-openai-work")).toBe(true);
    expect(normalized.aiProviders.find((item) => item.id === DEFAULT_AI_PROVIDER_ID)?.enabled).toBe(false);
  });

  it("keeps Kimi and MiniMax as independent compatible service instances", () => {
    const kimiProvider = createCustomAiProviderConfig({
      presetId: "kimi",
      id: "provider-kimi-main",
      name: "Kimi main",
    });
    const minimaxProvider = createCustomAiProviderConfig({
      presetId: "minimax",
      id: "provider-minimax-backup",
      name: "MiniMax backup",
    });
    const normalized = normalizeAiConfiguration({
      aiProviders: [kimiProvider, minimaxProvider],
      aiModels: [
        createCustomAiModelConfig(kimiProvider, {
          id: "model-kimi-main",
          modelId: "kimi-exact-model",
        }),
        createCustomAiModelConfig(minimaxProvider, {
          id: "model-minimax-backup",
          modelId: "minimax-exact-model",
        }),
      ],
      aiTaskRouting: DEFAULT_AI_TASK_ROUTING,
    });

    expect(normalized.aiProviders.find((provider) => provider.id === kimiProvider.id)?.id).toBe(
      "provider-kimi-main",
    );
    expect(
      normalized.aiProviders.find((provider) => provider.id === minimaxProvider.id)?.id,
    ).toBe("provider-minimax-backup");
    expect(
      normalized.aiProviders.find((provider) => provider.id === DEFAULT_AI_CUSTOM_PROVIDER_ID)
        ?.enabled,
    ).toBe(false);
  });

  it("routes Gemini native and Gemini compatible services to different adapters", () => {
    const native = createCustomAiProviderConfig({
      presetId: "gemini-native",
      id: "provider-gemini-native",
      name: "Gemini native",
    });
    const compatible = {
      ...createCustomAiProviderConfig({
        presetId: "openai-compatible",
        id: "provider-gemini-compatible",
        name: "Gemini compatible",
        baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      }),
      providerFamily: "gemini" as const,
    };

    expect(mapProviderToLlmProvider(native)).toBe("gemini");
    expect(mapProviderToLlmProvider(compatible)).toBe("openai-compatible");
    expect(getAiProviderProtocolLabel(native)).toBe("Gemini native · generateContent");
    expect(getAiProviderProtocolLabel(compatible)).toBe("OpenAI Chat Completions");
  });

  it("keeps the Gemini OpenAI-compatible preset on the compatible adapter", () => {
    const provider = createCustomAiProviderConfig({
      presetId: "gemini-compatible",
      id: "provider-gemini-compatible-preset",
      name: "Gemini compatible gateway",
    });
    const normalized = normalizeAiConfiguration({
      aiProviders: [provider],
      aiModels: [],
      aiTaskRouting: DEFAULT_AI_TASK_ROUTING,
    });
    const saved = normalized.aiProviders.find((item) => item.id === provider.id);

    expect(saved?.providerFamily).toBe("gemini");
    expect(saved?.adapterProtocol).toBe("openai_chat_completions");
    expect(mapProviderToLlmProvider(saved!)).toBe("openai-compatible");
  });

  it("returns a clear message when a required provider key is missing", async () => {
    const provider = {
      ...createCustomAiProviderConfig({
        presetId: "gemini-native",
        id: "provider-gemini-no-key",
        name: "Gemini without key",
      }),
      enabled: true,
    };
    const model = createCustomAiModelConfig(provider, {
      id: "model-gemini-no-key",
      modelId: "gemini-user-model",
      displayName: "Gemini user model",
    });
    const request = await buildProviderTestRequest(provider, [model], model.id);

    expect(request.ok).toBe(false);

    if (!request.ok) {
      expect(request.error).toContain("尚未填写 API 密钥");
      expect(request.error).toContain("请先填写并保存");
    }
  });

  it("routes Anthropic Messages with Anthropic API key semantics", async () => {
    const session = new Map<string, string>();
    vi.stubGlobal("window", { sessionStorage: {
      setItem: (key: string, value: string) => session.set(key, value),
      getItem: (key: string) => session.get(key) ?? null,
    } });
    const provider = {
      ...createCustomAiProviderConfig({
        presetId: "anthropic-messages",
        id: "provider-anthropic-main",
        name: "Anthropic main",
      }),
      enabled: true,
      credentialRef: createCredentialRef("provider-anthropic-main"),
    };
    const model = createCustomAiModelConfig(provider, {
      id: "model-anthropic-main",
      modelId: "claude-user-model",
      displayName: "Claude user model",
    });

    await saveCredentialSecret(provider.credentialRef, "anthropic-key");
    const request = await buildProviderTestRequest(provider, [model], model.id);

    expect(mapProviderToLlmProvider(provider)).toBe("claude");
    expect(request.ok).toBe(true);

    if (request.ok) {
      expect(request.request.provider).toBe("claude");
      expect(request.request.authMode).toBe("anthropic_api_key");
      expect(request.request.model).toBe("claude-user-model");
    }
  });

  it("does not expose Anthropic Messages as an image-input provider", async () => {
    const provider = {
      ...createCustomAiProviderConfig({
        presetId: "anthropic-messages",
        id: "provider-anthropic-text-only",
        name: "Anthropic text only",
      }),
      enabled: true,
    };
    const model = createCustomAiModelConfig(provider, {
      id: "model-anthropic-claimed-vision",
      modelId: "claude-user-model",
      displayName: "Claude claimed vision",
      supportsVision: true,
      capabilities: ["analysis", "rewrite", "vision"],
    });
    const request = await buildProviderTestRequest(provider, [model], model.id, "image");

    expect(aiProviderSupportsImageInput(provider)).toBe(false);
    expect(aiModelCanRouteImageTask(provider, model)).toBe(false);
    expect(request.ok).toBe(false);

    if (!request.ok) {
      expect(request.error).toContain("当前协议未接入图片输入");
    }
  });

  it("sends modelId exactly and never uses displayName as the request model", async () => {
    const request = await buildProviderTestRequest(localProvider(), [localModel()]);

    expect(request.ok).toBe(true);

    if (request.ok) {
      expect(request.request.model).toBe("gpt-5.5");
      expect(request.request.model).not.toBe("Local display name");
      expect(request.request.model).not.toBe("gpt-5.5-mini");
      expect(request.request).not.toHaveProperty("reasoning");
    }
  });

  it("uses fixed OpenAI base URL for the native provider", () => {
    const provider = {
      ...clone(DEFAULT_AI_PROVIDERS.find((item) => item.id === DEFAULT_AI_PROVIDER_ID)!),
      baseUrl: "https://relay.example/v1",
    };

    expect(getEffectiveProviderBaseUrl(provider)).toBe("https://api.openai.com/v1");
  });

  it("uses the user Base URL for OpenAI-compatible providers", () => {
    const provider = {
      ...clone(DEFAULT_AI_PROVIDERS.find((item) => item.id === DEFAULT_AI_CUSTOM_PROVIDER_ID)!),
      baseUrl: "https://api.example.com/v1",
    };

    expect(getEffectiveProviderBaseUrl(provider)).toBe("https://api.example.com/v1");
  });

  it("keeps custom provider endpoint headers and timeout in request construction", async () => {
    const provider = {
      ...createCustomAiProviderConfig({
        id: "provider-minimax-relay",
        presetId: "minimax",
        name: "Editable MiniMax",
        baseUrl: "https://relay.example.com",
      }),
      enabled: true,
      apiKeyRequired: false,
      authMode: "none" as const,
      endpointMode: "custom" as const,
      customEndpointPath: "/compatible/chat/completions",
      timeoutMs: 12345,
      extraHeaders: [
        {
          id: "header-client",
          name: "x-client-id",
          value: "verniq-test",
          enabled: true,
        },
      ],
    };
    const model = createCustomAiModelConfig(provider, {
      id: "model-minimax-user",
      modelId: "MiniMax-user-model",
      displayName: "Readable MiniMax",
      capabilities: ["analysis", "rewrite"],
    });
    const request = await buildProviderTestRequest(provider, [model], model.id);

    expect(request.ok).toBe(true);

    if (request.ok) {
      expect(request.request.provider).toBe("openai-compatible");
      expect(request.request.model).toBe("MiniMax-user-model");
      expect(request.request.customEndpointPath).toBe("/compatible/chat/completions");
      expect(request.request.timeoutMs).toBe(12345);
      expect(request.request.extraHeaders).toEqual([
        {
          name: "x-client-id",
          value: "verniq-test",
        },
      ]);
      expect(request.request.apiKey).toBeUndefined();
    }
  });

  it("allows LM Studio request construction without an API key", async () => {
    const request = await buildProviderTestRequest(localProvider(), [localModel()]);

    expect(request.ok).toBe(true);

    if (request.ok) {
      expect(request.request.provider).toBe("local");
      expect(request.request.apiKey).toBeUndefined();
      expect(request.request.baseUrl).toBe("http://localhost:1234/v1");
    }
  });

  it("keeps image text extraction separate from language analysis routing", async () => {
    const provider = localProvider();
    const analysisModel = localModel({
      id: "analysis-model",
      modelId: "analysis-text-model",
      supportsVision: false,
    });
    const imageModel = localModel({
      id: "image-model",
      modelId: "vision-model-exact",
      supportsVision: true,
      capabilities: ["analysis", "rewrite", "vision"],
      capabilityVerification: {
        text: "verified",
        image: "verified",
        structuredOutput: "unverified",
        reasoning: "unverified",
        streaming: "unverified",
      },
    });
    const routing: AiTaskRouting = {
      ...clone(DEFAULT_AI_TASK_ROUTING),
      analysis: {
        ...clone(DEFAULT_AI_TASK_ROUTING.analysis),
        providerId: provider.id,
        modelId: analysisModel.id,
      },
      imageTextExtraction: {
        ...clone(DEFAULT_AI_TASK_ROUTING.imageTextExtraction!),
        providerId: provider.id,
        modelId: imageModel.id,
        enabled: true,
      },
    };

    const analysis = await resolveTaskRuntimeConfig({
      task: "analysis",
      capability: "analysis",
      aiProviders: [provider],
      aiModels: [analysisModel, imageModel],
      aiTaskRouting: routing,
    });
    const image = await resolveTaskRuntimeConfig({
      task: "imageTextExtraction",
      capability: "vision",
      aiProviders: [provider],
      aiModels: [analysisModel, imageModel],
      aiTaskRouting: routing,
    });

    expect(analysis.ok).toBe(true);
    expect(image.ok).toBe(true);

    if (analysis.ok && image.ok) {
      expect(analysis.request.model).toBe("analysis-text-model");
      expect(image.request.model).toBe("vision-model-exact");
    }
  });

  it("blocks image extraction until the vision model is verified", async () => {
    const provider = localProvider();
    const model = localModel({
      supportsVision: true,
      capabilities: ["analysis", "rewrite", "vision"],
      capabilityVerification: {
        text: "verified",
        image: "unverified",
        structuredOutput: "unverified",
        reasoning: "unverified",
        streaming: "unverified",
      },
    });
    const routing: AiTaskRouting = {
      ...clone(DEFAULT_AI_TASK_ROUTING),
      imageTextExtraction: {
        ...clone(DEFAULT_AI_TASK_ROUTING.imageTextExtraction!),
        providerId: provider.id,
        modelId: model.id,
        enabled: true,
      },
    };
    const runtime = await resolveTaskRuntimeConfig({
      task: "imageTextExtraction",
      capability: "vision",
      aiProviders: [provider],
      aiModels: [model],
      aiTaskRouting: routing,
    });

    expect(runtime.ok).toBe(false);

    if (!runtime.ok) {
      expect(runtime.error).toContain("尚未配置支持图片的模型");
    }
  });

  it("does not preserve image routing to an unverified vision model during normalize", () => {
    const provider = localProvider();
    const model = localModel({
      id: "unverified-image-model",
      modelId: "vision-model-exact",
      supportsVision: true,
      capabilities: ["analysis", "rewrite", "vision"],
      capabilityVerification: {
        text: "verified",
        image: "unverified",
        structuredOutput: "unverified",
        reasoning: "unverified",
        streaming: "unverified",
      },
    });
    const normalized = normalizeAiConfiguration({
      aiProviders: [provider],
      aiModels: [model],
      aiTaskRouting: {
        ...clone(DEFAULT_AI_TASK_ROUTING),
        imageTextExtraction: {
          ...clone(DEFAULT_AI_TASK_ROUTING.imageTextExtraction!),
          providerId: provider.id,
          modelId: model.id,
          enabled: true,
        },
      },
    });

    expect(normalized.aiTaskRouting.imageTextExtraction?.modelId).not.toBe(model.id);
  });

  it("preserves image routing only after the vision model is verified", () => {
    const provider = localProvider();
    const model = localModel({
      id: "verified-image-model",
      modelId: "vision-model-exact",
      supportsVision: true,
      capabilities: ["analysis", "rewrite", "vision"],
      capabilityVerification: {
        text: "verified",
        image: "verified",
        structuredOutput: "unverified",
        reasoning: "unverified",
        streaming: "unverified",
      },
    });
    const normalized = normalizeAiConfiguration({
      aiProviders: [provider],
      aiModels: [model],
      aiTaskRouting: {
        ...clone(DEFAULT_AI_TASK_ROUTING),
        imageTextExtraction: {
          ...clone(DEFAULT_AI_TASK_ROUTING.imageTextExtraction!),
          providerId: provider.id,
          modelId: model.id,
          enabled: true,
        },
      },
    });

    expect(normalized.aiTaskRouting.imageTextExtraction?.providerId).toBe(provider.id);
    expect(normalized.aiTaskRouting.imageTextExtraction?.modelId).toBe(model.id);
    expect(aiModelCanRouteImageTask(provider, model)).toBe(true);
  });

  it("keeps reasoning controls inactive until a protocol mapping exists", () => {
    expect(aiProviderHasReasoningParameterMapping(localProvider())).toBe(false);
  });

  it("normalizes old schema 5 model data without replacing custom model IDs", () => {
    const model = localModel({
      modelId: "gpt-5.5",
      displayName: "My GPT 5.5",
      supportsVision: undefined,
      capabilityVerification: undefined,
    });
    const normalized = normalizeAiConfiguration({
      aiProviders: [localProvider()],
      aiModels: [model],
      aiTaskRouting: DEFAULT_AI_TASK_ROUTING,
    });
    const savedModel = normalized.aiModels.find((item) => item.id === model.id);

    expect(savedModel?.modelId).toBe("gpt-5.5");
    expect(savedModel?.displayName).toBe("My GPT 5.5");
    expect(savedModel?.capabilityVerification?.text).toBe("unverified");
    expect(savedModel?.capabilityVerification?.image).toBe("unverified");
    expect(modelSupportsCapability(savedModel!, "text")).toBe(true);
  });

  it("sends Gemini native requests to generateContent with x-goog-api-key", async () => {
    const fetchMock = mockJsonFetch({
      candidates: [
        {
          content: {
            parts: [{ text: "Gemini ok" }],
          },
        },
      ],
    });

    await geminiAdapter.chat({
      provider: "gemini",
      model: "gemini-user-model",
      apiKey: "gemini-key",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      messages: [{ role: "user", content: "Extract the visible words." }],
      images: [{ mimeType: "image/png", data: "VkVSTklR" }],
      maxTokens: 80,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    const body = JSON.parse(String(init.body));

    expect(String(url)).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-user-model:generateContent",
    );
    expect(String(url)).not.toContain("key=");
    expect(headers.get("x-goog-api-key")).toBe("gemini-key");
    expect(headers.get("Authorization")).toBeNull();
    expect(body.contents[0].parts[0].text).toContain("Extract the visible words.");
    expect(body.contents[0].parts[1].inlineData).toEqual({
      mimeType: "image/png",
      data: "VkVSTklR",
    });
  });

  it("sends Anthropic Messages requests with x-api-key and version headers", async () => {
    const fetchMock = mockJsonFetch({
      content: [{ text: "Anthropic ok" }],
    });

    await anthropicAdapter.chat({
      provider: "claude",
      model: "claude-user-model",
      apiKey: "anthropic-key",
      baseUrl: "https://api.anthropic.com/v1",
      systemPrompt: "Be concise.",
      messages: [{ role: "user", content: "Ping" }],
      maxTokens: 80,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    const body = JSON.parse(String(init.body));

    expect(String(url)).toBe("https://api.anthropic.com/v1/messages");
    expect(headers.get("x-api-key")).toBe("anthropic-key");
    expect(headers.get("anthropic-version")).toBe("2023-06-01");
    expect(headers.get("Authorization")).toBeNull();
    expect(body.model).toBe("claude-user-model");
    expect(body.messages).toEqual([{ role: "user", content: "Ping" }]);
  });

  it("sends compatible requests through OpenAI Chat Completions", async () => {
    const fetchMock = mockJsonFetch({
      choices: [{ message: { content: "Compatible ok" } }],
    });

    await openAICompatibleAdapter.chat({
      provider: "openai-compatible",
      model: "provider-exact-model",
      apiKey: "relay-key",
      authMode: "bearer",
      baseUrl: "https://api.example.com/v1",
      messages: [{ role: "user", content: "Ping" }],
      maxTokens: 80,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    const body = JSON.parse(String(init.body));

    expect(String(url)).toBe("https://api.example.com/v1/chat/completions");
    expect(headers.get("Authorization")).toBe("Bearer relay-key");
    expect(body.model).toBe("provider-exact-model");
    expect(body.messages).toEqual([{ role: "user", content: "Ping" }]);
  });
});

function mockJsonFetch(payload: unknown) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }),
  );
}
