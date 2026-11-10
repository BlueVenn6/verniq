import { describe, expect, it } from "vitest";
import {
  DEFAULT_AI_ANALYSIS_MODEL_ID,
  DEFAULT_AI_CUSTOM_PROVIDER_ID,
  DEFAULT_AI_LOCAL_PROVIDER_ID,
  DEFAULT_AI_MODELS,
  DEFAULT_AI_PROVIDER_ID,
  DEFAULT_AI_PROVIDERS,
  DEFAULT_AI_TASK_ROUTING,
  createCustomAiModelConfig,
  createCustomAiProviderConfig,
  normalizeAiConfiguration,
} from "@/src/lib/aiConfig";
import {
  buildLanguageAnalysisSystemPrompt,
  buildSourceMaterialPrompt,
} from "@/src/lib/languageAnalysis";
import {
  createContentPipelineItemFromInbox,
  deriveInboxTitle,
  validateInboxDraft,
} from "@/src/lib/inbox";
import { buildProviderTestRequest, resolveTaskRuntimeConfig } from "@/src/lib/llm/config";
import { validateDesktopNetworkUrl } from "@/src/lib/security/url";
import {
  createLearningSegmentsForSourceMaterial,
  createSourceMaterialFromContentPipelineItem,
} from "@/src/lib/sourceIngestion";
import { createInitialSrsState, reviewSrsState } from "@/src/lib/srs";
import {
  createDefaultWorkspaceState,
  mergeWorkspaceState,
  WORKSPACE_SCHEMA_VERSION,
} from "@/src/lib/workspace/core";
import type {
  AiModelConfig,
  AiProviderConfig,
  AiTaskRouting,
  SourceMaterial,
} from "@/src/lib/types";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("workspace schema migration", () => {
  it("normalizes schema 4 workspaces to schema 5 defaults", () => {
    const base = createDefaultWorkspaceState();
    const migrated = mergeWorkspaceState(base, {
      schemaVersion: 4,
      contentPipelineItems: undefined,
      aiProviders: undefined,
      aiModels: undefined,
      aiTaskRouting: undefined,
    } as Partial<typeof base>);

    expect(migrated.schemaVersion).toBe(WORKSPACE_SCHEMA_VERSION);
    expect(migrated.languageSettings.targetLanguage).toBe("en");
    expect(migrated.aiModels.some((model) => model.modelId === "gpt-5.6-terra")).toBe(true);
    expect(Array.isArray(migrated.sourceMaterials)).toBe(true);
  });

  it("does not crash when old workspace data is missing optional arrays", () => {
    const migrated = mergeWorkspaceState(createDefaultWorkspaceState(), {
      schemaVersion: 3,
      sourceMaterials: undefined,
      vocabularyItems: undefined,
      expressionItems: undefined,
    } as Partial<ReturnType<typeof createDefaultWorkspaceState>>);

    expect(migrated.schemaVersion).toBe(WORKSPACE_SCHEMA_VERSION);
    expect(migrated.sourceMaterials).toEqual([]);
    expect(migrated.vocabularyItems).toEqual([]);
    expect(migrated.expressionItems).toEqual([]);
  });
});

describe("AI configuration migration", () => {
  it("preserves user OpenAI-compatible providers as separate custom services", () => {
    const legacyProvider: AiProviderConfig = {
      ...clone(DEFAULT_AI_PROVIDERS[1]),
      id: "legacy-compatible",
      name: "My OpenAI Compatible",
      providerType: "openai_compatible",
      connectionMode: "custom_base_url",
      enabled: true,
      baseUrl: "https://relay.example/v1",
      credentialRef: "credential-ref",
    };
    const legacyModel: AiModelConfig = {
      ...clone(DEFAULT_AI_MODELS[0]),
      id: "legacy-compatible-model",
      providerId: legacyProvider.id,
      modelId: "relay-learning-model",
      modelName: "relay-learning-model",
      displayName: "Relay learning model",
    };
    const legacyRouting: AiTaskRouting = {
      ...clone(DEFAULT_AI_TASK_ROUTING),
      analysis: {
        providerId: legacyProvider.id,
        modelId: legacyModel.id,
      },
    };

    const normalized = normalizeAiConfiguration({
      aiProviders: [legacyProvider],
      aiModels: [legacyModel],
      aiTaskRouting: legacyRouting,
    });

    const customProvider = normalized.aiProviders.find(
      (provider) => provider.id === DEFAULT_AI_CUSTOM_PROVIDER_ID,
    );
    const migratedModel = normalized.aiModels.find((model) => model.id === legacyModel.id);

    const preservedProvider = normalized.aiProviders.find(
      (provider) => provider.id === legacyProvider.id,
    );

    expect(customProvider?.enabled).toBe(false);
    expect(preservedProvider?.enabled).toBe(true);
    expect(preservedProvider?.baseUrl).toBe("https://relay.example/v1");
    expect(preservedProvider?.credentialRef).toBe("credential-ref");
    expect(migratedModel?.providerId).toBe(legacyProvider.id);
    expect(normalized.aiTaskRouting.analysis.providerId).toBe(legacyProvider.id);
    expect(normalized.aiTaskRouting.analysis.modelId).toBe(legacyModel.id);
  });

  it("resets historical built-in models to the current baseline during schema migration", () => {
    const normalized = normalizeAiConfiguration({
      aiProviders: clone(DEFAULT_AI_PROVIDERS),
      aiModels: [
        {
          ...clone(DEFAULT_AI_MODELS[0]),
          id: "legacy-default-model",
          modelId: "gpt-4.1-mini",
          modelName: "gpt-4.1-mini",
          displayName: "GPT-4.1 mini",
        },
      ],
      aiTaskRouting: {
        ...clone(DEFAULT_AI_TASK_ROUTING),
        analysis: {
          providerId: "provider-openai",
          modelId: "legacy-default-model",
        },
      },
      resetLegacyDefaults: true,
    });

    expect(normalized.aiModels.some((model) => model.id === "legacy-default-model")).toBe(false);
    expect(normalized.aiTaskRouting.analysis.modelId).toBe(DEFAULT_AI_ANALYSIS_MODEL_ID);
  });

  it("keeps user-entered model IDs when they are not legacy defaults", () => {
    const manualModel: AiModelConfig = {
      ...clone(DEFAULT_AI_MODELS[0]),
      id: "manual-cheap-model",
      providerId: DEFAULT_AI_CUSTOM_PROVIDER_ID,
      modelId: "provider-specific-cheap-v2",
      modelName: "provider-specific-cheap-v2",
      displayName: "Provider cheap v2",
    };
    const normalized = normalizeAiConfiguration({
      aiProviders: clone(DEFAULT_AI_PROVIDERS),
      aiModels: [manualModel],
      aiTaskRouting: {
        ...clone(DEFAULT_AI_TASK_ROUTING),
        analysis: {
          providerId: DEFAULT_AI_CUSTOM_PROVIDER_ID,
          modelId: manualModel.id,
        },
      },
      resetLegacyDefaults: true,
    });

    const preserved = normalized.aiModels.find((model) => model.id === manualModel.id);

    expect(preserved?.modelId).toBe("provider-specific-cheap-v2");
    expect(normalized.aiTaskRouting.analysis.modelId).toBe(manualModel.id);
  });

  it("keeps display names separate from provider model IDs during normalization", () => {
    const manualModel: AiModelConfig = {
      ...clone(DEFAULT_AI_MODELS[0]),
      id: "manual-display-model",
      providerId: DEFAULT_AI_CUSTOM_PROVIDER_ID,
      displayName: "GPT-4o Mini",
      modelId: "provider-real-model-id",
      modelName: "old-friendly-name",
    };

    const normalized = normalizeAiConfiguration({
      aiProviders: clone(DEFAULT_AI_PROVIDERS),
      aiModels: [manualModel],
      aiTaskRouting: {
        ...clone(DEFAULT_AI_TASK_ROUTING),
        analysis: {
          providerId: DEFAULT_AI_CUSTOM_PROVIDER_ID,
          modelId: manualModel.id,
        },
      },
    });
    const preserved = normalized.aiModels.find((model) => model.id === manualModel.id);

    expect(preserved?.displayName).toBe("GPT-4o Mini");
    expect(preserved?.modelId).toBe("provider-real-model-id");
    expect(preserved?.modelName).toBe("old-friendly-name");
  });

  it("keeps temporarily blank model IDs editable instead of restoring defaults", () => {
    const editableModel: AiModelConfig = {
      ...clone(DEFAULT_AI_MODELS[3]),
      id: "editable-model",
      providerId: DEFAULT_AI_CUSTOM_PROVIDER_ID,
      displayName: "",
      modelName: "",
      modelId: "",
    };
    const normalized = normalizeAiConfiguration({
      aiProviders: clone(DEFAULT_AI_PROVIDERS),
      aiModels: [editableModel],
      aiTaskRouting: clone(DEFAULT_AI_TASK_ROUTING),
    });
    const preserved = normalized.aiModels.find((model) => model.id === editableModel.id);

    expect(preserved?.modelId).toBe("");
    expect(preserved?.modelName).toBe("");
    expect(preserved?.displayName).toBe("");
  });

  it("creates editable custom services and models without hardcoded provider names", () => {
    const provider = createCustomAiProviderConfig({
      presetId: "kimi",
      id: "provider-my-kimi",
      name: "My Kimi Relay",
      baseUrl: "https://kimi.example.com/v1",
    });
    const model = createCustomAiModelConfig(provider, {
      id: "model-kimi-custom",
      displayName: "Kimi writing",
      modelId: "kimi-user-model-exact",
      supportsVision: true,
      capabilities: ["analysis", "rewrite", "vision"],
    });
    const normalized = normalizeAiConfiguration({
      aiProviders: [...clone(DEFAULT_AI_PROVIDERS), provider],
      aiModels: [model],
      aiTaskRouting: {
        ...clone(DEFAULT_AI_TASK_ROUTING),
        analysis: {
          providerId: provider.id,
          modelId: model.id,
        },
      },
    });
    const preservedProvider = normalized.aiProviders.find((item) => item.id === provider.id);
    const preservedModel = normalized.aiModels.find((item) => item.id === model.id);

    expect(preservedProvider?.displayName).toBe("My Kimi Relay");
    expect(preservedProvider?.baseUrl).toBe("https://kimi.example.com/v1");
    expect(preservedModel?.providerId).toBe(provider.id);
    expect(preservedModel?.modelId).toBe("kimi-user-model-exact");
    expect(preservedModel?.supportsVision).toBe(true);
    expect(normalized.aiTaskRouting.analysis.providerId).toBe(provider.id);
  });
});

describe("AI prompt and route selection", () => {
  it("puts Chinese and English explanation languages into the language analysis prompt", () => {
    const sourceMaterial = {
      id: "source-1",
      title: "A short article",
      language: "en",
      cleanedContent: "Learning with real articles makes vocabulary stick.",
      originalContent: "Learning with real articles makes vocabulary stick.",
    } as SourceMaterial;

    const systemPrompt = buildLanguageAnalysisSystemPrompt();
    const zhPrompt = buildSourceMaterialPrompt(
      {
        sourceMaterial,
        targetLanguage: "en",
        nativeLanguage: "zh-CN",
        aiProviders: [],
        aiModels: [],
        aiTaskRouting: clone(DEFAULT_AI_TASK_ROUTING),
      },
      sourceMaterial.cleanedContent,
    );
    const enPrompt = buildSourceMaterialPrompt(
      {
        sourceMaterial,
        targetLanguage: "en",
        nativeLanguage: "en",
        aiProviders: [],
        aiModels: [],
        aiTaskRouting: clone(DEFAULT_AI_TASK_ROUTING),
      },
      sourceMaterial.cleanedContent,
    );

    expect(systemPrompt).toContain("selected explanation language");
    expect(zhPrompt).toContain("Native language: zh-CN");
    expect(enPrompt).toContain("Native language: en");
  });

  it("builds runtime requests from the selected provider route", async () => {
    const aiProviders = clone(DEFAULT_AI_PROVIDERS).map((provider) =>
      provider.id === DEFAULT_AI_LOCAL_PROVIDER_ID
        ? { ...provider, enabled: true }
        : provider,
    );
    const aiModels = clone(DEFAULT_AI_MODELS);
    const aiTaskRouting: AiTaskRouting = {
      ...clone(DEFAULT_AI_TASK_ROUTING),
      analysis: {
        providerId: DEFAULT_AI_LOCAL_PROVIDER_ID,
        modelId: "model-lm-studio-default",
      },
    };

    const runtime = await resolveTaskRuntimeConfig({
      task: "analysis",
      capability: "analysis",
      aiProviders,
      aiModels,
      aiTaskRouting,
    });

    expect(runtime.ok).toBe(true);
    if (!runtime.ok) return;
    expect(runtime.provider.id).toBe(DEFAULT_AI_LOCAL_PROVIDER_ID);
    expect(runtime.request.provider).toBe("local");
    expect(runtime.request.baseUrl).toBe("http://localhost:1234/v1");
    expect(runtime.request.model).toBe("local-model");
    expect(runtime.request.apiKey).toBeUndefined();
  });

  it("uses OpenAI native provider settings and sends AiModelConfig.modelId", async () => {
    const provider: AiProviderConfig = {
      ...clone(DEFAULT_AI_PROVIDERS[0]),
      enabled: true,
      apiKeyRef: "sk-test-native",
      baseUrl: "https://stale.example/v1",
    };
    const model: AiModelConfig = {
      ...clone(DEFAULT_AI_MODELS[0]),
      id: "native-real-model",
      providerId: DEFAULT_AI_PROVIDER_ID,
      displayName: "GPT-4o Mini",
      modelName: "friendly-name-that-must-not-be-sent",
      modelId: "gpt-4o-mini",
    };
    const aiTaskRouting: AiTaskRouting = {
      ...clone(DEFAULT_AI_TASK_ROUTING),
      analysis: {
        providerId: DEFAULT_AI_PROVIDER_ID,
        modelId: model.id,
      },
    };

    const runtime = await resolveTaskRuntimeConfig({
      task: "analysis",
      capability: "analysis",
      aiProviders: [provider],
      aiModels: [model],
      aiTaskRouting,
    });

    expect(runtime.ok).toBe(true);
    if (!runtime.ok) return;
    expect(runtime.request.provider).toBe("openai");
    expect(runtime.request.baseUrl).toBe("https://api.openai.com/v1");
    expect(runtime.request.apiKey).toBe("sk-test-native");
    expect(runtime.request.model).toBe("gpt-4o-mini");
  });

  it("uses OpenAI-compatible Base URL, API key, and model ID together", async () => {
    const provider: AiProviderConfig = {
      ...clone(DEFAULT_AI_PROVIDERS[1]),
      enabled: true,
      baseUrl: "https://api.example.com/v1",
      apiKeyRef: "relay-secret",
    };
    const model: AiModelConfig = {
      ...clone(DEFAULT_AI_MODELS[3]),
      id: "relay-model",
      providerId: DEFAULT_AI_CUSTOM_PROVIDER_ID,
      displayName: "Relay Display Name",
      modelName: "display-name-must-not-be-used",
      modelId: "relay-model-2026",
      enabled: true,
    };
    const aiTaskRouting: AiTaskRouting = {
      ...clone(DEFAULT_AI_TASK_ROUTING),
      analysis: {
        providerId: DEFAULT_AI_CUSTOM_PROVIDER_ID,
        modelId: model.id,
      },
    };

    const runtime = await resolveTaskRuntimeConfig({
      task: "analysis",
      capability: "analysis",
      aiProviders: [provider],
      aiModels: [model],
      aiTaskRouting,
    });

    expect(runtime.ok).toBe(true);
    if (!runtime.ok) return;
    expect(runtime.request.provider).toBe("openai-compatible");
    expect(runtime.request.baseUrl).toBe("https://api.example.com/v1");
    expect(runtime.request.apiKey).toBe("relay-secret");
    expect(runtime.request.model).toBe("relay-model-2026");
  });

  it("validates a selected model and rejects blank model IDs", async () => {
    const provider: AiProviderConfig = {
      ...clone(DEFAULT_AI_PROVIDERS[2]),
      enabled: true,
      authMode: "none",
      baseUrl: "http://localhost:1234/v1",
    };
    const blankModel: AiModelConfig = {
      ...clone(DEFAULT_AI_MODELS[2]),
      id: "blank-local-model",
      providerId: DEFAULT_AI_LOCAL_PROVIDER_ID,
      displayName: "Local model without ID",
      modelName: "friendly-local-name",
      modelId: "   ",
    };

    const runtime = await buildProviderTestRequest(provider, [blankModel], blankModel.id);

    expect(runtime.ok).toBe(false);
    if (runtime.ok) return;
    expect(runtime.error).toContain("模型 ID");
  });
});

describe("review scheduling", () => {
  it("updates FSRS state after a review rating", () => {
    const createdAt = "2026-07-26T10:00:00.000Z";
    const reviewedAt = new Date("2026-07-26T12:00:00.000Z");
    const initial = createInitialSrsState(createdAt, new Date(createdAt));
    const reviewed = reviewSrsState({
      srs: initial,
      createdAt,
      rating: "good",
      reviewedAt,
    });

    expect(reviewed.reps).toBe(1);
    expect(reviewed.lastReviewedAt).toBe(reviewedAt.toISOString());
    expect(reviewed.reviewHistory).toHaveLength(1);
    expect(new Date(reviewed.dueAt).getTime()).toBeGreaterThan(reviewedAt.getTime());
  });
});

describe("inbox to reader import flow", () => {
  it("derives a title from selected files and does not require category chips", () => {
    const workspace = createDefaultWorkspaceState();
    const draft = {
      title: "",
      sourceTypeId: workspace.sourceTypeConfigs[0].id,
      inputMethod: "file_upload" as const,
      sourceReference: "Statement by a supplier.pdf",
      sourceFileName: "Statement by a supplier.pdf",
      sourceFileExt: "pdf",
      sourceMimeType: "application/pdf",
      sourceAssetType: "pdf" as const,
      originalLanguage: "en" as const,
      summary: "",
      rawContent: "",
      moduleId: "english-blog",
      categoryIds: [],
      productIds: [],
      targetAudience: "",
      preferredPlatformIds: [],
      productMode: "auto" as const,
      platformMode: "auto" as const,
      rewriteDepth: "medium" as const,
    };

    expect(validateInboxDraft(draft).valid).toBe(true);
    expect(deriveInboxTitle(draft)).toBe("Statement by a supplier");
    expect(createContentPipelineItemFromInbox(draft, workspace).title).toBe(
      "Statement by a supplier",
    );
  });

  it("creates reader segments from pasted English text", () => {
    const workspace = createDefaultWorkspaceState();
    const draft = {
      title: "",
      sourceTypeId: workspace.sourceTypeConfigs[0].id,
      inputMethod: "direct_paste" as const,
      sourceReference: "",
      originalLanguage: "en" as const,
      summary: "",
      rawContent: "This is the first paragraph.\n\nThis is the second paragraph.",
      moduleId: "english-blog",
      categoryIds: [],
      productIds: [],
      targetAudience: "",
      preferredPlatformIds: [],
      productMode: "auto" as const,
      platformMode: "auto" as const,
      rewriteDepth: "medium" as const,
    };
    const item = createContentPipelineItemFromInbox(draft, workspace);
    const ingestion = createSourceMaterialFromContentPipelineItem(item, {
      language: item.originalLanguage,
    });

    expect(ingestion.sourceMaterial.language).toBe("en");
    expect(createLearningSegmentsForSourceMaterial(ingestion.sourceMaterial)).toHaveLength(2);
  });
});

describe("desktop network URL rules", () => {
  it("allows HTTPS and local HTTP but rejects non-local cleartext HTTP", () => {
    expect(validateDesktopNetworkUrl("https://api.openai.com/v1", "AI 接口地址").ok).toBe(true);
    expect(validateDesktopNetworkUrl("http://localhost:1234/v1", "AI 接口地址").ok).toBe(true);
    expect(validateDesktopNetworkUrl("http://192.168.1.50:1234/v1", "AI 接口地址").ok).toBe(false);
  });
});
