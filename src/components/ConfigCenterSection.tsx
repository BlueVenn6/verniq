"use client";


import { useLearningUi } from "@/src/components/LanguageProvider";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useEffect, useState } from "react";
import {
  CUSTOM_AI_SERVICE_PRESETS,
  DEFAULT_AI_MODELS,
  DEFAULT_AI_PROVIDER_ID,
  DEFAULT_AI_TASK_ROUTING,
  SUPPORTED_AI_PROVIDER_IDS,
  aiModelCanRouteImageTask,
  aiModelDeclaresImageInput,
  aiProviderHasReasoningParameterMapping,
  aiProviderSupportsImageInput,
  createCustomAiModelConfig,
  createCustomAiProviderConfig,
  getAiProviderPresetLabel,
  getAiProviderProtocolLabel,
  getAiProviderSetupStatus,
  getAiProviderSetupStatusLabel,
  maskApiKey,
  isAiServiceInstance,
} from "@/src/lib/aiConfig";
import { zhCNCopy } from "@/src/lib/copy/zhCN";
import {
  getLanguageDisplayName,
  normalizeSupportedLanguageSettings,
  SUPPORTED_EXPLANATION_LANGUAGE_OPTIONS,
  SUPPORTED_TARGET_LANGUAGE_OPTIONS,
  SUPPORTED_UI_LANGUAGE_OPTIONS,
} from "@/src/lib/languageSettings";
import { testAiProviderConnection } from "@/src/lib/llm/providerTest";
import { getTextModelPresets } from "@/src/lib/aiModelPresets";
import { ModelCatalog } from "@/src/components/ModelCatalog";
import { AiConfigurationHelp } from "@/src/components/AiConfigurationHelp";
import { FullTextSelect } from "@/src/components/FullTextSelect";
import { applyImageInputVerification } from "@/src/lib/imageInputSetup";
import { buildOpenAiCompatibleEndpoint } from "@/src/lib/llm/providers/openaiCompatible";
import { buildGeminiGenerateContentEndpoint } from "@/src/lib/llm/providers/gemini";
import {
  DRAGTOKEN_IMAGES_BASE_URL,
  DRAGTOKEN_IMAGES_MODEL_ID,
  OPENAI_IMAGES_NATIVE_BASE_URL,
  buildOpenAiImagesEndpoint,
  generateOpenAiImage,
} from "@/src/lib/llm/imageGeneration";
import {
  createCredentialRef,
  createSecretStore,
  readCredentialSecret,
  type SecretStoreStatus,
} from "@/src/lib/secrets/secretStore";
import {
  OUTPUT_FORMAT_LABELS,
  PUBLISH_MODE_LABELS,
  REWRITE_DEPTH_LABELS,
} from "@/src/lib/routing";
import type {
  AiConnectionTestResult,
  AiContentPreferences,
  AiModelCapability,
  AiModelConfig,
  AiProviderConfig,
  AiPrivacySettings,
  AiTaskRouting,
  AutomationConnectionConfig,
  CategoryConfig,
  LanguageSettings,
  OutputFormat,
  PlatformConfig,
  ProductConfig,
  RoutingRule,
  SourceTypeConfig,
} from "@/src/lib/types";

type ConfigCenterSectionProps = {
  aiProviders: AiProviderConfig[];
  aiModels: AiModelConfig[];
  aiTaskRouting: AiTaskRouting;
  aiContentPreferences: AiContentPreferences;
  aiPrivacySettings: AiPrivacySettings;
  automationConnections: AutomationConnectionConfig[];
  sourceTypeConfigs: SourceTypeConfig[];
  categoryConfigs: CategoryConfig[];
  platformConfigs: PlatformConfig[];
  productConfigs: ProductConfig[];
  routingRules: RoutingRule[];
  languageSettings: LanguageSettings;
  onAiProvidersChange: (value: AiProviderConfig[]) => void;
  onAiModelsChange: (value: AiModelConfig[]) => void;
  onAiTaskRoutingChange: (value: AiTaskRouting) => void;
  onAiContentPreferencesChange: (value: AiContentPreferences) => void;
  onAiPrivacySettingsChange: (value: AiPrivacySettings) => void;
  onAutomationConnectionsChange: (value: AutomationConnectionConfig[]) => void;
  onSourceTypeChange: (value: SourceTypeConfig) => void;
  onCategoryChange: (value: CategoryConfig) => void;
  onCategoryAdd: (value: CategoryConfig) => void;
  onPlatformChange: (value: PlatformConfig) => void;
  onPlatformAdd: (value: PlatformConfig) => void;
  onProductChange: (value: ProductConfig) => void;
  onProductAdd: (value: ProductConfig) => void;
  onRuleChange: (value: RoutingRule) => void;
  onRuleAdd: (value: RoutingRule) => void;
  onLanguageSettingsChange: (value: LanguageSettings) => void;
};

const PLATFORM_TYPE_OPTIONS: PlatformConfig["platformType"][] = [
  "blog",
  "newsletter",
  "social",
  "video",
  "developer",
  "custom",
];

const PLATFORM_TYPE_LABELS: Record<PlatformConfig["platformType"], string> = {
  blog: "博客",
  newsletter: "newsletter",
  social: "社交",
  video: "视频",
  developer: "开发者",
  custom: "自定义",
};

const AI_TECHNICAL_CAPABILITY_OPTIONS: { value: AiModelCapability; label: string }[] = [
  { value: "text", label: "文本" },
  { value: "vision", label: "图片" },
  { value: "structured_output", label: "结构化" },
  { value: "reasoning", label: "推理" },
  { value: "streaming", label: "流式" },
];

const AI_TASK_CAPABILITY_OPTIONS: { value: AiModelCapability; label: string }[] = [
  { value: "analysis", label: "分析" },
  { value: "rewrite", label: "反馈与整理" },
  { value: "publish_package", label: "发布内容整理" },
  { value: "video_script", label: "视频脚本" },
];

type NewModelDraft = {
  providerId: string;
  displayName: string;
  modelId: string;
  technicalCapabilities: AiModelCapability[];
  taskCapabilities: AiModelCapability[];
  enabled: boolean;
  setAsDefault: boolean;
  error: string;
};

type NewProviderDraft = {
  presetId: (typeof CUSTOM_AI_SERVICE_PRESETS)[number]["id"];
  purpose: "general" | "image";
  name: string;
  baseUrl: string;
  adapterProtocol: AiProviderConfig["adapterProtocol"];
  providerType: AiProviderConfig["providerType"];
  providerFamily: AiProviderConfig["providerFamily"];
  connectionMode: AiProviderConfig["connectionMode"];
  endpointMode: AiProviderConfig["endpointMode"];
  customEndpointPath: string;
  authMode: AiProviderConfig["authMode"];
  authHeaderName: string;
  apiKeyRequired: boolean;
  apiKeyDraft: string;
  extraHeaderName: string;
  extraHeaderValue: string;
  timeoutMs: number;
  initialModelDisplayName: string;
  initialModelId: string;
  setAsDefault: boolean;
  error: string;
};

type ImageApiProviderKind = "openai-native" | "dragtoken-relay";

type ImageApiDraft = {
  providerName: string;
  baseUrl: string;
  modelDisplayName: string;
  modelId: string;
  apiKeyDraft: string;
  error: string;
};

const IMAGE_API_PROVIDER_CONFIG: Record<
  ImageApiProviderKind,
  {
    title: string;
    description: string;
    presetId: (typeof CUSTOM_AI_SERVICE_PRESETS)[number]["id"];
    defaultProviderName: string;
    defaultBaseUrl: string;
    defaultModelDisplayName: string;
    defaultModelId: string;
  }
> = {
  "openai-native": {
    title: "OpenAI 原生图片 API",
    description: "使用 OpenAI Images API。只填写 OpenAI API 密钥和图片模型 ID。",
    presetId: "openai-images-native",
    defaultProviderName: "OpenAI 原生图片",
    defaultBaseUrl: OPENAI_IMAGES_NATIVE_BASE_URL,
    defaultModelDisplayName: "OpenAI 图片模型",
    defaultModelId: "",
  },
  "dragtoken-relay": {
    title: "DragToken 图片中转",
    description:
      "按 DragToken 文档默认走海外画图路线。只填写中转 API 密钥，必要时修改 Base URL 和模型 ID。",
    presetId: "dragtoken-images",
    defaultProviderName: "DragToken 图片中转",
    defaultBaseUrl: DRAGTOKEN_IMAGES_BASE_URL,
    defaultModelDisplayName: "DragToken gpt-image-2",
    defaultModelId: DRAGTOKEN_IMAGES_MODEL_ID,
  },
};

const OUTPUT_FORMAT_OPTIONS = Object.entries(OUTPUT_FORMAT_LABELS).map(([value, label]) => ({
  value: value as OutputFormat,
  label,
}));

const AUTOMATION_TYPE_LABELS: Record<
  AutomationConnectionConfig["connectionType"],
  string
> = {
  n8n_webhook: "n8n Webhook",
  make_webhook: "Make Webhook",
  wordpress_draft: "WordPress draft",
  devto_draft: "Dev.to draft",
  manual_checklist: "手动清单",
};

const MODULE_OPTIONS = [
  { value: "english-blog", label: "长文阅读" },
  { value: "newsletter", label: "邮件 / Newsletter" },
  { value: "thread", label: "短文 / 帖子" },
  { value: "product-asset", label: "工作材料" },
];

const PRIMARY_TASK_ROUTE_ROWS = [
  { key: "languageAnalysis", label: zhCNCopy.settings.modelForLanguageAnalysis, fallback: "analysis", capability: "analysis" },
  { key: "phraseAnalysis", label: "短语分析", fallback: "languageAnalysis", capability: "analysis" },
  { key: "sentenceGrammarAnalysis", label: "句子语法分析", fallback: "languageAnalysis", capability: "analysis" },
  { key: "segmentAnalysis", label: "词句解释", fallback: "analysis", capability: "analysis" },
  { key: "feynmanFeedback", label: zhCNCopy.settings.modelForFeynman, fallback: "analysis", capability: "analysis" },
  { key: "imageTextExtraction", label: "图片文字提取", fallback: "analysis", capability: "vision" },
  { key: "imageGeneration", label: "图片生成", fallback: "analysis", capability: "image" },
  { key: "imageEditing", label: "图片编辑", fallback: "imageGeneration", capability: "image" },
  { key: "publishPackage", label: "发布内容整理", fallback: "rewrite", capability: "publish_package" },
] as const satisfies ReadonlyArray<{
  key: keyof AiTaskRouting;
  label: string;
  fallback: keyof AiTaskRouting;
  capability: AiModelCapability;
}>;

export function ConfigCenterSection({
  aiProviders,
  aiModels,
  aiTaskRouting,
  aiContentPreferences,
  aiPrivacySettings,
  automationConnections,
  sourceTypeConfigs,
  categoryConfigs,
  platformConfigs,
  productConfigs,
  routingRules,
  onAiProvidersChange,
  onAiModelsChange,
  onAiTaskRoutingChange,
  onAiContentPreferencesChange,
  onAiPrivacySettingsChange,
  onAutomationConnectionsChange,
  onSourceTypeChange,
  onCategoryChange,
  onCategoryAdd,
  onPlatformChange,
  onPlatformAdd,
  onProductChange,
  onProductAdd,
  onRuleChange,
  onRuleAdd,
  languageSettings,
  onLanguageSettingsChange,
}: ConfigCenterSectionProps) {
  const { t } = useLearningUi();
  const [openSection, setOpenSection] = useState<ConfigSectionKey | null>("settings");
  const [selectedProviderId, setSelectedProviderId] = useState<string>(DEFAULT_AI_PROVIDER_ID);
  const [connectionTests, setConnectionTests] = useState<Record<string, AiConnectionTestResult>>(
    {},
  );
  const [imageProviderRequest, setImageProviderRequest] = useState(0);
  const [textProviderRequest, setTextProviderRequest] = useState(0);
  const [testingProviderId, setTestingProviderId] = useState("");
  const [apiKeyDrafts, setApiKeyDrafts] = useState<Record<string, string>>({});
  const [credentialMessages, setCredentialMessages] = useState<Record<string, string>>({});
  const [secretStoreStatus, setSecretStoreStatus] = useState<SecretStoreStatus | null>(null);
  const aiUseMode = getAiUseMode(aiPrivacySettings);
  const supportedLanguageSettings = normalizeSupportedLanguageSettings(languageSettings);
  const languageSummary = `${t("界面语言")} · ${t(getLanguageDisplayName(supportedLanguageSettings.uiLanguage))} / ${t("学习语言")} · ${t(getLanguageDisplayName(supportedLanguageSettings.targetLanguage))} / ${t("解释语言")} · ${t(getLanguageDisplayName(supportedLanguageSettings.explanationLanguage))}`;
  const simpleAiProviders = aiProviders
    .filter(isSupportedAiProvider)
    .filter((provider) => isAiServiceInstance(provider, aiModels));
  const simpleAiProviderIds = new Set(simpleAiProviders.map((provider) => provider.id));
  const selectedProvider =
    simpleAiProviders.find((provider) => provider.id === selectedProviderId) ??
    simpleAiProviders[0];
  const visibleAiModels = aiModels.filter((model) => simpleAiProviderIds.has(model.providerId));
  const enabledSimpleAiProviders = simpleAiProviders.filter((provider) => provider.enabled);
  const verifiedSimpleAiProviders = simpleAiProviders.filter(
    (provider) => getAiProviderSetupStatus(provider, aiModels) === "verified",
  );
  const showLegacyConfiguration = process.env.NEXT_PUBLIC_SHOW_LEGACY_CONFIG === "1";

  const sourceTypeOptions = sourceTypeConfigs.map((item) => ({
    value: item.id,
    label: item.name,
  }));
  const categoryOptions = categoryConfigs.map((item) => ({
    value: item.id,
    label: item.name,
  }));
  const platformOptions = platformConfigs.map((item) => ({
    value: item.id,
    label: item.name,
  }));
  const productOptions = productConfigs.map((item) => ({
    value: item.id,
    label: item.name,
  }));
  return (
    <section className="rounded-[1.75rem] border border-stone-200 bg-white p-6 shadow-sm shadow-stone-200/60 sm:p-8">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold text-stone-500">{t("设置")}</p>
        <h2 className="mt-2 text-3xl font-semibold text-stone-950">
          {t("按需调整语言与 AI 设置")}</h2>
        <p className="mt-4 text-base leading-8 text-stone-600">
          {t("语言、AI 与内容整理设置集中管理，高级选项可按需展开。")}</p>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <OverviewCard
          title={t("语言设置")}
          value={`${t("学习语言")} · ${t(getLanguageDisplayName(supportedLanguageSettings.targetLanguage))}`}
          detail={`${t("解释语言")} · ${t(getLanguageDisplayName(supportedLanguageSettings.explanationLanguage))}`}
          onClick={() => setOpenSection("settings")}
          prominent
        />
        <OverviewCard
          title={t("AI 服务")}
          value={`${t("已验证服务")} · ${verifiedSimpleAiProviders.length}`}
          detail={`${t("已启用模型")} · ${visibleAiModels.filter((item) => item.enabled).length}`}
          onClick={() => setOpenSection("ai")}
        />
      </div>

      <div className="mt-8 space-y-5">
        <ConfigBlock
          title={t("语言设置")}
          description={t("仅显示当前已支持的语言选项。")}
          summary={languageSummary}
          isOpen={openSection === "settings"}
          onToggle={() => setOpenSection(openSection === "settings" ? null : "settings")}
        >
          <ConfigCard>
            <p className="text-sm font-semibold text-stone-950">{t("当前语言选项")}</p>
            <p className="mt-2 text-xs leading-6 text-stone-500">
              {t("支持中文解释学英语，也支持英文解释学中文。切换不会改写已有材料的语言。")}</p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <SelectField
                label={t("界面语言")}
                value={supportedLanguageSettings.uiLanguage}
                options={SUPPORTED_UI_LANGUAGE_OPTIONS}
                onChange={(value) =>
                  onLanguageSettingsChange({
                    ...supportedLanguageSettings,
                    uiLanguage: value,
                  })
                }
              />
              <SelectField
                label={t("学习语言")}
                value={supportedLanguageSettings.targetLanguage}
                options={SUPPORTED_TARGET_LANGUAGE_OPTIONS}
                onChange={(value) =>
                  onLanguageSettingsChange({
                    ...supportedLanguageSettings,
                    targetLanguage: value,
                  })
                }
              />
              <SelectField
                label={t("解释语言")}
                value={supportedLanguageSettings.explanationLanguage}
                options={SUPPORTED_EXPLANATION_LANGUAGE_OPTIONS}
                onChange={(value) =>
                  onLanguageSettingsChange({
                    ...supportedLanguageSettings,
                    explanationLanguage: value,
                  })
                }
              />
            </div>
          </ConfigCard>
        </ConfigBlock>

        <ConfigBlock
          title={zhCNCopy.settings.aiTitle}
          description={zhCNCopy.settings.aiDescription}
          summary={
            enabledSimpleAiProviders.length
              ? `${t("已启用")} ${enabledSimpleAiProviders.length} ${t("个 AI 服务")} · ${verifiedSimpleAiProviders.length} ${t("个可用")}`
              : t(getAiUseModeLabel(aiUseMode))
          }
          isOpen={openSection === "ai"}
          onToggle={() => setOpenSection(openSection === "ai" ? null : "ai")}
        >
          <div className="space-y-5">
            <ConfigCard>
              <p className="text-sm font-semibold text-stone-950">{t("AI 使用模式")}</p>
              <p className="mt-2 text-xs leading-6 text-stone-500">
                {t("常用设置用于启用 AI、选择 AI 服务、保存密钥和选择核心模型。发送材料前仍会显示发送范围。")}</p>
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                <AiModeButton
                  active={aiUseMode === "off"}
                  title={zhCNCopy.settings.aiNoAi}
                  description={zhCNCopy.settings.aiNoAiDescription}
                  onClick={() => {
                    onAiPrivacySettingsChange({
                      ...aiPrivacySettings,
                      allowRemoteAi: false,
                      onlyUseLocalModels: false,
                    });
                  }}
                />
                <AiModeButton
                  active={aiUseMode === "remote"}
                  title={zhCNCopy.settings.aiRemote}
                  description={zhCNCopy.settings.aiRemoteDescription}
                  onClick={() =>
                    onAiPrivacySettingsChange({
                      ...aiPrivacySettings,
                      allowRemoteAi: true,
                      onlyUseLocalModels: false,
                    })
                  }
                />
                <AiModeButton
                  active={aiUseMode === "local"}
                  title={zhCNCopy.settings.aiLocal}
                  description={zhCNCopy.settings.aiLocalDescription}
                  onClick={() =>
                    onAiPrivacySettingsChange({
                      ...aiPrivacySettings,
                      allowRemoteAi: false,
                      onlyUseLocalModels: true,
                    })
                  }
                />
              </div>
            </ConfigCard>

            <AiConnectionSettings
              aiProviders={aiProviders}
              aiModels={aiModels}
              aiTaskRouting={aiTaskRouting}
              aiPrivacySettings={aiPrivacySettings}
              simpleAiProviders={simpleAiProviders}
              selectedProvider={selectedProvider}
              selectedProviderId={selectedProviderId}
              connectionTests={connectionTests}
              testingProviderId={testingProviderId}
              apiKeyDrafts={apiKeyDrafts}
              credentialMessages={credentialMessages}
              secretStoreStatus={secretStoreStatus}
              onSelectedProviderChange={setSelectedProviderId}
              onAiProvidersChange={onAiProvidersChange}
              onAiModelsChange={onAiModelsChange}
              onAiTaskRoutingChange={onAiTaskRoutingChange}
              onAiPrivacySettingsChange={onAiPrivacySettingsChange}
              setTestingProviderId={setTestingProviderId}
              setConnectionTests={setConnectionTests}
              setApiKeyDrafts={setApiKeyDrafts}
              setCredentialMessages={setCredentialMessages}
              setSecretStoreStatus={setSecretStoreStatus}
              imageProviderRequest={imageProviderRequest}
              textProviderRequest={textProviderRequest}
            />

            <ConfigCard>
              <details>
              <summary className="cursor-pointer text-sm font-semibold text-stone-950">{t("任务路由（高级）")}</summary>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="mt-2 text-xs leading-6 text-stone-500">
                    {t("当前只显示已开放的学习主流程。可为不同任务设置默认 AI 服务和模型。")}</p>
                </div>
                <button type="button" onClick={() => setTextProviderRequest((value) => value + 1)}
                  className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700">
                  {t("添加文字服务 / 自定义模型")}</button>
                <button
                  type="button"
                  onClick={() => setImageProviderRequest((value) => value + 1)}
                  className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700"
                >
                  {t("配置图片中转服务")}</button>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {PRIMARY_TASK_ROUTE_ROWS.map((row) => {
                  const isOptionalImageRoute =
                    row.key === "imageTextExtraction" ||
                    row.key === "imageGeneration" ||
                    row.key === "imageEditing";
                  const route =
                    isOptionalImageRoute
                      ? aiTaskRouting.imageTextExtraction
                      : aiTaskRouting[row.key] ??
                        aiTaskRouting[row.fallback] ??
                        aiTaskRouting.analysis;
                  const actualRoute =
                    row.key === "imageTextExtraction"
                      ? aiTaskRouting.imageTextExtraction
                      : row.key === "imageGeneration"
                        ? aiTaskRouting.imageGeneration
                        : row.key === "imageEditing"
                          ? aiTaskRouting.imageEditing
                      : aiTaskRouting[row.key] ??
                        aiTaskRouting[row.fallback] ??
                        aiTaskRouting.analysis;
                  const currentModel = actualRoute
                    ? aiModels.find((item) => item.id === actualRoute.modelId)
                    : undefined;
                  const currentProvider = actualRoute
                    ? simpleAiProviders.find((item) => item.id === actualRoute.providerId)
                    : undefined;
                  const fallbackLabel =
                    row.key === "imageTextExtraction"
                      ? t("暂无已验证图片模型")
                      : row.key === "imageGeneration" || row.key === "imageEditing"
                        ? t("暂无图片生成模型")
                      : currentProvider?.enabled && currentModel?.modelId.trim() ? currentModel.displayName : t("请先添加文字服务与模型");
                  const options = buildTaskRouteOptions(
                    row.capability,
                    visibleAiModels,
                    simpleAiProviders,
                  );
                  const routeOptions =
                    isOptionalImageRoute
                      ? [
                          { value: "", label: fallbackLabel },
                          ...options,
                        ]
                      : options.length
                        ? options
                        : [
                            {
                              value: serializeAiRoute(route ?? aiTaskRouting.analysis),
                              label: fallbackLabel,
                            },
                          ];

                  return (
                    <div key={row.key} className="space-y-2">
                      <SelectField
                        label={row.label}
                        value={actualRoute ? serializeAiRoute(actualRoute) : ""}
                        options={routeOptions}
                        onChange={(value) => {
                          if (isOptionalImageRoute && !value) {
                            const nextRouting = { ...aiTaskRouting };
                            delete nextRouting[row.key];
                            onAiTaskRoutingChange(nextRouting);
                            return;
                          }

                          onAiTaskRoutingChange({
                            ...aiTaskRouting,
                            [row.key]: {
                              ...(actualRoute ?? DEFAULT_AI_TASK_ROUTING[row.key] ?? aiTaskRouting.analysis),
                              ...parseAiRouteValue(value),
                            },
                          });
                        }}
                      />
                      {row.key === "imageTextExtraction" ? (
                        currentProvider && currentModel && aiModelCanRouteImageTask(currentProvider, currentModel) ? (
                          <p className="text-xs leading-6 text-emerald-700">
                            {t("服务：")}{currentProvider.name} {t("· 协议：")}{getAiProviderProtocolLabel(currentProvider)} {t("· 模型 ID：")}{currentModel.modelId} {t("· 图片能力：已验证")}</p>
                        ) : (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <p className="text-xs leading-6 text-amber-700">
                              {t("尚未配置并验证可用于图片文字提取的模型。")}</p>
                            <button
                              type="button"
                              onClick={() => setImageProviderRequest((value) => value + 1)}
                              className="text-xs font-semibold text-stone-700 underline underline-offset-4"
                            >
                              {t("配置图片中转服务")}</button>
                          </div>
                        )
                      ) : null}
                      {row.key === "imageGeneration" || row.key === "imageEditing" ? (
                        currentProvider?.adapterProtocol === "openai_images" && currentModel ? (
                          <p className="text-xs leading-6 text-stone-600">
                            {t("服务：")}{currentProvider.name} {t("· 协议：")}{getAiProviderProtocolLabel(currentProvider)} {t("· 模型 ID：")}{currentModel.modelId}
                          </p>
                        ) : (
                          <p className="text-xs leading-6 text-amber-700">
                            {t("尚未配置 Images API 图片模型。请在上方“图片生成与编辑”填写原生或中转图片配置。")}</p>
                        )
                      ) : null}
                    </div>
                  );
                })}
              </div>
              </details>
            </ConfigCard>

            {showLegacyConfiguration ? <ConfigCard>
              <p className="text-sm font-semibold text-stone-950">{t("写作整理（高级）")}</p>
              <p className="mt-2 text-xs leading-6 text-stone-500">
                {t("这些选项只影响后续内容整理，不影响 AI 服务连接或模型 ID。")}</p>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <SelectField
                  label={t("默认写作语言")}
                  value={aiContentPreferences.defaultOutputLanguage}
                  options={[
                    { value: "en", label: t("英文") },
                    { value: "zh", label: t("中文") },
                  ]}
                  onChange={(value) =>
                    onAiContentPreferencesChange({
                      ...aiContentPreferences,
                      defaultOutputLanguage:
                        value as AiContentPreferences["defaultOutputLanguage"],
                    })
                  }
                />
                <SelectField
                  label={t("后续内容整理方式")}
                  value={aiContentPreferences.rewriteTone}
                  options={[
                    { value: "natural", label: t("更自然一点") },
                    { value: "professional", label: t("更专业一点") },
                    { value: "calm", label: t("更平静克制") },
                    { value: "direct", label: t("更直接一点") },
                  ]}
                  onChange={(value) =>
                    onAiContentPreferencesChange({
                      ...aiContentPreferences,
                      rewriteTone: value as AiContentPreferences["rewriteTone"],
                    })
                  }
                />
                <SelectField
                  label={t("翻译与改写偏好")}
                  value={aiContentPreferences.rewriteStrategy}
                  options={[
                    { value: "literal", label: t("更偏直译") },
                    { value: "localized", label: t("更偏本地化改写") },
                    { value: "deep_rewrite", label: t("更偏深度重写") },
                  ]}
                  onChange={(value) =>
                    onAiContentPreferencesChange({
                      ...aiContentPreferences,
                      rewriteStrategy: value as AiContentPreferences["rewriteStrategy"],
                    })
                  }
                />
                <ToggleRow
                  label={t("默认整理多平台版本")}
                  checked={aiContentPreferences.autoGenerateMultiPlatformVersions}
                  onChange={(checked) =>
                    onAiContentPreferencesChange({
                      ...aiContentPreferences,
                      autoGenerateMultiPlatformVersions: checked,
                    })
                  }
                />
              </div>
            </ConfigCard> : null}
          </div>
        </ConfigBlock>

        {showLegacyConfiguration ? (
          <>
        <ConfigBlock
          title={t("自动化连接")}
          description={t("管理 n8n、Make、WordPress 草稿和 Dev.to 草稿等自动化服务。")}
          summary={`${automationConnections.filter((item) => item.enabled).length} 条已启用`}
          isOpen={openSection === "automation"}
          onToggle={() => setOpenSection(openSection === "automation" ? null : "automation")}
        >
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() =>
                  onAutomationConnectionsChange([
                    {
                      id: createId(),
                      name: t("新连接"),
                      connectionType: "n8n_webhook",
                      endpoint: "",
                      enabled: false,
                      notes: "",
                    },
                    ...automationConnections,
                  ])
                }
                className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700"
              >
                {t("新增一个连接")}</button>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              {automationConnections.map((connection) => (
                <ConfigCard key={connection.id}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                      label={t("连接名称")}
                      value={connection.name}
                      onChange={(value) =>
                        onAutomationConnectionsChange(
                          replaceById(automationConnections, { ...connection, name: value }),
                        )
                      }
                    />
                    <SelectField
                      label={t("连接类型")}
                      value={connection.connectionType}
                      options={Object.entries(AUTOMATION_TYPE_LABELS).map(([value, label]) => ({
                        value,
                        label,
                      }))}
                      onChange={(value) =>
                        onAutomationConnectionsChange(
                          replaceById(automationConnections, {
                            ...connection,
                            connectionType: value as AutomationConnectionConfig["connectionType"],
                          }),
                        )
                      }
                    />
                  </div>
                  <TextField
                    label={t("服务地址")}
                    value={connection.endpoint}
                    placeholder={t("可稍后填写服务地址")}
                    onChange={(value) =>
                      onAutomationConnectionsChange(
                        replaceById(automationConnections, { ...connection, endpoint: value }),
                      )
                    }
                  />
                  <TextAreaField
                    label={t("说明")}
                    value={connection.notes ?? ""}
                    onChange={(value) =>
                      onAutomationConnectionsChange(
                        replaceById(automationConnections, { ...connection, notes: value }),
                      )
                    }
                  />
                  <ToggleRow
                    label={t("启用")}
                    checked={connection.enabled}
                    onChange={(checked) =>
                      onAutomationConnectionsChange(
                        replaceById(automationConnections, { ...connection, enabled: checked }),
                      )
                    }
                  />
                </ConfigCard>
              ))}
            </div>
          </div>
        </ConfigBlock>

        <ConfigBlock
          title={t("内容类型")}
          description={t("管理导入页面中“材料类型”的可选项。")}
          summary={`${sourceTypeConfigs.filter((item) => item.enabled).length} 个正在使用`}
          isOpen={openSection === "sources"}
          onToggle={() => setOpenSection(openSection === "sources" ? null : "sources")}
        >
          <div className="grid gap-4 xl:grid-cols-2">
            {sourceTypeConfigs.map((item) => (
              <ConfigCard key={item.id}>
                <TextField
                  label={t("名称")}
                  value={item.name}
                  onChange={(value) => onSourceTypeChange({ ...item, name: value })}
                />
                <TextAreaField
                  label={t("说明")}
                  value={item.description}
                  onChange={(value) => onSourceTypeChange({ ...item, description: value })}
                />
                <ToggleRow
                  label={t("启用")}
                  checked={item.enabled}
                  onChange={(checked) => onSourceTypeChange({ ...item, enabled: checked })}
                />
              </ConfigCard>
            ))}
          </div>
        </ConfigBlock>

        <ConfigBlock
          title={t("分类")}
          description={t("先看概览，有需要时再改颜色、说明和启用状态。")}
          summary={`${categoryConfigs.filter((item) => item.enabled).length} 个正在使用`}
          isOpen={openSection === "categories"}
          onToggle={() => setOpenSection(openSection === "categories" ? null : "categories")}
        >
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() =>
                onCategoryAdd({
                  id: createId(),
                  name: t("新分类"),
                  description: t("说明这类内容的范围和用途。"),
                  color: "#e7e0d8",
                  enabled: true,
                })
              }
              className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700"
            >
              {t("新增一个配置项")}</button>
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {categoryConfigs.map((item) => (
              <ConfigCard key={item.id}>
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
                  <TextField
                    label={t("名称")}
                    value={item.name}
                    onChange={(value) => onCategoryChange({ ...item, name: value })}
                  />
                  <ColorField
                    label={t("颜色")}
                    value={item.color}
                    onChange={(value) => onCategoryChange({ ...item, color: value })}
                  />
                </div>
                <TextAreaField
                  label={t("说明")}
                  value={item.description}
                  onChange={(value) => onCategoryChange({ ...item, description: value })}
                />
                <ToggleRow
                  label={t("启用")}
                  checked={item.enabled}
                  onChange={(checked) => onCategoryChange({ ...item, enabled: checked })}
                />
              </ConfigCard>
            ))}
          </div>
        </ConfigBlock>

        <ConfigBlock
          title={t("平台")}
          description={t("管理内容整理后的发布去向。")}
          summary={`${platformConfigs.filter((item) => item.enabled).length} 个正在使用`}
          isOpen={openSection === "platforms"}
          onToggle={() => setOpenSection(openSection === "platforms" ? null : "platforms")}
        >
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() =>
                onPlatformAdd({
                  id: createId(),
                  name: t("新平台"),
                  description: t("说明这个平台适合发布的内容。"),
                  platformType: "custom",
                  supportedFormats: ["custom"],
                  publishMode: "manual",
                  enabled: true,
                })
              }
              className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700"
            >
              {t("新增一个配置项")}</button>
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {platformConfigs.map((item) => (
              <ConfigCard key={item.id}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    label={t("名称")}
                    value={item.name}
                    onChange={(value) => onPlatformChange({ ...item, name: value })}
                  />
                  <SelectField
                    label={t("平台类型")}
                    value={item.platformType}
                    options={PLATFORM_TYPE_OPTIONS.map((value) => ({
                      value,
                      label: PLATFORM_TYPE_LABELS[value],
                    }))}
                    onChange={(value) =>
                      onPlatformChange({
                        ...item,
                        platformType: value as PlatformConfig["platformType"],
                      })
                    }
                  />
                </div>
                <TextAreaField
                  label={t("说明")}
                  value={item.description}
                  onChange={(value) => onPlatformChange({ ...item, description: value })}
                />
                <ChipSelectField
                  label={t("支持的内容形式")}
                  values={item.supportedFormats}
                  options={OUTPUT_FORMAT_OPTIONS}
                  onToggle={(value) =>
                    onPlatformChange({
                      ...item,
                      supportedFormats: toggleSelection(
                        item.supportedFormats,
                        value as OutputFormat,
                      ),
                    })
                  }
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <SelectField
                    label={t("发布方式")}
                    value={item.publishMode}
                    options={Object.entries(PUBLISH_MODE_LABELS).map(([value, label]) => ({
                      value,
                      label,
                    }))}
                    onChange={(value) =>
                      onPlatformChange({
                        ...item,
                        publishMode: value as PlatformConfig["publishMode"],
                      })
                    }
                  />
                  <ToggleRow
                    label={t("启用")}
                    checked={item.enabled}
                    onChange={(checked) => onPlatformChange({ ...item, enabled: checked })}
                  />
                </div>
              </ConfigCard>
            ))}
          </div>
        </ConfigBlock>

        <ConfigBlock
          title={t("产品")}
          description={t("记录从学习内容中逐步整理出的产品方向。")}
          summary={`${productConfigs.filter((item) => item.enabled).length} 个正在使用`}
          isOpen={openSection === "products"}
          onToggle={() => setOpenSection(openSection === "products" ? null : "products")}
        >
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() =>
                onProductAdd({
                  id: createId(),
                  name: t("新产品"),
                  description: t("由内容整理出的一个产品方向。"),
                  audience: t("待确认适合人群"),
                  defaultCTA: t("如果你也想继续推进，可以继续看看这条产品线。"),
                  enabled: true,
                })
              }
              className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700"
            >
              {t("新增一个配置项")}</button>
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {productConfigs.map((item) => (
              <ConfigCard key={item.id}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    label={t("名称")}
                    value={item.name}
                    onChange={(value) => onProductChange({ ...item, name: value })}
                  />
                  <TextField
                    label={t("更适合谁")}
                    value={item.audience}
                    onChange={(value) => onProductChange({ ...item, audience: value })}
                  />
                </div>
                <TextAreaField
                  label={t("这是什么")}
                  value={item.description}
                  onChange={(value) => onProductChange({ ...item, description: value })}
                />
                <TextAreaField
                  label={t("默认下一步")}
                  value={item.defaultCTA}
                  onChange={(value) => onProductChange({ ...item, defaultCTA: value })}
                />
                <ToggleRow
                  label={t("启用")}
                  checked={item.enabled}
                  onChange={(checked) => onProductChange({ ...item, enabled: checked })}
                />
              </ConfigCard>
            ))}
          </div>
        </ConfigBlock>

        <ConfigBlock
          title={t("发布规则")}
          description={t("设置内容的推荐平台、整理形式和发布方式。")}
          summary={`${routingRules.filter((item) => item.enabled).length} 条正在生效`}
          isOpen={openSection === "rules"}
          onToggle={() => setOpenSection(openSection === "rules" ? null : "rules")}
        >
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() =>
                onRuleAdd({
                  id: createId(),
                  name: t("新规则"),
                  description: t("说明这条规则适用的情境。"),
                  enabled: true,
                  priority: 60,
                  when: {
                    sourceTypeIds: [],
                    categoryIds: [],
                    moduleIds: [],
                    productIds: [],
                    keywords: [],
                  },
                  then: {
                    platformIds: platformConfigs[0] ? [platformConfigs[0].id] : [],
                    outputFormats: ["custom"],
                    publishMode: "draft",
                    rewriteDepth: "medium",
                    defaultCTA: "",
                  },
                })
              }
              className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700"
            >
              {t("新增一个配置项")}</button>
          </div>
          <div className="mt-4 space-y-4">
            {routingRules.map((item) => (
              <ConfigCard key={item.id}>
                <RuleEditor
                  rule={item}
                  sourceTypeOptions={sourceTypeOptions}
                  categoryOptions={categoryOptions}
                  platformOptions={platformOptions}
                  productOptions={productOptions}
                  onChange={onRuleChange}
                />
              </ConfigCard>
            ))}
          </div>
        </ConfigBlock>
          </>
        ) : null}
      </div>
    </section>
  );
}

type AiConnectionSettingsProps = {
  aiProviders: AiProviderConfig[];
  aiModels: AiModelConfig[];
  aiTaskRouting: AiTaskRouting;
  aiPrivacySettings: AiPrivacySettings;
  simpleAiProviders: AiProviderConfig[];
  selectedProvider: AiProviderConfig | undefined;
  selectedProviderId: string;
  connectionTests: Record<string, AiConnectionTestResult>;
  testingProviderId: string;
  apiKeyDrafts: Record<string, string>;
  credentialMessages: Record<string, string>;
  secretStoreStatus: SecretStoreStatus | null;
  onSelectedProviderChange: (value: string) => void;
  onAiProvidersChange: (value: AiProviderConfig[]) => void;
  onAiModelsChange: (value: AiModelConfig[]) => void;
  onAiTaskRoutingChange: (value: AiTaskRouting) => void;
  onAiPrivacySettingsChange: (value: AiPrivacySettings) => void;
  setTestingProviderId: (value: string) => void;
  setConnectionTests: Dispatch<SetStateAction<Record<string, AiConnectionTestResult>>>;
  setApiKeyDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  setCredentialMessages: Dispatch<SetStateAction<Record<string, string>>>;
  setSecretStoreStatus: (value: SecretStoreStatus | null) => void;
  imageProviderRequest: number;
  textProviderRequest: number;
};

function AiConnectionSettings({
  aiProviders,
  aiModels,
  aiTaskRouting,
  aiPrivacySettings,
  simpleAiProviders,
  selectedProvider,
  selectedProviderId,
  connectionTests,
  testingProviderId,
  apiKeyDrafts,
  credentialMessages,
  secretStoreStatus,
  onSelectedProviderChange,
  onAiProvidersChange,
  onAiModelsChange,
  onAiTaskRoutingChange,
  onAiPrivacySettingsChange,
  setTestingProviderId,
  setConnectionTests,
  setApiKeyDrafts,
  setCredentialMessages,
  setSecretStoreStatus,
  imageProviderRequest,
  textProviderRequest,
}: AiConnectionSettingsProps) {
  const { t } = useLearningUi();
  const provider = selectedProvider ?? simpleAiProviders[0];
  const providerModels = provider
    ? aiModels.filter((model) => model.providerId === provider.id)
    : [];
  const [newModelDraft, setNewModelDraft] = useState<NewModelDraft | null>(null);
  const [newProviderDraft, setNewProviderDraft] = useState<NewProviderDraft | null>(
    provider ? null : createNewProviderDraft("openai-native"),
  );
  const [imageApiDrafts, setImageApiDrafts] = useState<Record<ImageApiProviderKind, ImageApiDraft>>(
    () => ({
      "openai-native": createImageApiDraft("openai-native", aiProviders, aiModels),
      "dragtoken-relay": createImageApiDraft("dragtoken-relay", aiProviders, aiModels),
    }),
  );
  const [imageApiTestMessages, setImageApiTestMessages] = useState<
    Partial<Record<ImageApiProviderKind, string>>
  >({});
  const [testingImageApiKind, setTestingImageApiKind] = useState<ImageApiProviderKind | "">("");

  const [savedImageConfig, setSavedImageConfig] = useState({ aiProviders, aiModels });
  if (savedImageConfig.aiProviders !== aiProviders || savedImageConfig.aiModels !== aiModels) {
    setSavedImageConfig({ aiProviders, aiModels });
    setImageApiDrafts((current) => ({
      "openai-native": mergeImageApiDraftFromSaved(
        current["openai-native"],
        createImageApiDraft("openai-native", aiProviders, aiModels),
      ),
      "dragtoken-relay": mergeImageApiDraftFromSaved(
        current["dragtoken-relay"],
        createImageApiDraft("dragtoken-relay", aiProviders, aiModels),
      ),
    }));
  }

  const [handledProviderRequest, setHandledProviderRequest] = useState({ imageProviderRequest, textProviderRequest });
  if (handledProviderRequest.imageProviderRequest !== imageProviderRequest || handledProviderRequest.textProviderRequest !== textProviderRequest) {
    setHandledProviderRequest({ imageProviderRequest, textProviderRequest });
    setNewProviderDraft(createNewProviderDraft("openai-compatible", handledProviderRequest.imageProviderRequest !== imageProviderRequest ? "image" : "general"));
  }

  useEffect(() => {
    if (!imageProviderRequest || typeof window === "undefined") return;

    window.requestAnimationFrame(() => {
      document.getElementById("ai-service-create-form")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [imageProviderRequest]);

  useEffect(() => {
    if (!textProviderRequest) return;
    window.requestAnimationFrame(() => document.getElementById("ai-service-create-form")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [textProviderRequest]);

  async function runConnectionTest(
    testProvider: AiProviderConfig,
    modelId?: string,
    capability: "text" | "image" = "text",
  ) {
    const testKey = modelId ? getCapabilityTestKey(modelId, capability) : testProvider.id;

    setTestingProviderId(testKey);
    setConnectionTests((current) => ({
      ...current,
      [testKey]: {
        success: true,
        message: capability === "image" ? "正在验证图片能力…" : "正在验证文本能力…",
        providerId: testProvider.id,
        modelId,
        capability,
      },
    }));

    try {
      const result = await testAiProviderConnection(testProvider, aiModels, modelId, capability);
      setConnectionTests((current) => ({
        ...current,
        [testKey]: result,
      }));

      if (modelId && capability === "image" && result.checkedAt) {
        const next = applyImageInputVerification({ aiProviders, aiModels, aiTaskRouting }, result);
        onAiProvidersChange(next.aiProviders);
        onAiModelsChange(next.aiModels);
        onAiTaskRoutingChange(next.aiTaskRouting);
        return;
      }

      if (modelId) {
        onAiModelsChange(
          aiModels.map((model) =>
            model.id === modelId
              ? {
                  ...model,
                  capabilityVerification: {
                    text: model.capabilityVerification?.text ?? "unverified",
                    image: model.capabilityVerification?.image ?? "unverified",
                    structuredOutput:
                      model.capabilityVerification?.structuredOutput ?? "unverified",
                    reasoning: model.capabilityVerification?.reasoning ?? "unverified",
                    streaming: model.capabilityVerification?.streaming ?? "unverified",
                    [capability]: result.success ? "verified" : "failed",
                  },
                  capabilityVerificationDetails: {
                    ...model.capabilityVerificationDetails,
                    [capability]: {
                      status: result.success ? "verified" : "failed",
                      checkedAt: result.checkedAt,
                      requestUrl: result.requestUrl,
                      message: result.message,
                    },
                  },
                }
              : model,
          ),
        );
      } else {
        onAiProvidersChange(
          replaceById(aiProviders, {
            ...testProvider,
            connectionVerification: {
              status: result.success ? "verified" : "failed",
              checkedAt: result.checkedAt,
              requestUrl: result.requestUrl,
              message: result.message,
            },
          }),
        );
      }
    } finally {
      setTestingProviderId("");
    }
  }

  async function handleSaveCredential(testProvider: AiProviderConfig) {
    const result = await saveProviderCredential(
      testProvider,
      apiKeyDrafts[testProvider.id] ?? "",
    );

    setSecretStoreStatus(result.status);
    setCredentialMessages((current) => ({
      ...current,
      [testProvider.id]: result.message,
    }));

    if (result.provider) {
      onAiProvidersChange(
        replaceById(aiProviders, {
          ...result.provider,
          connectionVerification: { status: "unverified" },
        }),
      );
      setApiKeyDrafts((current) => ({
        ...current,
        [testProvider.id]: "",
      }));
    }
  }

  async function handleMigrateCredential(testProvider: AiProviderConfig) {
    const result = await migrateLegacyCredential(testProvider, t);

    setSecretStoreStatus(result.status);
    setCredentialMessages((current) => ({
      ...current,
      [testProvider.id]: result.message,
    }));

    if (result.provider) {
      onAiProvidersChange(
        replaceById(aiProviders, {
          ...result.provider,
          connectionVerification: { status: "unverified" },
        }),
      );
    }
  }

  function updateProvider(nextProvider: AiProviderConfig) {
    onAiProvidersChange(
      replaceById(aiProviders, {
        ...nextProvider,
        connectionVerification: { status: "unverified" },
      }),
    );
  }

  async function deleteProvider(targetProvider: AiProviderConfig) {
    if ((SUPPORTED_AI_PROVIDER_IDS as readonly string[]).includes(targetProvider.id)) return;
    if (typeof window !== "undefined" && !window.confirm(t(`删除 AI 服务“${targetProvider.name}”及其模型吗？`))) {
      return;
    }

    if (targetProvider.credentialRef) {
      const store = createSecretStore();
      if (await store.isAvailable()) {
        await store.deleteSecret(targetProvider.credentialRef);
      }
    }

    const nextRouting = { ...aiTaskRouting };
    (Object.keys(nextRouting) as Array<keyof AiTaskRouting>).forEach((key) => {
      const route = nextRouting[key];
      if (route?.providerId !== targetProvider.id) return;
      nextRouting[key] = DEFAULT_AI_TASK_ROUTING[key] ?? DEFAULT_AI_TASK_ROUTING.analysis;
    });
    onAiTaskRoutingChange(nextRouting);
    onAiModelsChange(aiModels.filter((model) => model.providerId !== targetProvider.id));
    onAiProvidersChange(aiProviders.filter((item) => item.id !== targetProvider.id));
    onSelectedProviderChange(aiProviders.find((item) => item.id !== targetProvider.id)?.id ?? "");
  }

  function updateProviderEnabled(nextProvider: AiProviderConfig, enabled: boolean) {
    const normalizedProvider = normalizeProviderForSimpleUi({
      ...nextProvider,
      enabled,
    });

    onAiProvidersChange(replaceById(aiProviders, normalizedProvider));

    if (enabled && isLmStudioProvider(normalizedProvider)) {
      onAiPrivacySettingsChange({
        ...aiPrivacySettings,
        allowRemoteAi: false,
        onlyUseLocalModels: true,
      });
    }
  }

  function beginAddModel(targetProvider: AiProviderConfig) {
    setNewModelDraft(createNewModelDraft(targetProvider.id));
  }

  function createModelFromDraft(draft: NewModelDraft) {
    if (!provider) return;

    const modelId = draft.modelId.trim();

    if (!modelId) {
      setNewModelDraft({ ...draft, error: "请先填写模型 ID。" });
      return;
    }

    const duplicate = aiModels.some(
      (model) =>
        model.providerId === draft.providerId &&
        model.modelId.trim().toLowerCase() === modelId.toLowerCase(),
    );

    if (duplicate) {
      setNewModelDraft({ ...draft, error: "当前 AI 服务中已经存在相同的模型 ID。" });
      return;
    }

    const providerSupportsImages = aiProviderSupportsImageInput(provider);

    if (draft.technicalCapabilities.includes("vision") && !providerSupportsImages) {
      setNewModelDraft({
        ...draft,
        error: "当前协议未接入图片输入，请选择 OpenAI 原生、OpenAI-compatible、Gemini native 或本地兼容服务。",
      });
      return;
    }

    const supportsVision = providerSupportsImages && draft.technicalCapabilities.includes("vision");
    const technicalCapabilities = providerSupportsImages
      ? draft.technicalCapabilities
      : draft.technicalCapabilities.filter((item) => item !== "vision" && item !== "image");
    const nextModel = createCustomAiModelConfig(provider, {
      displayName: draft.displayName,
      modelId,
      modelName: modelId,
      enabled: draft.enabled,
      supportsText: technicalCapabilities.includes("text"),
      supportsVision,
      supportsStructuredOutput: technicalCapabilities.includes("structured_output"),
      supportsReasoning: technicalCapabilities.includes("reasoning"),
      supportsStreaming: technicalCapabilities.includes("streaming"),
      capabilities: [...new Set([...technicalCapabilities, ...draft.taskCapabilities])],
    });
    const nextModels = [nextModel, ...aiModels];

    onAiModelsChange(nextModels);

    if (draft.setAsDefault) {
      onAiTaskRoutingChange(makeModelDefaultForSupportedTasks(provider, nextModel, aiTaskRouting));
    }

    setNewModelDraft(null);
  }

  async function createProviderFromDraft(draft: NewProviderDraft) {
    const name = draft.name.trim();
    const baseUrl = draft.baseUrl.trim();
    const initialModelId = draft.initialModelId.trim();

    if (!name) {
      setNewProviderDraft({ ...draft, error: "请先填写服务名称。" });
      return;
    }

    if (!baseUrl) {
      setNewProviderDraft({ ...draft, error: "请先填写服务地址。" });
      return;
    }

    if (!initialModelId) {
      setNewProviderDraft({ ...draft, error: draft.purpose === "image" ? "请先填写图片模型 ID。" : "请先填写模型 ID。" });
      return;
    }

    if (draft.authMode === "header" && !draft.authHeaderName.trim()) {
      setNewProviderDraft({ ...draft, error: "使用自定义请求头认证时，请填写 Header 名称。" });
      return;
    }

    const customEndpointPath = draft.customEndpointPath.trim();

    if (
      draft.purpose !== "image" &&
      (!customEndpointPath || !customEndpointPath.startsWith("/"))
    ) {
      setNewProviderDraft({ ...draft, error: "请填写以 / 开头的 endpoint 相对路径。" });
      return;
    }

    const nameAlreadyExists = aiProviders.some(
      (item) => item.name.trim().toLowerCase() === name.toLowerCase(),
    );

    if (
      nameAlreadyExists &&
      typeof window !== "undefined" &&
      !window.confirm(t("已经存在同名 AI 服务。仍然创建一个新的服务实例吗？"))
    ) {
      setNewProviderDraft({ ...draft, error: "已取消创建。同一协议可以创建多个实例，但建议使用不同名称。" });
      return;
    }

    const providerId = createId();
    const nextProvider = normalizeProviderForSimpleUi({
      ...createCustomAiProviderConfig({
        presetId: draft.presetId,
        id: providerId,
        name,
        baseUrl,
        apiKeyRequired: draft.apiKeyRequired,
      }),
      adapterProtocol: draft.adapterProtocol,
      providerType: draft.providerType,
      providerFamily: draft.providerFamily,
      connectionMode: draft.connectionMode,
      endpointMode:
        draft.purpose === "image" && draft.adapterProtocol === "openai_chat_completions"
          ? "chat_completions"
          : draft.adapterProtocol === "openai_chat_completions"
            ? "custom"
            : draft.endpointMode,
      customEndpointPath:
        draft.purpose === "image" && draft.adapterProtocol === "openai_chat_completions"
          ? ""
          : customEndpointPath,
      authMode: draft.authMode,
      authHeaderName: draft.authHeaderName.trim(),
      apiKeyRequired: draft.apiKeyRequired,
      extraHeaders:
        draft.extraHeaderName.trim() || draft.extraHeaderValue.trim()
          ? [
              {
                id: createId(),
                name: draft.extraHeaderName.trim(),
                value: draft.extraHeaderValue,
                enabled: true,
              },
            ]
          : [],
      timeoutMs: draft.timeoutMs,
      enabled: true,
    });

    if (draft.purpose === "image" && !aiProviderSupportsImageInput(nextProvider)) {
      setNewProviderDraft({
        ...draft,
        error:
          "当前协议未接入图片输入。请使用 OpenAI-compatible、Gemini native 或本地兼容服务。",
      });
      return;
    }

    let providerToSave = nextProvider;

    if (draft.apiKeyDraft.trim() && draft.authMode !== "none") {
      const result = await saveProviderCredential(nextProvider, draft.apiKeyDraft);
      setSecretStoreStatus(result.status);
      setCredentialMessages((current) => ({
        ...current,
        [providerId]: result.message,
      }));

      if (result.provider) {
        providerToSave = result.provider;
      }
    }

    onAiProvidersChange([providerToSave, ...aiProviders]);

    const isImage = draft.purpose === "image";
    const initialModel = createCustomAiModelConfig(providerToSave, {
      displayName: draft.initialModelDisplayName.trim() || initialModelId,
      modelId: initialModelId,
      modelName: initialModelId,
      enabled: true,
      supportsText: true,
      supportsVision: isImage,
      supportsStructuredOutput: false,
      supportsReasoning: false,
      supportsStreaming: false,
      capabilities: isImage ? ["text", "vision"] : ["text", "analysis", "rewrite", "publish_package", "video_script"],
    });
    onAiModelsChange([initialModel, ...aiModels]);
    if (!isImage && draft.setAsDefault) {
      onAiTaskRoutingChange(makeModelDefaultForSupportedTasks(providerToSave, initialModel, aiTaskRouting));
    }
    onSelectedProviderChange(providerId);
    setNewProviderDraft(null);
    setNewModelDraft(null);
  }

  const serviceSetup = <>
    <div>
      <p className="text-sm font-semibold text-stone-950">{t("文字 AI：原生 / 中转 / 自定义")}</p>
      <p className="mt-2 text-sm leading-7 text-stone-600">{t("选择接入方式，填写地址、密钥和模型 ID。中转商提供 /chat/completions 时选兼容中转，提供 /messages 时选 Claude 原生协议中转。")}</p>
      <AiConfigurationHelp />
      <div className="mt-3 flex flex-wrap gap-2">
        {(["openai-native", "anthropic-messages", "openai-compatible", "anthropic-relay"] as const).map((id) =>
          <button key={id} type="button" onClick={() => setNewProviderDraft(createNewProviderDraft(id))}
            className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700">
            {t(({ "openai-native": "OpenAI 原生", "anthropic-messages": "Claude 原生", "openai-compatible": "OpenAI / Claude 兼容中转", "anthropic-relay": "Claude 原生协议中转" })[id])}
          </button>)}
      </div>
    </div>
    {newProviderDraft ? <NewProviderForm draft={newProviderDraft} onChange={setNewProviderDraft}
      onCancel={() => setNewProviderDraft(null)} onCreate={() => createProviderFromDraft(newProviderDraft)} /> : null}
  </>;

  if (!provider) {
    return <ConfigCard>{serviceSetup}<CredentialStorageNotice status={secretStoreStatus} /></ConfigCard>;
  }

  const selectedProviderTest = connectionTests[provider.id] ??
    (provider.connectionVerification?.status !== "unverified"
      ? {
          success: provider.connectionVerification?.status === "verified",
          message: provider.connectionVerification?.message ?? "连接状态已保存。",
          providerId: provider.id,
          protocol: provider.adapterProtocol,
          requestUrl: provider.connectionVerification?.requestUrl,
          checkedAt: provider.connectionVerification?.checkedAt,
        }
      : undefined);
  const isOpenAiNative = isOpenAiProvider(provider);
  const isLocalProvider = isLmStudioProvider(provider);
  const authModeLabel = getAuthModeLabel(provider.authMode);

  return (
    <ConfigCard>
      {serviceSetup}
      <details className="rounded-2xl border border-stone-200 p-4">
        <summary className="cursor-pointer text-sm font-semibold">{t("图片生成与编辑（可选）")}</summary>
      <ImageGenerationSettings
        aiProviders={aiProviders}
        aiModels={aiModels}
        aiTaskRouting={aiTaskRouting}
        drafts={imageApiDrafts}
        imageApiTestMessages={imageApiTestMessages}
        testingImageApiKind={testingImageApiKind}
        apiKeyDrafts={apiKeyDrafts}
        credentialMessages={credentialMessages}
        onDraftsChange={setImageApiDrafts}
        setImageApiTestMessages={setImageApiTestMessages}
        setTestingImageApiKind={setTestingImageApiKind}
        onAiProvidersChange={onAiProvidersChange}
        onAiModelsChange={onAiModelsChange}
        onAiTaskRoutingChange={onAiTaskRoutingChange}
        setApiKeyDrafts={setApiKeyDrafts}
        setCredentialMessages={setCredentialMessages}
        setSecretStoreStatus={setSecretStoreStatus}
        onSelectedProviderChange={onSelectedProviderChange}
      />

      </details>
      <CredentialStorageNotice status={secretStoreStatus} />

      <div className="border-t border-stone-200 pt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-stone-950">{t("我的 AI 服务")}</p>
            <p className="mt-2 text-xs leading-6 text-stone-500">
              {t("这里显示已经创建或配置过的服务实例。文字模型、图片模型可以分别使用不同中转。")}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {simpleAiProviders.map((candidate) => {
          const isSelected = candidate.id === selectedProviderId;
          const modelsCount = aiModels.filter((model) => model.providerId === candidate.id).length;
          const testResult = connectionTests[candidate.id];
          const setupStatus = getAiProviderSetupStatus(candidate, aiModels, testResult);

          return (
            <button
              key={candidate.id}
              type="button"
              onClick={() => onSelectedProviderChange(candidate.id)}
              className={`rounded-2xl border p-4 text-left transition ${
                isSelected
                  ? "border-stone-800 bg-stone-900 text-white"
                  : "border-stone-200 bg-[#fbfaf7] text-stone-700 hover:border-stone-300"
              }`}
            >
              <span className={`text-xs font-semibold ${isSelected ? "text-stone-200" : "text-stone-500"}`}>
                {t(getAiProviderPresetLabel(candidate))}
              </span>
              <span className="mt-2 block text-base font-semibold">{t(getProviderTitle(candidate))}</span>
              <span className={`mt-2 block text-xs leading-6 ${isSelected ? "text-stone-200" : "text-stone-500"}`}>
                {t("协议：")}{t(getAiProviderProtocolLabel(candidate))}
                <br />
                {t("地址：")}{formatProviderBaseUrl(candidate)}
              </span>
              <span className="mt-3 flex flex-wrap gap-2 text-xs">
                <span
                  className={`rounded-full px-2.5 py-1 ${
                    isSelected ? "bg-white/15 text-white" : "border border-stone-200 bg-white text-stone-600"
                  }`}
                >
                  {t(getAiProviderSetupStatusLabel(setupStatus))}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 ${
                    isSelected ? "bg-white/15 text-white" : "border border-stone-200 bg-white text-stone-600"
                  }`}
                >
                  {modelsCount} {t("个模型")}</span>
                <span
                  className={`rounded-full px-2.5 py-1 ${
                    isSelected ? "bg-white/15 text-white" : "border border-stone-200 bg-white text-stone-600"
                  }`}
                >
                  {t("路由：")}{candidate.enabled ? t("允许使用") : t("已停用")}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <section className="rounded-[1.5rem] border border-stone-200 bg-[#fbfaf7] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-stone-500">{t("当前连接")}</p>
            <h4 className="mt-1 text-xl font-semibold text-stone-950">{t(getProviderTitle(provider))}</h4>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-stone-600">
              {t(getProviderPanelDescription(provider))}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-stone-600">
              <span className="rounded-full border border-stone-200 bg-white px-2.5 py-1">
                {t("服务类型：")}{t(getAiProviderPresetLabel(provider))}
              </span>
              <span className="rounded-full border border-stone-200 bg-white px-2.5 py-1">
                {t("协议：")}{t(getAiProviderProtocolLabel(provider))}
              </span>
              <span className="rounded-full border border-stone-200 bg-white px-2.5 py-1">
                {t("Endpoint：")}{getProviderEndpointLabel(provider)}
              </span>
              <span className="rounded-full border border-stone-200 bg-white px-2.5 py-1">
                {t("认证方式：")}{t(authModeLabel)}
              </span>
              <span className="rounded-full border border-stone-200 bg-white px-2.5 py-1">
                {t("状态：")}{t(getAiProviderSetupStatusLabel(getAiProviderSetupStatus(provider, aiModels, selectedProviderTest)))}
              </span>
              <span className="rounded-full border border-stone-200 bg-white px-2.5 py-1">
                {t("任务路由：")}{provider.enabled ? t("允许使用") : t("已停用")}
              </span>
            </div>
          </div>
          <ToggleRow
            label={t("启用")}
            checked={provider.enabled}
            onChange={(checked) => updateProviderEnabled(provider, checked)}
          />
          {!(SUPPORTED_AI_PROVIDER_IDS as readonly string[]).includes(provider.id) ? (
            <button
              type="button"
              onClick={() => void deleteProvider(provider)}
              className="rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700"
            >
              {t("删除服务")}</button>
          ) : null}
        </div>

        <div className="mt-5 space-y-5">
          {isOpenAiNative ? (
            <div className="space-y-4">
              {provider.authMode !== "none" ? (
                <CredentialEditor
                  provider={provider}
                  apiKeyDrafts={apiKeyDrafts}
                  credentialMessages={credentialMessages}
                  onDraftChange={setApiKeyDrafts}
                  onSave={() => handleSaveCredential(provider)}
                  onMigrate={() => handleMigrateCredential(provider)}
                  optional={provider.apiKeyRequired === false}
                />
              ) : (
                <p className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-xs leading-6 text-stone-500">
                  {t("当前认证方式为无需认证，不会发送 API 密钥。")}</p>
              )}
              <details className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
                <summary className="cursor-pointer text-sm font-semibold text-stone-900">
                  {t("连接设置")}</summary>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <ReadOnlyField label={t("服务地址")} value="https://api.openai.com/v1" />
                  <ReadOnlyField label={t("认证方式")} value="Bearer Token" />
                </div>
              </details>
            </div>
          ) : isLocalProvider ? (
            <div className="space-y-4">
              <TextField
                label={t("服务地址")}
                value={provider.baseUrl}
                placeholder="http://localhost:1234/v1"
                description={t("LM Studio 默认地址：http://localhost:1234/v1。")}
                onChange={(value) =>
                  updateProvider(
                    normalizeProviderForSimpleUi({
                      ...provider,
                      baseUrl: value,
                    }),
                  )
                }
              />
              <TextField
                label="Endpoint"
                value={provider.customEndpointPath || "/v1/chat/completions"}
                placeholder="/v1/chat/completions"
                onChange={(value) =>
                  updateProvider({
                    ...provider,
                    endpointMode: "custom",
                    customEndpointPath: value,
                  })
                }
              />
              <details className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
                <summary className="cursor-pointer text-sm font-semibold text-stone-900">
                  {t("连接设置")}</summary>
                <div className="mt-4 space-y-4">
                  <SelectField
                    label={t("认证方式")}
                    value={provider.authMode}
                    options={[
                      { value: "none", label: t("无需认证") },
                      { value: "bearer", label: "Bearer Token" },
                      { value: "header", label: t("自定义请求头") },
                    ]}
                    onChange={(value) =>
                      updateProvider({
                        ...provider,
                        authMode: value as AiProviderConfig["authMode"],
                      })
                    }
                  />
                  {provider.authMode === "header" ? (
                    <TextField
                      label={t("Header 名称")}
                      value={provider.authHeaderName ?? ""}
                      placeholder={t("例如：x-api-key")}
                      onChange={(value) =>
                        updateProvider({
                          ...provider,
                          authHeaderName: value,
                        })
                      }
                    />
                  ) : null}
                  {provider.authMode !== "none" ? (
                    <CredentialEditor
                      provider={provider}
                      apiKeyDrafts={apiKeyDrafts}
                      credentialMessages={credentialMessages}
                      onDraftChange={setApiKeyDrafts}
                      onSave={() => handleSaveCredential(provider)}
                      onMigrate={() => handleMigrateCredential(provider)}
                      optional
                    />
                  ) : (
                    <p className="text-xs leading-6 text-stone-500">
                      {t("LM Studio 默认不需要 API 密钥；只有你的本地服务明确要求时再填写。")}</p>
                  )}
                </div>
              </details>
            </div>
          ) : (
            <div className="space-y-4">
              <TextField
                label={t("服务名称")}
                value={provider.displayName ?? provider.name}
                placeholder={t("例如：我的 Kimi 中转")}
                onChange={(value) =>
                  updateProvider({
                    ...provider,
                    name: value,
                    displayName: value,
                  })
                }
              />
              <SelectField
                label={t("协议类型")}
                value={provider.adapterProtocol ?? "openai_chat_completions"}
                options={[
                  { value: "openai_chat_completions", label: "OpenAI Chat Completions" },
                  { value: "openai_images", label: "OpenAI Images API" },
                  { value: "gemini_native", label: "Gemini native" },
                  { value: "anthropic_messages", label: "Anthropic Messages" },
                ]}
                onChange={(value) =>
                  updateProvider(
                    normalizeProviderForSimpleUi(
                      applyProtocolToProvider(
                        provider,
                        value as NonNullable<AiProviderConfig["adapterProtocol"]>,
                      ),
                    ),
                  )
                }
              />
              <TextField
                label={t("服务地址")}
                value={provider.baseUrl}
                placeholder={t("例如：https://api.example.com/v1")}
                description={t("填写服务商提供的 API Base URL，通常以 /v1 结尾。")}
                onChange={(value) =>
                  updateProvider(
                    normalizeProviderForSimpleUi({
                      ...provider,
                      baseUrl: value,
                    }),
                  )
                }
              />
              {provider.adapterProtocol === "openai_chat_completions" ? (
                <TextField
                  label="Endpoint"
                  value={provider.customEndpointPath || "/v1/chat/completions"}
                  placeholder="/v1/chat/completions"
                  description={t("以 / 开头；验证和正式请求都会使用这个 endpoint。")}
                  onChange={(value) =>
                    updateProvider({
                      ...provider,
                      endpointMode: "custom",
                      customEndpointPath: value,
                    })
                  }
                />
              ) : (
                <TextField
                  label="Endpoint"
                  value={provider.customEndpointPath || (provider.adapterProtocol === "anthropic_messages" ? "/messages" : "/models/{modelId}:generateContent")}
                  placeholder={provider.adapterProtocol === "anthropic_messages" ? "/messages" : "/models/{modelId}:generateContent"}
                  onChange={(value) =>
                    updateProvider({
                      ...provider,
                      customEndpointPath: value,
                    })
                  }
                />
              )}
              <CredentialEditor
                provider={provider}
                apiKeyDrafts={apiKeyDrafts}
                credentialMessages={credentialMessages}
                onDraftChange={setApiKeyDrafts}
                onSave={() => handleSaveCredential(provider)}
                onMigrate={() => handleMigrateCredential(provider)}
              />
              <details className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
                <summary className="cursor-pointer text-sm font-semibold text-stone-900">
                  {t("连接设置")}</summary>
                <div className="mt-4 space-y-4">
                  <SelectField
                    label={t("认证方式")}
                    value={provider.authMode}
                    options={buildAuthModeOptions(provider.adapterProtocol)}
                    onChange={(value) =>
                      updateProvider({
                        ...provider,
                        authMode: value as AiProviderConfig["authMode"],
                        apiKeyRequired:
                          value === "none" ? false : provider.apiKeyRequired ?? true,
                      })
                    }
                  />
                  <ToggleRow
                    label={t("API 密钥必填")}
                    checked={provider.apiKeyRequired ?? (provider.authMode !== "none")}
                    onChange={(checked) =>
                      updateProvider({
                        ...provider,
                        apiKeyRequired: checked,
                        authMode:
                          checked && provider.authMode === "none"
                            ? getDefaultAuthModeForProtocol(provider.adapterProtocol)
                            : provider.authMode,
                      })
                    }
                  />
                  {provider.authMode === "header" ? (
                    <TextField
                      label={t("Header 名称")}
                      value={provider.authHeaderName ?? ""}
                      placeholder={t("例如：x-api-key")}
                      onChange={(value) =>
                        updateProvider({
                          ...provider,
                          authHeaderName: value,
                        })
                      }
                    />
                  ) : null}
                  <NumberField
                    label={t("超时时间（毫秒）")}
                    value={provider.timeoutMs ?? 45000}
                    onChange={(value) =>
                      updateProvider({
                        ...provider,
                        timeoutMs: value || 45000,
                      })
                    }
                  />
                  <div className="grid gap-3 md:grid-cols-2">
                    <TextField
                      label={t("额外 Header 名称")}
                      value={provider.extraHeaders?.[0]?.name ?? ""}
                      placeholder={t("例如：x-client-id")}
                      onChange={(value) =>
                        updateProvider({
                          ...provider,
                          extraHeaders: [
                            {
                              id: provider.extraHeaders?.[0]?.id ?? createId(),
                              name: value,
                              value: provider.extraHeaders?.[0]?.value ?? "",
                              enabled: true,
                            },
                          ],
                        })
                      }
                    />
                    <TextField
                      label={t("额外 Header 值")}
                      value={provider.extraHeaders?.[0]?.value ?? ""}
                      placeholder={t("非密钥值")}
                      onChange={(value) =>
                        updateProvider({
                          ...provider,
                          extraHeaders: [
                            {
                              id: provider.extraHeaders?.[0]?.id ?? createId(),
                              name: provider.extraHeaders?.[0]?.name ?? "",
                              value,
                              enabled: true,
                            },
                          ],
                        })
                      }
                    />
                  </div>
                </div>
              </details>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-4">
            <p className="text-xs text-stone-500">
              {t("连接状态：")}{selectedProviderTest ? t(getConnectionStatusLabel(selectedProviderTest)) : t("未验证")} {t("· 认证方式：")}{t(authModeLabel)}
            </p>
            <button
              type="button"
              disabled={testingProviderId === provider.id}
              onClick={() => runConnectionTest(provider)}
              className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 disabled:opacity-50"
            >
              {testingProviderId === provider.id ? t("验证中…") : t("验证连接")}
            </button>
          </div>
          {selectedProviderTest ? (
            <ConnectionTestMessage result={selectedProviderTest} />
          ) : null}
        </div>
      </section>

      <ReadOnlyInfoField label={t("实际请求地址")} value={t(previewTextEndpoint(provider.baseUrl, provider.adapterProtocol, provider.customEndpointPath, providerModels[0]?.modelId))}
        description={t("此地址与连接验证、正式请求共用同一套地址规则。模型访问权限需单独验证。示例使用本服务的第一个模型。")} />
      <section id="ai-text-models" className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-stone-950">{t("已添加的模型")}</p>
            <p className="mt-2 text-xs leading-6 text-stone-500">
              {t("显示名称只用于界面；模型 ID 会原样发送给服务商。")}</p>
          </div>
          <button
            type="button"
            onClick={() => beginAddModel(provider)}
            className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700"
          >
            {t("＋ 自定义模型 ID")}</button>
        </div>

        {!newModelDraft ? <TextModelPresetPicker protocol={provider.adapterProtocol} family={provider.providerFamily} onSelect={(id) => {
          beginAddModel(provider);
          setNewModelDraft((draft) => draft ? { ...draft, modelId: id, displayName: id } : draft);
        }} /> : null}
        <ModelCatalog key={provider.id} provider={provider} onSelect={(id) => {
          beginAddModel(provider);
          setNewModelDraft((draft) => draft ? { ...draft, modelId: id, displayName: id } : draft);
        }} />
        <div className="space-y-3">
          {newModelDraft?.providerId === provider.id ? (
            <NewModelForm
              draft={newModelDraft}
              provider={provider}
              onChange={setNewModelDraft}
              onCancel={() => setNewModelDraft(null)}
              onCreate={() => createModelFromDraft(newModelDraft)}
            />
          ) : null}
          {providerModels.length ? (
            providerModels.map((model) => (
              <ModelConfigRow
                key={model.id}
                model={model}
                provider={provider}
                aiModels={aiModels}
                aiTaskRouting={aiTaskRouting}
                connectionTests={connectionTests}
                testingProviderId={testingProviderId}
                onAiModelsChange={onAiModelsChange}
                onAiTaskRoutingChange={onAiTaskRoutingChange}
                onValidateText={() => runConnectionTest(provider, model.id, "text")}
                onValidateImage={() => runConnectionTest(provider, model.id, "image")}
              />
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-stone-200 bg-white px-4 py-6 text-sm text-stone-500">
              {t("当前 AI 服务暂无模型。请添加一个模型，并填写服务商提供的准确模型 ID。")}</div>
          )}
        </div>
      </section>
    </ConfigCard>
  );
}

function CredentialEditor({
  provider,
  apiKeyDrafts,
  credentialMessages,
  onDraftChange,
  onSave,
  onMigrate,
  optional = false,
}: {
  provider: AiProviderConfig;
  apiKeyDrafts: Record<string, string>;
  credentialMessages: Record<string, string>;
  onDraftChange: Dispatch<SetStateAction<Record<string, string>>>;
  onSave: () => Promise<void>;
  onMigrate: () => Promise<void>;
  optional?: boolean;
}) {
  const { t } = useLearningUi();
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <TextField
          label={optional ? t("API 密钥（选填）") : t("API 密钥")}
          value={apiKeyDrafts[provider.id] ?? ""}
          placeholder={t("粘贴后点击保存密钥")}
          type="password"
          onChange={(value) =>
            onDraftChange((current) => ({
              ...current,
              [provider.id]: value,
            }))
          }
        />
        <button
          type="button"
          onClick={onSave}
          className="h-[46px] rounded-full border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-700"
        >
          {t("保存密钥")}</button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs leading-6 text-stone-500">
          {t("密钥状态：")}{t(describeCredential(provider))}
        </p>
        {provider.apiKeyRef ? (
          <button
            type="button"
            onClick={onMigrate}
            className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800"
          >
            {t("迁移旧密钥")}</button>
        ) : null}
      </div>
      {provider.apiKeyRef ? (
        <p className="text-xs leading-6 text-amber-700">
          {t("当前仍在使用旧的明文 API 密钥。系统凭据存储可用时，建议迁移。")}</p>
      ) : null}
      {credentialMessages[provider.id] ? (
        <p className="rounded-2xl bg-white px-4 py-3 text-sm leading-7 text-stone-700">
          {t(credentialMessages[provider.id])}
        </p>
      ) : null}
    </div>
  );
}

function ImageGenerationSettings({
  aiProviders,
  aiModels,
  aiTaskRouting,
  drafts,
  imageApiTestMessages,
  testingImageApiKind,
  apiKeyDrafts,
  credentialMessages,
  onDraftsChange,
  setImageApiTestMessages,
  setTestingImageApiKind,
  onAiProvidersChange,
  onAiModelsChange,
  onAiTaskRoutingChange,
  setApiKeyDrafts,
  setCredentialMessages,
  setSecretStoreStatus,
  onSelectedProviderChange,
}: {
  aiProviders: AiProviderConfig[];
  aiModels: AiModelConfig[];
  aiTaskRouting: AiTaskRouting;
  drafts: Record<ImageApiProviderKind, ImageApiDraft>;
  imageApiTestMessages: Partial<Record<ImageApiProviderKind, string>>;
  testingImageApiKind: ImageApiProviderKind | "";
  apiKeyDrafts: Record<string, string>;
  credentialMessages: Record<string, string>;
  onDraftsChange: Dispatch<SetStateAction<Record<ImageApiProviderKind, ImageApiDraft>>>;
  setImageApiTestMessages: Dispatch<
    SetStateAction<Partial<Record<ImageApiProviderKind, string>>>
  >;
  setTestingImageApiKind: Dispatch<SetStateAction<ImageApiProviderKind | "">>;
  onAiProvidersChange: (value: AiProviderConfig[]) => void;
  onAiModelsChange: (value: AiModelConfig[]) => void;
  onAiTaskRoutingChange: (value: AiTaskRouting) => void;
  setApiKeyDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  setCredentialMessages: Dispatch<SetStateAction<Record<string, string>>>;
  setSecretStoreStatus: (value: SecretStoreStatus | null) => void;
  onSelectedProviderChange: (value: string) => void;
}) {
  const { t } = useLearningUi();
  function updateDraft(kind: ImageApiProviderKind, nextDraft: ImageApiDraft) {
    onDraftsChange((current) => ({
      ...current,
      [kind]: nextDraft,
    }));
  }

  async function saveImageApiProvider(kind: ImageApiProviderKind) {
    const draft = drafts[kind];
    const config = IMAGE_API_PROVIDER_CONFIG[kind];
    const providerName = draft.providerName.trim();
    const baseUrl = draft.baseUrl.trim();
    const modelId = draft.modelId.trim();

    if (!providerName) {
      updateDraft(kind, { ...draft, error: "请先填写服务名称。" });
      return;
    }

    if (!baseUrl) {
      updateDraft(kind, { ...draft, error: "请先填写图片 API Base URL。" });
      return;
    }

    if (!modelId) {
      updateDraft(kind, { ...draft, error: "请先填写图片模型 ID。" });
      return;
    }

    let generationEndpoint: string;
    let editEndpoint: string;
    try {
      generationEndpoint = buildOpenAiImagesEndpoint(baseUrl, "generation");
      editEndpoint = buildOpenAiImagesEndpoint(baseUrl, "edit");
    } catch (error) {
      updateDraft(kind, {
        ...draft,
        error: error instanceof Error ? error.message : "图片 API 地址格式不正确。",
      });
      return;
    }

    const existingProvider = findImageApiProvider(kind, aiProviders);
    const providerId = existingProvider?.id ?? createId();
    const providerFromPreset = createCustomAiProviderConfig({
      presetId: config.presetId,
      id: providerId,
      name: providerName,
      baseUrl,
      apiKeyRequired: true,
    });
    let providerToSave = normalizeProviderForSimpleUi({
      ...providerFromPreset,
      name: providerName,
      displayName: providerName,
      baseUrl,
      adapterProtocol: "openai_images",
      endpointMode: "image_generations",
      customEndpointPath: "",
      authMode: "bearer",
      authHeaderName: "",
      apiKeyRequired: true,
      enabled: true,
      connectionVerification: existingProvider?.connectionVerification ?? { status: "unverified" },
      credentialRef: existingProvider?.credentialRef ?? "",
      apiKeyRef: existingProvider?.apiKeyRef ?? "",
      notes: `图片生成：${generationEndpoint}；图片编辑：${editEndpoint}`,
    });

    const draftSecret =
      draft.apiKeyDraft.trim() || apiKeyDrafts[providerId]?.trim() || "";

    if (draftSecret) {
      const result = await saveProviderCredential(providerToSave, draftSecret);
      setSecretStoreStatus(result.status);
      setCredentialMessages((current) => ({
        ...current,
        [providerId]: result.message,
      }));

      if (result.provider) {
        providerToSave = result.provider;
      }
    }

    const existingModel =
      aiModels.find(
        (model) =>
          model.providerId === providerId &&
          (model.capabilities.includes("image") || !model.modelId.trim()),
      ) ?? aiModels.find((model) => model.providerId === providerId);

    const imageModel = {
      ...createCustomAiModelConfig(providerToSave, {
        id: existingModel?.id,
        displayName: draft.modelDisplayName.trim() || modelId,
        modelId,
        modelName: modelId,
        enabled: true,
        supportsText: false,
        supportsVision: false,
        supportsStructuredOutput: false,
        supportsReasoning: false,
        supportsStreaming: false,
        capabilities: ["image"],
        capabilityVerification:
          existingModel?.modelId.trim() === modelId
            ? existingModel.capabilityVerification
            : {
                text: "unverified",
                image: "unverified",
                structuredOutput: "unverified",
                reasoning: "unverified",
                streaming: "unverified",
              },
      }),
      capabilityVerificationDetails:
        existingModel?.modelId.trim() === modelId
          ? existingModel.capabilityVerificationDetails
          : undefined,
    };

    onAiProvidersChange(upsertById(aiProviders, providerToSave));
    onAiModelsChange(upsertById(aiModels.filter((model) => model.providerId !== providerId || model.id === imageModel.id), imageModel));
    onAiTaskRoutingChange({
      ...aiTaskRouting,
      imageGeneration: {
        providerId,
        modelId: imageModel.id,
        enabled: true,
        requireUserConfirmForRemote: true,
        contentPolicy: "default",
      },
      imageEditing: {
        providerId,
        modelId: imageModel.id,
        enabled: true,
        requireUserConfirmForRemote: true,
        contentPolicy: "default",
      },
    });
    onSelectedProviderChange(providerId);
    setApiKeyDrafts((current) => ({
      ...current,
      [providerId]: "",
    }));
    updateDraft(kind, {
      ...draft,
      apiKeyDraft: "",
      error: "",
    });
  }

  async function validateImageApiGeneration(kind: ImageApiProviderKind) {
    const draft = drafts[kind];
    const provider = findImageApiProvider(kind, aiProviders);
    const model = provider
      ? aiModels.find((item) => item.providerId === provider.id && item.capabilities.includes("image"))
      : undefined;
    const modelId = draft.modelId.trim() || model?.modelId.trim() || "";

    if (!provider || !model) {
      updateDraft(kind, {
        ...draft,
        error: "请先保存图片配置，再验证文生图接口。",
      });
      return;
    }

    if (!modelId) {
      updateDraft(kind, {
        ...draft,
        error: "请先填写图片模型 ID。",
      });
      return;
    }

    const draftSecret = draft.apiKeyDraft.trim();
    const savedSecret = provider.credentialRef
      ? await readCredentialSecret(provider.credentialRef)
      : provider.apiKeyRef?.trim();
    const apiKey = draftSecret || savedSecret || "";

    if (!apiKey) {
      updateDraft(kind, {
        ...draft,
        error: "请先填写并保存 API 密钥，再验证文生图接口。",
      });
      return;
    }

    setTestingImageApiKind(kind);
    setImageApiTestMessages((current) => ({
      ...current,
      [kind]: "正在请求 Images API 生成一张最小测试图片…",
    }));

    try {
      const result = await generateOpenAiImage({
        baseUrl: draft.baseUrl.trim() || provider.baseUrl,
        apiKey,
        modelId,
        prompt:
          "Create a minimal clean verification image containing the word VERNIQ. No extra text.",
        size: "1254x1254",
        outputFormat: "png",
        quality: "low",
        moderation: "auto",
        n: 1,
        timeoutMs: provider.timeoutMs ?? 120000,
      });

      setImageApiTestMessages((current) => ({
        ...current,
        [kind]: `验证成功：Images API 已返回 ${result.images.length} 张图片。请求地址：${result.endpoint}`,
      }));
      const verifiedAt = new Date().toISOString();
      onAiProvidersChange(
        replaceById(aiProviders, {
          ...provider,
          connectionVerification: {
            status: "verified",
            checkedAt: verifiedAt,
            requestUrl: result.endpoint,
            message: "Images API 文生图验证成功。",
          },
        }),
      );
      onAiModelsChange(
        replaceById(aiModels, {
          ...model,
          capabilityVerification: {
            ...model.capabilityVerification,
            image: "verified",
          },
          capabilityVerificationDetails: {
            ...model.capabilityVerificationDetails,
            image: {
              status: "verified",
              checkedAt: verifiedAt,
              requestUrl: result.endpoint,
              message: "Images API 文生图验证成功。",
            },
          },
        }),
      );
    } catch (error) {
      const failedAt = new Date().toISOString();
      const message =
        error instanceof Error
          ? error.message
          : "请检查图片 API 地址、API 密钥和模型 ID。";
      const requestUrl = previewOpenAiImagesEndpoint(
        draft.baseUrl.trim() || provider.baseUrl,
        "generation",
      );
      setImageApiTestMessages((current) => ({
        ...current,
        [kind]: `验证失败：${message}`,
      }));
      onAiProvidersChange(
        replaceById(aiProviders, {
          ...provider,
          connectionVerification: {
            status: "failed",
            checkedAt: failedAt,
            requestUrl,
            message,
          },
        }),
      );
      onAiModelsChange(
        replaceById(aiModels, {
          ...model,
          capabilityVerification: {
            ...model.capabilityVerification,
            image: "failed",
          },
          capabilityVerificationDetails: {
            ...model.capabilityVerificationDetails,
            image: {
              status: "failed",
              checkedAt: failedAt,
              requestUrl,
              message,
            },
          },
        }),
      );
    } finally {
      setTestingImageApiKind("");
    }
  }

  return (
    <section className="rounded-[1.5rem] border border-stone-200 bg-[#fbfaf7] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-stone-950">{t("图片生成与编辑")}</p>
          <p className="mt-2 max-w-3xl text-xs leading-6 text-stone-500">
            {t("这是生图和图片编辑的独立入口，使用 Images API。图片文字提取仍走 Chat Completions 图片输入，两者不共用 endpoint。")}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {(["dragtoken-relay", "openai-native"] as const).map((kind) => (
          <ImageApiProviderPanel
            key={kind}
            kind={kind}
            draft={drafts[kind]}
            providers={aiProviders}
            models={aiModels}
            credentialMessages={credentialMessages}
            onChange={(draft) => updateDraft(kind, draft)}
            onSave={() => void saveImageApiProvider(kind)}
            onValidate={() => void validateImageApiGeneration(kind)}
            validationMessage={imageApiTestMessages[kind]}
            validating={testingImageApiKind === kind}
          />
        ))}
      </div>
    </section>
  );
}

function ImageApiProviderPanel({
  kind,
  draft,
  providers,
  models,
  credentialMessages,
  onChange,
  onSave,
  onValidate,
  validationMessage,
  validating,
}: {
  kind: ImageApiProviderKind;
  draft: ImageApiDraft;
  providers: AiProviderConfig[];
  models: AiModelConfig[];
  credentialMessages: Record<string, string>;
  onChange: (value: ImageApiDraft) => void;
  onSave: () => void;
  onValidate: () => void;
  validationMessage?: string;
  validating: boolean;
}) {
  const { t } = useLearningUi();
  const config = IMAGE_API_PROVIDER_CONFIG[kind];
  const provider = findImageApiProvider(kind, providers);
  const model = provider
    ? models.find((item) => item.providerId === provider.id && item.capabilities.includes("image"))
    : undefined;
  const generationEndpoint = previewOpenAiImagesEndpoint(draft.baseUrl, "generation");
  const editEndpoint = previewOpenAiImagesEndpoint(draft.baseUrl, "edit");
  const savedStatus = provider
    ? `${t("已保存")}${model?.modelId ? ` · ${model.modelId}` : ""}`
    : t("尚未保存");

  return (
    <div className="rounded-[1.25rem] border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-stone-950">{t(config.title)}</p>
          <p className="mt-2 text-xs leading-6 text-stone-500">{t(config.description)}</p>
        </div>
        <span className="rounded-full border border-stone-200 bg-[#fbfaf7] px-3 py-1 text-xs text-stone-600">
          {t(savedStatus)}
        </span>
      </div>

      <div className="mt-4 grid gap-4">
        <TextField
          label={t("服务名称")}
          value={draft.providerName}
          placeholder={config.defaultProviderName}
          onChange={(value) => onChange({ ...draft, providerName: value, error: "" })}
        />
        <TextField
          label={kind === "dragtoken-relay" ? t("图片中转地址") : t("OpenAI 图片 API Base URL")}
          value={draft.baseUrl}
          placeholder={config.defaultBaseUrl}
          description={
            kind === "dragtoken-relay"
              ? t("默认来自 DragToken 文档，可替换为服务商提供的新地址。通常以 /v1 结尾。")
              : t("OpenAI 原生默认 https://api.openai.com/v1。")
          }
          onChange={(value) => onChange({ ...draft, baseUrl: value, error: "" })}
        />
        <TextField
          label={t("API 密钥")}
          value={draft.apiKeyDraft}
          type="password"
          placeholder={provider?.credentialRef || provider?.apiKeyRef ? t("已保存；需要更新时重新粘贴") : t("粘贴 API 密钥")}
          onChange={(value) => onChange({ ...draft, apiKeyDraft: value, error: "" })}
        />
        <div className="grid gap-4 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]">
          <TextField
            label={t("显示名称（选填）")}
            value={draft.modelDisplayName}
            placeholder={config.defaultModelDisplayName}
            onChange={(value) => onChange({ ...draft, modelDisplayName: value, error: "" })}
          />
          <TextField
            label={t("图片模型 ID（必填）")}
            value={draft.modelId}
            placeholder={config.defaultModelId || "填写服务商提供的图片模型 ID"}
            description={t("模型 ID 会原样发送给图片服务，不会自动改成 Mini、Auto 或 Thinking。")}
            onChange={(value) => onChange({ ...draft, modelId: value, error: "" })}
          />
        </div>
        <ReadOnlyInfoField
          label={t("文生图请求地址")}
          value={generationEndpoint}
          description={t("程序会自动拼接 /images/generations；不要填写 Chat Completions endpoint。")}
        />
        <ReadOnlyInfoField
          label={t("图片编辑请求地址")}
          value={editEndpoint}
          description={t("程序会自动拼接 /images/edits。")}
        />
      </div>

      {draft.error ? (
        <p className="mt-4 rounded-2xl bg-orange-50 px-4 py-3 text-sm leading-7 text-orange-700">
          {t(draft.error)}
        </p>
      ) : null}
      {provider && credentialMessages[provider.id] ? (
        <p className="mt-4 rounded-2xl bg-[#fbfaf7] px-4 py-3 text-sm leading-7 text-stone-700">
          {t(credentialMessages[provider.id])}
        </p>
      ) : null}
      {validationMessage ? (
        <p className="mt-4 rounded-2xl bg-[#fbfaf7] px-4 py-3 text-sm leading-7 text-stone-700">
          {t(validationMessage)}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-4">
        <p className="text-xs leading-6 text-stone-500">
          {t("协议：OpenAI Images API · 认证方式：Bearer Token")}<br />
          {kind === "dragtoken-relay"
            ? t("DragToken 文档推荐海外画图路线；Base URL 和模型 ID 均可替换。")
            : t("OpenAI 原生图片路线独立保存，不与中转混用。")}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSave}
            className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700"
          >
            {t("保存图片配置")}</button>
          <button
            type="button"
            disabled={validating}
            onClick={onValidate}
            className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 disabled:opacity-50"
          >
            {validating ? t("验证中…") : t("验证文生图")}
          </button>
        </div>
      </div>
    </div>
  );
}

function NewProviderForm({
  draft,
  onChange,
  onCancel,
  onCreate,
}: {
  draft: NewProviderDraft;
  onChange: (value: NewProviderDraft) => void;
  onCancel: () => void;
  onCreate: () => void;
}) {
  const { t } = useLearningUi();
  const isOpenAiCompatible = draft.adapterProtocol === "openai_chat_completions";
  const isImageService = draft.purpose === "image";
  const presetOptions = CUSTOM_AI_SERVICE_PRESETS.map((preset) => ({
      value: preset.id,
      label: preset.label,
    }));
  const protocolOptions = [
    { value: "openai_chat_completions", label: "OpenAI Chat Completions" },
    { value: "gemini_native", label: "Gemini native · generateContent" },
    { value: "anthropic_messages", label: "Anthropic Messages" },
  ];

  function updatePreset(presetId: NewProviderDraft["presetId"]) {
    onChange(applyProviderPresetToDraft(draft, presetId));
  }

  function updateProtocol(protocol: NonNullable<AiProviderConfig["adapterProtocol"]>) {
    const isLocal = protocol === "openai_chat_completions" && draft.providerFamily === "local";
    const providerType =
      isLocal
        ? "local"
        : protocol === "openai_chat_completions"
          ? "openai_compatible"
          : "openai_official";
    const providerFamily =
      protocol === "gemini_native"
        ? "gemini"
        : protocol === "anthropic_messages"
          ? "anthropic"
          : isLocal
            ? "local"
            : draft.providerFamily === "kimi" || draft.providerFamily === "minimax"
              ? draft.providerFamily
              : "custom";
    const authMode =
      protocol === "gemini_native"
        ? "google_api_key"
        : protocol === "anthropic_messages"
          ? "anthropic_api_key"
          : isLocal
            ? "none"
            : "bearer";

    onChange({
      ...draft,
      adapterProtocol: protocol,
      providerType,
      providerFamily,
      connectionMode: providerType === "openai_compatible" ? "custom_base_url" : "official",
      endpointMode:
        protocol === "gemini_native"
          ? "gemini_generate_content"
          : protocol === "anthropic_messages"
            ? "anthropic_messages"
            : "chat_completions",
      customEndpointPath:
        draft.purpose === "image" && protocol === "openai_chat_completions"
          ? ""
          : protocol === "openai_chat_completions"
          ? "/v1/chat/completions"
          : protocol === "gemini_native"
            ? "/models/{modelId}:generateContent"
            : "/messages",
      authMode,
      apiKeyRequired: authMode !== "none",
    });
  }

  return (
    <section id="ai-service-create-form" className="rounded-[1.5rem] border border-stone-200 bg-[#fbfaf7] p-4 sm:p-5">
      <div>
        <p className="text-sm font-semibold text-stone-950">
          {isImageService ? t("配置图片 AI 服务") : t("添加 AI 服务")}
        </p>
        <p className="mt-2 text-xs leading-6 text-stone-500">
          {isImageService
            ? t("填写图片文字提取使用的中转地址、API 密钥和准确模型 ID。Endpoint 会按官方 Chat Completions 规则自动生成。")
            : t("预设只用于快速填表。模型 ID 可自由填写；保存后可验证连接，并继续添加更多模型。")}
        </p>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {isImageService ? (
          <>
            <TextField
              label={t("服务名称")}
              value={draft.name}
              placeholder={t("图片文字提取中转")}
              onChange={(value) => onChange({ ...draft, name: value, error: "" })}
            />
            <TextField
              label={t("图片中转地址")}
              value={draft.baseUrl}
              placeholder={t("例如：https://api.example.com/v1")}
              description={t("填写中转服务提供的 API Base URL，通常以 /v1 结尾。")}
              onChange={(value) => onChange({ ...draft, baseUrl: value, error: "" })}
            />
            {draft.authMode !== "none" ? (
              <TextField
                label={t("API 密钥")}
                value={draft.apiKeyDraft}
                type="password"
                placeholder={t("粘贴图片中转 API 密钥")}
                onChange={(value) => onChange({ ...draft, apiKeyDraft: value })}
              />
            ) : null}
            <TextField
              label={t("图片模型 ID（必填）")}
              value={draft.initialModelId}
              placeholder={t("填写中转服务提供的准确视觉模型 ID")}
              description={t("模型 ID 会原样发送给服务商，不会自动改成 Mini、Auto 或 Thinking。")}
              onChange={(value) => onChange({ ...draft, initialModelId: value, error: "" })}
            />
            <TextField
              label={t("显示名称（选填）")}
              value={draft.initialModelDisplayName}
              placeholder={t("例如：图片文字提取模型")}
              onChange={(value) =>
                onChange({ ...draft, initialModelDisplayName: value, error: "" })
              }
            />
            <ReadOnlyInfoField
              label={t("实际请求地址")}
              value={previewOpenAiCompatibleChatEndpoint(draft.baseUrl)}
              description={t("图片文字提取使用 Chat Completions 图片输入。不要填写图片生成 endpoint。")}
            />
          </>
        ) : (
          <>
            <SelectField
              label={t("服务预设")}
              value={draft.presetId}
              options={presetOptions}
              onChange={(value) => updatePreset(value as NewProviderDraft["presetId"])}
            />
            <TextField
              label={t("服务名称")}
              value={draft.name}
              placeholder={t("例如：我的 Kimi 中转")}
              onChange={(value) => onChange({ ...draft, name: value, error: "" })}
            />
            <TextField
              label={t("服务地址")}
              value={draft.baseUrl}
              placeholder={t("例如：https://api.example.com/v1")}
              onChange={(value) => onChange({ ...draft, baseUrl: value, error: "" })}
            />
            {isOpenAiCompatible ? (
              <TextField
                label="Endpoint"
                value={draft.customEndpointPath}
                placeholder="/v1/chat/completions"
                onChange={(value) =>
                  onChange({
                    ...draft,
                    endpointMode: "custom",
                    customEndpointPath: value,
                    error: "",
                  })
                }
              />
            ) : (
              <TextField
                label="Endpoint"
                value={draft.customEndpointPath}
                placeholder={
                  draft.adapterProtocol === "gemini_native"
                    ? "/models/{modelId}:generateContent"
                    : "/messages"
                }
                onChange={(value) => onChange({ ...draft, customEndpointPath: value, error: "" })}
              />
            )}
            {draft.authMode !== "none" ? (
              <TextField
                label={t("API 密钥")}
                value={draft.apiKeyDraft}
                type="password"
                placeholder={t("可稍后再保存")}
                onChange={(value) => onChange({ ...draft, apiKeyDraft: value })}
              />
            ) : null}
          </>
        )}
      </div>

      {!isImageService ? <div className="mt-4 space-y-4">
        <TextModelPresetPicker protocol={draft.adapterProtocol} family={draft.providerFamily}
          onSelect={(modelId) => onChange({ ...draft, initialModelId: modelId, error: "" })} />
        <TextField label={t("模型 ID（必填）")} value={draft.initialModelId} placeholder={t("填写服务商提供的准确模型 ID，可自由输入")}
          onChange={(modelId) => onChange({ ...draft, initialModelId: modelId, error: "" })} />
        <ToggleRow label={t("用于学习分析与发布整理")} checked={draft.setAsDefault}
          onChange={(setAsDefault) => onChange({ ...draft, setAsDefault })} />
        <ReadOnlyInfoField label={t("实际请求地址")} value={t(previewTextEndpoint(draft.baseUrl, draft.adapterProtocol, draft.customEndpointPath, draft.initialModelId))}
          description={t("此地址与连接验证、正式请求共用同一套地址规则。模型访问权限需单独验证。示例使用本服务的第一个模型。")} />
      </div> : null}
      <p className="mt-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-xs leading-6 text-stone-600">
        {t("协议：")}{getDraftProtocolLabel(draft)}{t("。")}
        {isImageService && isOpenAiCompatible
          ? t(" 图片文字提取走 Chat Completions 图片输入，不使用图片生成 endpoint。")
          : t(" 接口地址和模型 ID 可能随服务商更新，请以服务商当前文档为准。")}
      </p>

      <details className="mt-4 rounded-2xl border border-stone-200 bg-white px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-stone-900">
          {t("高级设置")}</summary>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {isImageService ? (
            <ReadOnlyInfoField
              label={t("协议类型")}
              value={t("OpenAI Chat Completions 图片输入")}
              description={t("图片文字提取先固定为兼容 Chat Completions 的视觉模型；图片生成会单独做入口。")}
            />
          ) : (
            <SelectField
              label={t("协议类型")}
              value={draft.adapterProtocol ?? "openai_chat_completions"}
              options={protocolOptions}
              onChange={(value) =>
                updateProtocol(value as NonNullable<AiProviderConfig["adapterProtocol"]>)
              }
            />
          )}
          <SelectField
            label={t("认证方式")}
            value={draft.authMode}
            options={buildAuthModeOptions(draft.adapterProtocol)}
            onChange={(value) =>
              onChange({
                ...draft,
                authMode: value as AiProviderConfig["authMode"],
                apiKeyRequired: value === "none" ? false : draft.apiKeyRequired,
                error: "",
              })
            }
          />
          {draft.authMode === "header" ? (
            <TextField
              label={t("认证 Header 名称")}
              value={draft.authHeaderName}
              placeholder={t("例如：x-api-key")}
              onChange={(value) => onChange({ ...draft, authHeaderName: value, error: "" })}
            />
          ) : null}
          <ToggleRow
            label={t("API 密钥必填")}
            checked={draft.apiKeyRequired}
            onChange={(checked) =>
              onChange({
                ...draft,
                apiKeyRequired: checked,
                authMode:
                  checked && draft.authMode === "none"
                    ? getDefaultAuthModeForProtocol(draft.adapterProtocol)
                    : draft.authMode,
              })
            }
          />
          <NumberField
            label={t("超时时间（毫秒）")}
            value={draft.timeoutMs}
            onChange={(value) => onChange({ ...draft, timeoutMs: value || 45000 })}
          />
        </div>
        <p className="mt-4 text-xs leading-6 text-stone-500">
          {t("额外 Header 仅用于非密钥类 Header。API 密钥请使用上方密钥字段保存。")}</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <TextField
            label={t("Header 名称")}
            value={draft.extraHeaderName}
            placeholder={t("例如：x-client-id")}
            onChange={(value) => onChange({ ...draft, extraHeaderName: value })}
          />
          <TextField
            label={t("Header 值")}
            value={draft.extraHeaderValue}
            placeholder={t("非密钥值")}
            onChange={(value) => onChange({ ...draft, extraHeaderValue: value })}
          />
        </div>
      </details>

      {draft.error ? (
        <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-700">
          {t(draft.error)}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onCreate}
          className="rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-white"
        >
          {isImageService ? t("保存图片服务") : t("创建服务")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700"
        >
          {t("取消")}</button>
      </div>
    </section>
  );
}

function NewModelForm({
  draft,
  provider,
  onChange,
  onCancel,
  onCreate,
}: {
  draft: NewModelDraft;
  provider: AiProviderConfig;
  onChange: (value: NewModelDraft) => void;
  onCancel: () => void;
  onCreate: () => void;
}) {
  const { t } = useLearningUi();
  const technicalOptions = buildTechnicalCapabilityOptions(provider);

  return (
    <section className="rounded-[1.25rem] border border-stone-200 bg-white p-4">
      <p className="text-sm font-semibold text-stone-950">{t("添加模型")}</p>
      <p className="mt-2 text-xs leading-6 text-stone-500">
        {t("模型 ID 会原样发送给服务商，请填写服务商提供的准确名称。")}</p>
      <TextModelPresetPicker protocol={provider.adapterProtocol} family={provider.providerFamily} onSelect={(modelId) => onChange({ ...draft, modelId, error: "" })} />
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(12rem,0.8fr)_minmax(18rem,1.4fr)]">
        <TextField
          label={t("显示名称（选填）")}
          value={draft.displayName}
          placeholder={t("例如：写作模型")}
          onChange={(value) => onChange({ ...draft, displayName: value, error: "" })}
        />
        <TextField
          label={t("模型 ID（必填）")}
          value={draft.modelId}
          placeholder={t("例如：gpt-4o-mini")}
          onChange={(value) => onChange({ ...draft, modelId: value, error: "" })}
        />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChipSelectField
          label={t("技术能力")}
          values={draft.technicalCapabilities}
          options={technicalOptions}
          onToggle={(value) =>
            onChange({
              ...draft,
              technicalCapabilities: toggleSelection(
                draft.technicalCapabilities,
                value as AiModelCapability,
              ),
            })
          }
        />
        <ChipSelectField
          label={t("Verniq 任务用途")}
          values={draft.taskCapabilities}
          options={AI_TASK_CAPABILITY_OPTIONS}
          onToggle={(value) =>
            onChange({
              ...draft,
              taskCapabilities: toggleSelection(
                draft.taskCapabilities,
                value as AiModelCapability,
              ),
            })
          }
        />
        <ToggleRow
          label={t("启用")}
          checked={draft.enabled}
          onChange={(checked) => onChange({ ...draft, enabled: checked })}
        />
        <ToggleRow
          label={t("设为默认")}
          checked={draft.setAsDefault}
          onChange={(checked) => onChange({ ...draft, setAsDefault: checked })}
        />
      </div>
      {draft.error ? (
        <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-700">
          {t(draft.error)}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onCreate}
          className="rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-white"
        >
          {t("创建模型")}</button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700"
        >
          {t("取消")}</button>
      </div>
    </section>
  );
}

function ModelConfigRow({
  model,
  provider,
  aiModels,
  aiTaskRouting,
  connectionTests,
  testingProviderId,
  onAiModelsChange,
  onAiTaskRoutingChange,
  onValidateText,
  onValidateImage,
}: {
  model: AiModelConfig;
  provider: AiProviderConfig;
  aiModels: AiModelConfig[];
  aiTaskRouting: AiTaskRouting;
  connectionTests: Record<string, AiConnectionTestResult>;
  testingProviderId: string;
  onAiModelsChange: (value: AiModelConfig[]) => void;
  onAiTaskRoutingChange: (value: AiTaskRouting) => void;
  onValidateText: () => void;
  onValidateImage: () => void;
}) {
  const { t } = useLearningUi();
  const textTestKey = getCapabilityTestKey(model.id, "text");
  const imageTestKey = getCapabilityTestKey(model.id, "image");
  const textTestResult = connectionTests[textTestKey];
  const imageTestResult = connectionTests[imageTestKey];
  const isDefault = isDefaultModelForAnyTask(model, aiTaskRouting);
  const isBuiltIn = isBuiltInModel(model);
  const isUsed = isModelUsedInRouting(model, aiTaskRouting);
  const providerSupportsImages = aiProviderSupportsImageInput(provider);
  const canValidateImage =
    provider.enabled &&
    providerSupportsImages &&
    model.enabled &&
    Boolean(model.modelId.trim());
  const canRouteImage = aiModelCanRouteImageTask(provider, model);
  const reasoningMappingAvailable = aiProviderHasReasoningParameterMapping(provider);
  const technicalOptions = buildTechnicalCapabilityOptions(provider);
  const verification = {
    text: model.capabilityVerification?.text ?? "unverified",
    image: model.capabilityVerification?.image ?? "unverified",
    structuredOutput: model.capabilityVerification?.structuredOutput ?? "unverified",
    reasoning: model.capabilityVerification?.reasoning ?? "unverified",
    streaming: model.capabilityVerification?.streaming ?? "unverified",
  };

  function handleDeleteModel() {
    if (isBuiltIn) return;

    let nextRouting = aiTaskRouting;

    if (isUsed) {
      const fallback = aiModels.find(
        (item) => item.providerId === model.providerId && item.id !== model.id && item.enabled,
      );

      if (!fallback) {
        window.alert(t("这个模型正在被任务使用，且当前 AI 服务没有其他可用模型。请先添加或选择其他模型。"));
        return;
      }

      if (
        !window.confirm(
          t(`“${getModelDisplayLabel(model)}”正在被任务路由使用。是否删除并改用“${getModelDisplayLabel(fallback)}”？`),
        )
      ) {
        return;
      }

      nextRouting = reassignModelRoutes(aiTaskRouting, model, fallback);
      onAiTaskRoutingChange(nextRouting);
    }

    onAiModelsChange(aiModels.filter((item) => item.id !== model.id));
  }

  return (
    <div className="rounded-[1.25rem] border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-stone-950">
            {getModelDisplayLabel(model)}
          </p>
          <p className="mt-1 text-xs text-stone-500">
            {provider.name} · {model.modelId.trim() || t("尚未填写模型 ID")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span
            className={`rounded-full px-2.5 py-1 ${
              isDefault ? "bg-stone-900 text-white" : "border border-stone-200 text-stone-600"
            }`}
          >
            {isDefault ? t("默认模型") : t("未设为默认")}
          </span>
          <span
            className={`rounded-full px-2.5 py-1 ${
              verification.text === "verified"
                ? "bg-emerald-50 text-emerald-700"
                : verification.text === "failed"
                  ? "bg-amber-50 text-amber-700"
                  : "border border-stone-200 text-stone-600"
            }`}
          >
            {t("文本：")}{t(getVerificationLabel(verification.text))}
          </span>
          <span
            className={`rounded-full px-2.5 py-1 ${
              verification.image === "verified"
                ? "bg-emerald-50 text-emerald-700"
                : verification.image === "failed"
                  ? "bg-amber-50 text-amber-700"
                  : "border border-stone-200 text-stone-600"
            }`}
          >
            {t("图片：")}{t(getImageCapabilityStatusLabel(provider, model))}
          </span>
          {canRouteImage ? (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
              {t("可用于图片文字提取")}</span>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(12rem,0.8fr)_minmax(18rem,1.4fr)]">
        <TextField
          label={t("显示名称（选填）")}
          value={model.displayName}
          placeholder={t("例如：GPT-4o Mini")}
          onChange={(value) =>
            onAiModelsChange(
              replaceById(aiModels, {
                ...model,
                displayName: value,
              }),
            )
          }
        />
        <TextField
          label={t("模型 ID（必填）")}
          value={model.modelId}
          placeholder={t("例如：gpt-4o-mini")}
          description={t("模型 ID 会原样发送给服务商，请填写服务商提供的准确名称。")}
          onChange={(value) =>
            onAiModelsChange(
              replaceById(aiModels, {
                ...model,
                modelId: value,
                modelName: value,
                capabilityVerification: {
                  text: "unverified",
                  image: "unverified",
                  structuredOutput: "unverified",
                  reasoning: "unverified",
                  streaming: "unverified",
                },
                capabilityVerificationDetails: {},
              }),
            )
          }
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,auto)] lg:items-end">
        <ChipSelectField
          label={t("技术能力")}
          values={model.capabilities}
          options={technicalOptions}
          onToggle={(value) =>
            onAiModelsChange(
              replaceById(aiModels, updateModelCapability(model, value as AiModelCapability)),
            )
          }
        />
        <ChipSelectField
          label={t("Verniq 任务用途")}
          values={model.capabilities}
          options={AI_TASK_CAPABILITY_OPTIONS}
          onToggle={(value) =>
            onAiModelsChange(
              replaceById(aiModels, updateModelCapability(model, value as AiModelCapability)),
            )
          }
        />
        <ToggleRow
          label={t("启用")}
          checked={model.enabled}
          onChange={(checked) =>
            onAiModelsChange(
              replaceById(aiModels, {
                ...model,
                enabled: checked,
              }),
            )
          }
        />
      </div>
      {model.supportsReasoning ? (
        <div className="mt-4 rounded-2xl border border-stone-200 bg-[#fbfaf7] px-4 py-3 text-xs leading-6 text-stone-600">
          {reasoningMappingAvailable ? (
            <p>{t("推理参数映射已配置，可在后续版本开放推理强度设置。")}</p>
          ) : (
            <p>{t("当前协议尚未配置推理参数映射。Auto、Mini、Thinking 请作为准确模型 ID 分别添加，不会在请求中自动转换。")}</p>
          )}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isDefault || !model.enabled}
            onClick={() =>
              onAiTaskRoutingChange(makeModelDefaultForSupportedTasks(provider, model, aiTaskRouting))
            }
            className="rounded-full border border-stone-200 bg-[#fbfaf7] px-4 py-2 text-sm font-semibold text-stone-700 disabled:opacity-50"
          >
            {isDefault ? t("已是默认") : t("设为默认")}
          </button>
          {!canValidateImage ? (
            <span className="self-center text-xs text-amber-700">
              {t(getImageValidationDisabledReason(provider, model))}
            </span>
          ) : null}
          <button
            type="button"
            disabled={testingProviderId === textTestKey || !model.enabled}
            onClick={onValidateText}
            className="rounded-full border border-stone-200 bg-[#fbfaf7] px-4 py-2 text-sm font-semibold text-stone-700 disabled:opacity-50"
          >
            {testingProviderId === textTestKey ? t("验证中…") : t("验证文本")}
          </button>
          <button
            type="button"
            disabled={testingProviderId === imageTestKey || !canValidateImage}
            onClick={onValidateImage}
            className="rounded-full border border-stone-200 bg-[#fbfaf7] px-4 py-2 text-sm font-semibold text-stone-700 disabled:opacity-50"
          >
            {testingProviderId === imageTestKey ? t("验证中…") : t("验证图片")}
          </button>
          {!isBuiltIn ? (
            <button
              type="button"
              onClick={handleDeleteModel}
              className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-500 disabled:opacity-50"
            >
              {isUsed ? t("删除并改用其他模型") : t("删除")}
            </button>
          ) : null}
        </div>
        <p className="text-xs leading-6 text-stone-500">
          {isBuiltIn ? t("内置模型可编辑模型 ID，但不能删除。") : t("非内置模型可删除。")}
          {getImageModelHelpText(provider, model)}
          {model.supportsReasoning && !reasoningMappingAvailable ? t(" 当前协议尚未配置推理参数映射。") : ""}
        </p>
      </div>
      {textTestResult ? <ConnectionTestMessage result={textTestResult} /> : null}
      {imageTestResult ? <ConnectionTestMessage result={imageTestResult} /> : null}
    </div>
  );
}

function ConnectionTestMessage({ result }: { result: AiConnectionTestResult }) {
  const { t } = useLearningUi();
  return (
    <p
      className={`mt-3 rounded-2xl px-4 py-3 text-sm leading-7 ${
        result.success ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
      }`}
    >
      <span className="block">{t(result.message)}</span>
      {result.requestUrl ? <span className="mt-1 block break-all text-xs">{t("请求地址：")}{result.requestUrl}</span> : null}
      {result.protocol ? <span className="mt-1 block text-xs">{t("协议：")}{t(getProtocolLabel(result.protocol))}</span> : null}
      {result.checkedAt ? <span className="mt-1 block text-xs">{t("验证时间：")}{result.checkedAt}</span> : null}
    </p>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  const { t } = useLearningUi();
  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-stone-500">{t(label)}</p>
      <p className="rounded-2xl border border-stone-200 bg-[#fbfaf7] px-4 py-3 text-sm text-stone-700">
        {value}
      </p>
    </div>
  );
}

type ConfigSectionKey =
  | "settings"
  | "ai"
  | "automation"
  | "sources"
  | "categories"
  | "platforms"
  | "products"
  | "rules";

type RuleEditorProps = {
  rule: RoutingRule;
  sourceTypeOptions: Option[];
  categoryOptions: Option[];
  platformOptions: Option[];
  productOptions: Option[];
  onChange: (value: RoutingRule) => void;
};

function RuleEditor({
  rule,
  sourceTypeOptions,
  categoryOptions,
  platformOptions,
  productOptions,
  onChange,
}: RuleEditorProps) {
  const { t } = useLearningUi();
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_160px]">
        <TextField
          label={t("规则名称")}
          value={rule.name}
          onChange={(value) => onChange({ ...rule, name: value })}
        />
        <NumberField
          label={t("优先级")}
          value={rule.priority}
          onChange={(value) => onChange({ ...rule, priority: value })}
        />
      </div>

      <TextAreaField
        label={t("说明")}
        value={rule.description}
        onChange={(value) => onChange({ ...rule, description: value })}
      />

      <div className="rounded-3xl bg-[#fbfaf7] p-4">
        <p className="text-xs font-semibold text-stone-500">{t("当满足这些条件时")}</p>
        <div className="mt-3 space-y-4">
          <ChipSelectField
            label={t("内容类型")}
            values={rule.when.sourceTypeIds ?? []}
            options={sourceTypeOptions}
            onToggle={(value) =>
              onChange({
                ...rule,
                when: {
                  ...rule.when,
                  sourceTypeIds: toggleSelection(rule.when.sourceTypeIds ?? [], value),
                },
              })
            }
          />
          <ChipSelectField
            label={t("分类")}
            values={rule.when.categoryIds ?? []}
            options={categoryOptions}
            onToggle={(value) =>
              onChange({
                ...rule,
                when: {
                  ...rule.when,
                  categoryIds: toggleSelection(rule.when.categoryIds ?? [], value),
                },
              })
            }
          />
          <ChipSelectField
            label={t("内容模块")}
            values={rule.when.moduleIds ?? []}
            options={MODULE_OPTIONS}
            onToggle={(value) =>
              onChange({
                ...rule,
                when: {
                  ...rule.when,
                  moduleIds: toggleSelection(rule.when.moduleIds ?? [], value),
                },
              })
            }
          />
          <ChipSelectField
            label={t("对应产品")}
            values={rule.when.productIds ?? []}
            options={productOptions}
            onToggle={(value) =>
              onChange({
                ...rule,
                when: {
                  ...rule.when,
                  productIds: toggleSelection(rule.when.productIds ?? [], value),
                },
              })
            }
          />
          <TextField
            label={t("关键词")}
            value={(rule.when.keywords ?? []).join("，")}
            placeholder={t("用中文逗号或英文逗号分隔")}
            onChange={(value) =>
              onChange({
                ...rule,
                when: {
                  ...rule.when,
                  keywords: parseCommaList(value),
                },
              })
            }
          />
        </div>
      </div>

      <div className="rounded-3xl bg-[#fbfaf7] p-4">
        <p className="text-xs font-semibold text-stone-500">{t("那就这样整理")}</p>
        <div className="mt-3 space-y-4">
          <ChipSelectField
            label={t("通常发去哪里")}
            values={rule.then.platformIds}
            options={platformOptions}
            onToggle={(value) =>
              onChange({
                ...rule,
                then: {
                  ...rule.then,
                  platformIds: toggleSelection(rule.then.platformIds, value),
                },
              })
            }
          />
          <ChipSelectField
            label={t("可以整理成什么")}
            values={rule.then.outputFormats}
            options={OUTPUT_FORMAT_OPTIONS}
            onToggle={(value) =>
              onChange({
                ...rule,
                then: {
                  ...rule.then,
                  outputFormats: toggleSelection(
                    rule.then.outputFormats,
                    value as OutputFormat,
                  ),
                },
              })
            }
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
                    label={t("发布方式")}
              value={rule.then.publishMode}
              options={Object.entries(PUBLISH_MODE_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
              onChange={(value) =>
                onChange({
                  ...rule,
                  then: {
                    ...rule.then,
                    publishMode: value as RoutingRule["then"]["publishMode"],
                  },
                })
              }
            />
            <SelectField
              label={t("整理程度")}
              value={rule.then.rewriteDepth}
              options={Object.entries(REWRITE_DEPTH_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
              onChange={(value) =>
                onChange({
                  ...rule,
                  then: {
                    ...rule.then,
                    rewriteDepth: value as RoutingRule["then"]["rewriteDepth"],
                  },
                })
              }
            />
          </div>
          <TextAreaField
            label={t("默认下一步")}
            value={rule.then.defaultCTA ?? ""}
            onChange={(value) =>
              onChange({
                ...rule,
                then: {
                  ...rule.then,
                  defaultCTA: value,
                },
              })
            }
          />
        </div>
      </div>

      <ToggleRow
        label={t("启用")}
        checked={rule.enabled}
        onChange={(checked) => onChange({ ...rule, enabled: checked })}
      />
    </div>
  );
}

function AiModeButton({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  const { t } = useLearningUi();
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${
        active
          ? "border-stone-900 bg-stone-900 text-white"
          : "border-stone-200 bg-[#fbfaf7] text-stone-700 hover:border-stone-300"
      }`}
    >
      <span className="block text-sm font-semibold">{t(title)}</span>
      <span className={`mt-2 block text-xs leading-6 ${active ? "text-stone-200" : "text-stone-500"}`}>
        {t(description)}
      </span>
    </button>
  );
}

function getAiUseMode(privacySettings: AiPrivacySettings): "off" | "remote" | "local" {
  if (privacySettings.onlyUseLocalModels) return "local";
  if (!privacySettings.allowRemoteAi) return "off";
  return "remote";
}

function getAiUseModeLabel(value: "off" | "remote" | "local") {
  if (value === "off") return zhCNCopy.settings.aiNoAi;
  if (value === "local") return zhCNCopy.settings.aiLocal;
  return zhCNCopy.settings.aiRemote;
}

function describeCredential(provider: AiProviderConfig) {
  if (provider.authMode === "none") {
    return "无需密钥";
  }

  if (provider.credentialRef?.trim()) {
    return "已保存密钥";
  }

  if (provider.apiKeyRef?.trim()) {
    return `旧明文 API 密钥：${maskApiKey(provider.apiKeyRef)}`;
  }

  return "尚未保存密钥";
}

function getAuthModeLabel(authMode: AiProviderConfig["authMode"]) {
  if (authMode === "none") return "无需认证";
  if (authMode === "header") return "自定义请求头";
  if (authMode === "google_api_key") return "Google API 密钥";
  if (authMode === "anthropic_api_key") return "Anthropic API 密钥";
  return "Bearer Token";
}

function getProtocolLabel(protocol: NonNullable<AiProviderConfig["adapterProtocol"]>) {
  if (protocol === "gemini_native") return "Gemini native";
  if (protocol === "anthropic_messages") return "Anthropic Messages";
  if (protocol === "custom_rest") return "Custom REST";
  return "OpenAI Chat Completions";
}

function CredentialStorageNotice({ status }: { status: SecretStoreStatus | null }) {
  const { t } = useLearningUi();
  const storeKind = status?.kind ?? createSecretStore().kind;
  const modeMessage =
    storeKind === "desktop_os"
      ? "密钥将安全保存在系统凭据存储中，不会写入工作区文件。"
      : "网页模式只在当前会话中临时保存密钥，关闭或清理浏览器数据后需要重新填写。";
  const warning = status?.warning;

  return (
    <div className="space-y-1 rounded-2xl bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-800">
      <p>{t(modeMessage)}</p>
      {warning ? <p>{t(warning)}</p> : null}
    </div>
  );
}

function buildAuthModeOptions(protocol: AiProviderConfig["adapterProtocol"]) {
  if (protocol === "gemini_native") {
    return [{ value: "google_api_key", label: "Google API 密钥" }];
  }

  if (protocol === "anthropic_messages") {
    return [{ value: "anthropic_api_key", label: "Anthropic API 密钥" }, { value: "bearer", label: "Bearer Token" }, { value: "header", label: "自定义请求头" }];
  }

  return [
    { value: "bearer", label: "Bearer Token" },
    { value: "header", label: "自定义请求头" },
    { value: "none", label: "无需认证" },
  ];
}

function getDefaultAuthModeForProtocol(
  protocol: AiProviderConfig["adapterProtocol"],
): AiProviderConfig["authMode"] {
  if (protocol === "gemini_native") return "google_api_key";
  if (protocol === "anthropic_messages") return "anthropic_api_key";
  return "bearer";
}

function getDraftProtocolLabel(draft: NewProviderDraft) {
  if (draft.adapterProtocol === "gemini_native") return "Gemini native · generateContent";
  if (draft.adapterProtocol === "anthropic_messages") return "Anthropic Messages";
  if (draft.providerType === "local") return "OpenAI-compatible local";
  return "OpenAI Chat Completions";
}

async function saveProviderCredential(provider: AiProviderConfig, draftSecret: string): Promise<{
  provider?: AiProviderConfig;
  status: SecretStoreStatus;
  message: string;
}> {
  const secret = draftSecret.trim();
  const store = createSecretStore();
  const status = await store.getStatus();

  if (!secret) {
    return {
      status,
      message: "请输入 API 密钥后再保存。",
    };
  }

  const credentialRef = provider.credentialRef?.trim() || createCredentialRef(provider.id);

  if (await store.isAvailable()) {
    await store.saveSecret(credentialRef, secret);

    return {
      status,
      provider: {
        ...provider,
        credentialRef,
      },
      message:
        status.kind === "web_session"
          ? "密钥已保存到当前会话，关闭或清理浏览器数据后需要重新填写。"
          : "密钥已保存到系统凭据存储，不会写入工作区文件。",
    };
  }

  return {
    status,
    message: "系统凭据存储当前不可用，API 密钥没有保存，也不会写入工作区文件。",
  };
}

async function migrateLegacyCredential(provider: AiProviderConfig, t: (text: string) => string): Promise<{
  provider?: AiProviderConfig;
  status: SecretStoreStatus;
  message: string;
}> {
  const legacySecret = provider.apiKeyRef?.trim();
  const store = createSecretStore();
  const status = await store.getStatus();

  if (!legacySecret) {
    return {
      status,
      message: "没有旧明文密钥可以迁移。",
    };
  }

  if (
    typeof window !== "undefined" &&
    !window.confirm(t("是否把这条旧的明文 API 密钥迁移到系统凭据存储？"))
  ) {
    return {
      status,
      message: "迁移已取消，旧明文密钥保持不变。",
    };
  }

  if (!(await store.isAvailable())) {
    return {
      status,
      message: "安全凭据存储当前不可用，旧明文密钥保持不变。",
    };
  }

  const credentialRef = provider.credentialRef?.trim() || createCredentialRef(provider.id);
  await store.saveSecret(credentialRef, legacySecret);

  return {
    status,
    provider: {
      ...provider,
      credentialRef,
      apiKeyRef: "",
    },
    message: "旧明文密钥已迁移到系统凭据存储，并已从 AI 服务配置中清空。",
  };
}

function isSupportedAiProvider(provider: AiProviderConfig) {
  return (
    (SUPPORTED_AI_PROVIDER_IDS as readonly string[]).includes(provider.id) ||
    provider.adapterProtocol === "openai_chat_completions" ||
    provider.adapterProtocol === "gemini_native" ||
    provider.adapterProtocol === "anthropic_messages" ||
    provider.providerType === "openai_compatible" ||
    provider.providerType === "local"
  );
}

function createNewProviderDraft(
  presetId: NewProviderDraft["presetId"] = "openai-compatible",
  purpose: NewProviderDraft["purpose"] = "general",
): NewProviderDraft {
  const preset =
    CUSTOM_AI_SERVICE_PRESETS.find((item) => item.id === presetId) ??
    CUSTOM_AI_SERVICE_PRESETS[0];
  const isImageCompatible =
    purpose === "image" && preset.adapterProtocol === "openai_chat_completions";

  return {
    presetId: preset.id,
    purpose,
    name: isImageCompatible ? "图片文字提取中转" : preset.label,
    baseUrl: preset.baseUrl,
    adapterProtocol: preset.adapterProtocol,
    providerType: preset.providerType,
    providerFamily: preset.providerFamily,
    connectionMode: preset.connectionMode,
    endpointMode: preset.endpointMode,
    customEndpointPath:
      isImageCompatible
        ? ""
        : preset.adapterProtocol === "gemini_native"
        ? "/models/{modelId}:generateContent"
        : preset.adapterProtocol === "anthropic_messages"
          ? "/messages"
          : "/v1/chat/completions",
    authMode: preset.authMode,
    authHeaderName: "",
    apiKeyRequired: preset.apiKeyRequired,
    apiKeyDraft: "",
    extraHeaderName: "",
    extraHeaderValue: "",
    timeoutMs: preset.providerType === "local" ? 120000 : 180000,
    initialModelDisplayName: isImageCompatible ? "图片文字提取模型" : "",
    initialModelId: "",
    setAsDefault: purpose !== "image",
    error: "",
  };
}

function applyProviderPresetToDraft(
  draft: NewProviderDraft,
  presetId: NewProviderDraft["presetId"],
): NewProviderDraft {
  const next = createNewProviderDraft(presetId, draft.purpose);

  return {
    ...next,
    purpose: draft.purpose,
    apiKeyDraft: draft.apiKeyDraft,
    extraHeaderName: draft.extraHeaderName,
    extraHeaderValue: draft.extraHeaderValue,
    initialModelDisplayName: draft.initialModelDisplayName,
    initialModelId: draft.initialModelId,
    setAsDefault: draft.setAsDefault,
  };
}

function createNewModelDraft(providerId: string): NewModelDraft {
  return {
    providerId,
    displayName: "",
    modelId: "",
    technicalCapabilities: ["text"],
    taskCapabilities: ["analysis", "rewrite", "publish_package", "video_script"],
    enabled: true,
    setAsDefault: false,
    error: "",
  };
}

function createImageApiDraft(
  kind: ImageApiProviderKind,
  providers: AiProviderConfig[],
  models: AiModelConfig[],
): ImageApiDraft {
  const config = IMAGE_API_PROVIDER_CONFIG[kind];
  const provider = findImageApiProvider(kind, providers);
  const model = provider
    ? models.find((item) => item.providerId === provider.id && item.capabilities.includes("image"))
    : undefined;

  return {
    providerName: provider?.displayName?.trim() || provider?.name?.trim() || config.defaultProviderName,
    baseUrl: provider?.baseUrl?.trim() || config.defaultBaseUrl,
    modelDisplayName:
      model?.displayName?.trim() || config.defaultModelDisplayName,
    modelId: model?.modelId?.trim() || config.defaultModelId,
    apiKeyDraft: "",
    error: "",
  };
}

function mergeImageApiDraftFromSaved(current: ImageApiDraft, saved: ImageApiDraft) {
  if (current.error || current.apiKeyDraft) return current;

  return {
    ...saved,
    error: current.error,
    apiKeyDraft: current.apiKeyDraft,
  };
}

function findImageApiProvider(
  kind: ImageApiProviderKind,
  providers: AiProviderConfig[],
) {
  const config = IMAGE_API_PROVIDER_CONFIG[kind];
  const direct = providers.find(
    (provider) =>
      provider.sourcePresetId === config.presetId &&
      provider.adapterProtocol === "openai_images",
  );

  if (direct) return direct;

  if (kind === "dragtoken-relay") {
    return providers.find(
      (provider) =>
        provider.adapterProtocol === "openai_images" &&
        provider.baseUrl.toLowerCase().includes("draw.dragtokens.com"),
    );
  }

  return providers.find(
    (provider) =>
      provider.adapterProtocol === "openai_images" &&
      provider.providerFamily === "openai" &&
      provider.connectionMode === "official",
  );
}

function applyProtocolToProvider(
  provider: AiProviderConfig,
  adapterProtocol: NonNullable<AiProviderConfig["adapterProtocol"]>,
): AiProviderConfig {
  if (adapterProtocol === "gemini_native") {
    return {
      ...provider,
      providerKind: "native",
      providerFamily: "gemini",
      providerType: "openai_official",
      connectionMode: "official",
      adapterProtocol,
      endpointMode: "gemini_generate_content",
      customEndpointPath: "",
      authMode: "google_api_key",
      apiKeyRequired: true,
      isLocal: false,
      isRemote: true,
    };
  }

  if (adapterProtocol === "anthropic_messages") {
    return {
      ...provider,
      providerKind: "native",
      providerFamily: "anthropic",
      providerType: "openai_official",
      connectionMode: "official",
      adapterProtocol,
      endpointMode: "anthropic_messages",
      customEndpointPath: "",
      authMode: "anthropic_api_key",
      apiKeyRequired: true,
      isLocal: false,
      isRemote: true,
    };
  }

  if (adapterProtocol === "openai_images") {
    return {
      ...provider,
      providerKind: provider.providerFamily === "openai" ? "native" : "openai_compatible",
      providerType:
        provider.providerFamily === "openai" ? "openai_official" : "openai_compatible",
      connectionMode:
        provider.providerFamily === "openai" ? "official" : "custom_base_url",
      adapterProtocol,
      endpointMode: "image_generations",
      customEndpointPath: "",
      authMode: "bearer",
      apiKeyRequired: true,
      isLocal: false,
      isRemote: true,
    };
  }

  const isLocal = provider.providerType === "local" || Boolean(provider.isLocal);

  return {
    ...provider,
    providerKind: isLocal ? "local" : "openai_compatible",
    providerType: isLocal ? "local" : "openai_compatible",
    connectionMode: isLocal ? "compatible" : "custom_base_url",
    adapterProtocol,
    endpointMode: provider.endpointMode === "custom" ? "custom" : "chat_completions",
    authMode: isLocal ? provider.authMode : provider.authMode === "none" ? "bearer" : provider.authMode,
    apiKeyRequired: isLocal ? provider.authMode !== "none" : (provider.apiKeyRequired ?? true),
    isLocal,
    isRemote: !isLocal,
  };
}

function normalizeProviderForSimpleUi(provider: AiProviderConfig): AiProviderConfig {
  if (provider.adapterProtocol === "openai_images") {
    const isOpenAiNativeImages =
      provider.providerFamily === "openai" &&
      provider.providerType === "openai_official" &&
      provider.connectionMode === "official";

    return {
      ...provider,
      providerKind: isOpenAiNativeImages ? "native" : "openai_compatible",
      providerType: isOpenAiNativeImages ? "openai_official" : "openai_compatible",
      connectionMode: isOpenAiNativeImages ? "official" : "custom_base_url",
      adapterProtocol: "openai_images",
      endpointMode: "image_generations",
      customEndpointPath: "",
      authMode: "bearer",
      authHeaderName: "",
      apiKeyRequired: true,
      isLocal: false,
      isRemote: true,
    };
  }

  if (isOpenAiProvider(provider)) {
    return {
      ...provider,
      providerKind: "native",
      providerType: "openai_official",
      providerFamily: "openai",
      connectionMode: "official",
      adapterProtocol: "openai_chat_completions",
      endpointMode: "chat_completions",
      baseUrl: "https://api.openai.com/v1",
      authMode: "bearer",
      authHeaderName: "",
      apiKeyRequired: true,
      isLocal: false,
      isRemote: true,
    };
  }

  if (isLmStudioProvider(provider)) {
    return {
      ...provider,
      providerKind: "local",
      providerType: "local",
      providerFamily: "local",
      connectionMode: "compatible",
      adapterProtocol: "openai_chat_completions",
      endpointMode: "chat_completions",
      baseUrl: provider.baseUrl.trim() || "http://localhost:1234/v1",
      customEndpointPath: provider.customEndpointPath ?? "",
      isLocal: true,
      isRemote: false,
      apiKeyRequired: provider.apiKeyRequired ?? (provider.authMode !== "none"),
      allowSensitiveContent: true,
      allowFullMaterial: true,
    };
  }

  if (provider.adapterProtocol === "gemini_native") {
    return {
      ...provider,
      providerKind: "native",
      providerType: "openai_official",
      connectionMode: "official",
      adapterProtocol: "gemini_native",
      endpointMode: "gemini_generate_content",
      baseUrl: provider.baseUrl.trim() || "https://generativelanguage.googleapis.com/v1beta",
      authMode: "google_api_key",
      authHeaderName: "",
      apiKeyRequired: true,
      isLocal: false,
      isRemote: true,
    };
  }

  if (provider.adapterProtocol === "anthropic_messages") {
    return {
      ...provider,
      providerKind: provider.connectionMode === "custom_base_url" ? "openai_compatible" : "native",
      providerType: provider.providerType,
      connectionMode: provider.connectionMode,
      adapterProtocol: "anthropic_messages",
      endpointMode: "anthropic_messages",
      baseUrl: provider.baseUrl.trim() || "https://api.anthropic.com/v1",
      authMode: provider.authMode ?? "anthropic_api_key",
      authHeaderName: provider.authHeaderName ?? "",
      apiKeyRequired: true,
      isLocal: false,
      isRemote: true,
    };
  }

  return {
    ...provider,
    providerKind: "openai_compatible",
    providerType: "openai_compatible",
    providerFamily: provider.providerFamily ?? "custom",
    connectionMode: "custom_base_url",
    adapterProtocol: "openai_chat_completions",
    endpointMode: provider.endpointMode ?? "chat_completions",
    customEndpointPath:
      provider.endpointMode === "custom" ? provider.customEndpointPath ?? "" : "",
    authMode: provider.authMode || "bearer",
    apiKeyRequired: provider.apiKeyRequired ?? (provider.authMode !== "none"),
    extraHeaders: provider.extraHeaders ?? [],
    timeoutMs: provider.timeoutMs ?? 45000,
    isLocal: false,
    isRemote: true,
  };
}

function isOpenAiProvider(provider: AiProviderConfig) {
  return (
    provider.id === DEFAULT_AI_PROVIDER_ID ||
    (provider.providerFamily === "openai" &&
      provider.providerType === "openai_official" &&
      provider.connectionMode === "official")
  );
}

function isLmStudioProvider(provider: AiProviderConfig) {
  return provider.id === "provider-lm-studio" || provider.providerType === "local" || Boolean(provider.isLocal);
}

function getProviderTitle(provider: AiProviderConfig) {
  if (provider.id === DEFAULT_AI_PROVIDER_ID) return "OpenAI 原生";
  if (provider.id === "provider-lm-studio") return "LM Studio";
  if (provider.id === "provider-custom") return "OpenAI-compatible";
  return provider.displayName?.trim() || provider.name || "自定义 AI 服务";
}

function formatProviderBaseUrl(provider: AiProviderConfig) {
  const baseUrl = provider.baseUrl?.trim();

  if (!baseUrl) return "尚未填写";

  try {
    const url = new URL(baseUrl);
    return `${url.protocol}//${url.host}`;
  } catch {
    return baseUrl.length > 42 ? `${baseUrl.slice(0, 39)}…` : baseUrl;
  }
}

function getProviderEndpointLabel(provider: AiProviderConfig) {
  if (provider.adapterProtocol === "openai_images") {
    return "/v1/images/generations · /v1/images/edits";
  }

  if (provider.customEndpointPath?.trim()) return provider.customEndpointPath.trim();
  if (provider.adapterProtocol === "gemini_native") return "/models/{model}:generateContent";
  if (provider.adapterProtocol === "anthropic_messages") return "/messages";
  if (provider.endpointMode === "custom") return provider.customEndpointPath?.trim() || "尚未填写";
  if (
    provider.endpointMode === "chat_completions" ||
    provider.adapterProtocol === "openai_chat_completions"
  ) {
    return "/v1/chat/completions";
  }

  return "按协议默认";
}

function previewOpenAiCompatibleChatEndpoint(baseUrl: string) {
  const value = baseUrl.trim();

  if (!value) return "填写服务地址后自动生成";

  try {
    return buildOpenAiCompatibleEndpoint(value);
  } catch {
    return "服务地址格式正确后自动生成";
  }
}

function previewTextEndpoint(baseUrl: string, protocol?: AiProviderConfig["adapterProtocol"], path?: string, modelId = "{modelId}") {
  if (!baseUrl.trim()) return "填写服务地址后自动生成";
  try {
    return protocol === "gemini_native"
      ? buildGeminiGenerateContentEndpoint(baseUrl, modelId || "{modelId}", path)
      : buildOpenAiCompatibleEndpoint(baseUrl, path || (protocol === "anthropic_messages" ? "/messages" : undefined));
  } catch { return "请检查服务地址与接口路径。"; }
}

function previewOpenAiImagesEndpoint(
  baseUrl: string,
  operation: "generation" | "edit",
) {
  const value = baseUrl.trim();

  if (!value) return "填写图片 API Base URL 后自动生成";

  try {
    return buildOpenAiImagesEndpoint(value, operation);
  } catch {
    return "图片 API Base URL 格式正确后自动生成";
  }
}

function getProviderPanelDescription(provider: AiProviderConfig) {
  if (provider.adapterProtocol === "openai_images") {
    return "用于图片生成和图片编辑。它使用 Images API，不用于图片文字提取或聊天分析。";
  }

  if (isOpenAiProvider(provider)) {
    return "用于 OpenAI 官方 API。常用设置只需要保存 API 密钥并选择可用模型。";
  }

  if (isLmStudioProvider(provider)) {
    return "用于本机 LM Studio。默认不需要 API 密钥。";
  }

  if (provider.providerFamily === "gemini") {
    return "用于 Gemini API。图片输入需要模型支持并通过图片能力验证。";
  }

  if (provider.providerFamily === "anthropic" || provider.providerFamily === "claude") {
    return "用于 Anthropic Messages API。本轮仅支持文本请求。";
  }

  return "用于中转服务或任何 OpenAI-compatible 服务。请填写服务商提供的服务地址、API 密钥和模型 ID。";
}

function getConnectionStatusLabel(result: AiConnectionTestResult) {
  return result.success ? "验证成功" : "验证失败";
}

function getModelDisplayLabel(model: AiModelConfig) {
  return model.displayName.trim() || "未命名模型";
}

function isBuiltInModel(model: AiModelConfig) {
  return DEFAULT_AI_MODELS.some((defaultModel) => defaultModel.id === model.id);
}

function isModelUsedInRouting(model: AiModelConfig, routing: AiTaskRouting) {
  return Object.values(routing).some(
    (route) => route?.providerId === model.providerId && route.modelId === model.id,
  );
}

function isDefaultModelForAnyTask(model: AiModelConfig, routing: AiTaskRouting) {
  return isModelUsedInRouting(model, routing);
}

function makeModelDefaultForSupportedTasks(
  provider: AiProviderConfig,
  model: AiModelConfig,
  routing: AiTaskRouting,
): AiTaskRouting {
  const nextRouting = { ...routing };

  const applyRoute = (key: keyof AiTaskRouting) => {
    nextRouting[key] = {
      ...nextRouting[key],
      providerId: model.providerId,
      modelId: model.id,
    };
  };

  if (model.capabilities.includes("analysis")) {
    applyRoute("analysis");
    applyRoute("languageAnalysis");
    applyRoute("phraseAnalysis");
    applyRoute("sentenceGrammarAnalysis");
    applyRoute("segmentAnalysis");
    applyRoute("feynmanFeedback");
    applyRoute("contentAnalysis");
  }

  if (model.capabilities.includes("rewrite")) {
    applyRoute("rewrite");
    applyRoute("outputDraft");
  }

  if (model.capabilities.includes("publish_package")) {
    applyRoute("publishPackage");
  }

  if (model.capabilities.includes("video_script")) {
    applyRoute("videoScript");
  }

  if (provider.adapterProtocol === "openai_images" && model.capabilities.includes("image")) {
    applyRoute("imageGeneration");
    applyRoute("imageEditing");
  }

  if (aiModelCanRouteImageTask(provider, model)) {
    applyRoute("imageTextExtraction");
  }

  return nextRouting;
}

function reassignModelRoutes(
  routing: AiTaskRouting,
  removedModel: AiModelConfig,
  fallbackModel: AiModelConfig,
): AiTaskRouting {
  const nextRouting = { ...routing };

  (Object.keys(nextRouting) as Array<keyof AiTaskRouting>).forEach((key) => {
    const route = nextRouting[key];

    if (route?.providerId === removedModel.providerId && route.modelId === removedModel.id) {
      nextRouting[key] = {
        ...route,
        providerId: fallbackModel.providerId,
        modelId: fallbackModel.id,
      };
    }
  });

  return nextRouting;
}

function serializeAiRoute(value: AiTaskRouting["analysis"]) {
  return `${value.providerId}::${value.modelId}`;
}

function parseAiRouteValue(value: string): AiTaskRouting["analysis"] {
  const [providerId, modelId] = value.split("::");

  return {
    providerId: providerId ?? "",
    modelId: modelId ?? "",
  };
}

function buildTaskRouteOptions(
  capability: AiModelCapability,
  models: AiModelConfig[],
  providers: AiProviderConfig[],
) {
  const enabledProviderIds = new Set(
    providers.filter((provider) => provider.enabled).map((provider) => provider.id),
  );

  return models
    .filter(
      (item) => {
        const provider = providers.find((providerItem) => providerItem.id === item.providerId);

        return (
          item.enabled &&
          enabledProviderIds.has(item.providerId) &&
          modelMatchesRouteCapability(item, capability, provider)
        );
      },
    )
    .map((item) => {
      const provider = providers.find((providerItem) => providerItem.id === item.providerId);

      return {
        value: `${item.providerId}::${item.id}`,
        label: `${provider?.name ?? "未命名 AI 服务"} · ${getModelDisplayLabel(item)} · ${item.modelId || "未填写模型 ID"}`,
      };
    });
}

function modelMatchesRouteCapability(
  model: AiModelConfig,
  capability: AiModelCapability,
  provider?: AiProviderConfig,
) {
  if (capability === "text") return model.supportsText ?? true;
  if (capability === "vision") {
    return Boolean(provider && aiModelCanRouteImageTask(provider, model));
  }
  if (capability === "image") {
    return Boolean(provider?.adapterProtocol === "openai_images" && model.capabilities.includes("image"));
  }
  if (capability === "structured_output") {
    return Boolean(model.supportsStructuredOutput || model.supportsJsonMode);
  }
  if (capability === "reasoning") return Boolean(model.supportsReasoning);
  if (capability === "streaming") return Boolean(model.supportsStreaming);
  return model.capabilities.includes(capability);
}

function buildTechnicalCapabilityOptions(provider: AiProviderConfig): Option[] {
  const providerSupportsImages = aiProviderSupportsImageInput(provider);

  return AI_TECHNICAL_CAPABILITY_OPTIONS.map((option) =>
    option.value === "vision"
      ? {
          ...option,
          disabled: !providerSupportsImages,
        }
      : option,
  );
}

function updateModelCapability(model: AiModelConfig, capability: AiModelCapability): AiModelConfig {
  const capabilities = toggleSelection(model.capabilities, capability);
  const enabled = capabilities.includes(capability);
  const isTechnicalCapability = ["text", "vision", "structured_output", "reasoning", "streaming"].includes(capability);

  return {
    ...model,
    capabilities,
    supportsText: capability === "text" ? enabled : model.supportsText,
    supportsVision: capability === "vision" ? enabled : model.supportsVision,
    supportsStructuredOutput:
      capability === "structured_output" ? enabled : model.supportsStructuredOutput,
    supportsReasoning: capability === "reasoning" ? enabled : model.supportsReasoning,
    supportsStreaming: capability === "streaming" ? enabled : model.supportsStreaming,
    capabilityVerification: {
      text: capability === "text" ? "unverified" : model.capabilityVerification?.text ?? "unverified",
      image:
        capability === "vision"
          ? "unverified"
          : model.capabilityVerification?.image ?? "unverified",
      structuredOutput: model.capabilityVerification?.structuredOutput ?? "unverified",
      reasoning: model.capabilityVerification?.reasoning ?? "unverified",
      streaming: model.capabilityVerification?.streaming ?? "unverified",
    },
    capabilityVerificationDetails: isTechnicalCapability
      ? {}
      : model.capabilityVerificationDetails,
  };
}

function getImageCapabilityStatusLabel(provider: AiProviderConfig, model: AiModelConfig) {
  if (!aiProviderSupportsImageInput(provider)) return "当前未接入";
  if (!aiModelDeclaresImageInput(model)) return "未声明";
  if (model.capabilityVerification?.image === "verified") return "已验证";
  if (model.capabilityVerification?.image === "failed") return "验证失败";
  return "用户标记，尚未验证";
}

function getImageModelHelpText(provider: AiProviderConfig, model: AiModelConfig) {
  if (!aiProviderSupportsImageInput(provider)) {
    return " 当前协议未接入图片输入。";
  }

  if (aiModelCanRouteImageTask(provider, model)) {
    return " 图片能力已验证，可用于图片文字提取。";
  }

  if (aiModelDeclaresImageInput(model)) {
    return " 图片能力是用户标记；通过图片验证前不会进入图片文字提取路由。";
  }

  return "";
}

function getImageValidationDisabledReason(provider: AiProviderConfig, model: AiModelConfig) {
  if (!model.enabled) return "当前模型未启用，无法验证图片。";
  if (!aiProviderSupportsImageInput(provider)) return "当前服务协议不支持图片输入。";
  if (
    provider.authMode !== "none" &&
    (provider.apiKeyRequired ?? true) &&
    !provider.credentialRef?.trim() &&
    !provider.apiKeyRef?.trim()
  ) {
    return "尚未保存 API 密钥，无法验证。";
  }
  return "该模型的图片能力尚未验证。";
}

function getCapabilityTestKey(modelId: string, capability: "text" | "image") {
  return `${modelId}:${capability}`;
}

function getVerificationLabel(value: "unverified" | "verified" | "failed") {
  if (value === "verified") return "已验证";
  if (value === "failed") return "验证失败";
  return "未验证";
}

function replaceById<T extends { id: string }>(items: T[], nextItem: T) {
  return items.map((item) => (item.id === nextItem.id ? nextItem : item));
}

function upsertById<T extends { id: string }>(items: T[], nextItem: T) {
  return items.some((item) => item.id === nextItem.id)
    ? replaceById(items, nextItem)
    : [nextItem, ...items];
}

function toggleSelection<T extends string>(values: T[], value: T) {
  if (values.includes(value)) {
    return values.filter((item) => item !== value);
  }

  return [...values, value];
}

function parseCommaList(value: string) {
  return value
    .split(/[，,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function ConfigBlock({
  title,
  description,
  summary,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  description: string;
  summary: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const { t } = useLearningUi();
  return (
    <section className="rounded-[1.5rem] border border-stone-200 bg-[#fcfbf8] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-stone-950">{t(title)}</h3>
          <p className="mt-2 text-sm leading-7 text-stone-500">{t(description)}</p>
          {!isOpen ? <p className="mt-3 text-sm text-stone-700">{t(summary)}</p> : null}
        </div>
        <button
          type="button"
          onClick={onToggle}
          className={`rounded-full px-4 py-2 text-sm transition ${
            isOpen
              ? "border border-stone-200 bg-white text-stone-700"
              : "bg-stone-900 text-white"
          }`}
        >
          {isOpen ? t("收起") : t("配置")}
        </button>
      </div>
      {isOpen ? <div className="mt-5">{children}</div> : null}
    </section>
  );
}

function OverviewCard({
  title,
  value,
  detail,
  onClick,
  prominent = false,
}: {
  title: string;
  value: string;
  detail: string;
  onClick: () => void;
  prominent?: boolean;
}) {
  const { t } = useLearningUi();
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-3xl border p-5 text-left transition ${
        prominent
          ? "border-stone-900 bg-stone-900 text-white"
          : "border-stone-200 bg-[#fbfaf7] text-stone-700 hover:bg-white"
      }`}
    >
      <p className={`text-xs font-semibold ${prominent ? "text-stone-200" : "text-stone-500"}`}>
        {t(title)}
      </p>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
      <p className={`mt-2 text-sm ${prominent ? "text-stone-200" : "text-stone-600"}`}>
        {t(detail)}
      </p>
    </button>
  );
}

function ConfigCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[1.5rem] border border-stone-200 bg-white p-4 shadow-sm shadow-stone-200/50">
      <div className="space-y-4">{children}</div>
    </div>
  );
}

type Option = {
  value: string;
  label: string;
  disabled?: boolean;
};

function TextField({
  label,
  value,
  onChange,
  placeholder,
  description,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  description?: string;
  type?: "text" | "password";
}) {
  const { t } = useLearningUi();
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold text-stone-500">{t(label)}</span>
      <input
        type={type}
        value={value}
        placeholder={t(placeholder)}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-stone-200 bg-[#fbfaf7] px-4 py-3 text-sm text-stone-700 outline-none"
      />
      {description ? (
        <span className="mt-2 block text-xs leading-5 text-stone-500">{t(description)}</span>
      ) : null}
    </label>
  );
}

function ReadOnlyInfoField({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description?: string;
}) {
  const { t } = useLearningUi();
  return (
    <div>
      <span className="mb-2 block text-xs font-semibold text-stone-500">{t(label)}</span>
      <div className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700 [overflow-wrap:anywhere]">
        {value}
      </div>
      {description ? (
        <span className="mt-2 block text-xs leading-5 text-stone-500">{t(description)}</span>
      ) : null}
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useLearningUi();
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold text-stone-500">{t(label)}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-24 w-full rounded-2xl border border-stone-200 bg-[#fbfaf7] px-4 py-3 text-sm leading-7 text-stone-700 outline-none"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const { t } = useLearningUi();
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold text-stone-500">{t(label)}</span>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
        className="w-full rounded-2xl border border-stone-200 bg-[#fbfaf7] px-4 py-3 text-sm text-stone-700 outline-none"
      />
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useLearningUi();
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold text-stone-500">{t(label)}</span>
      <div className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-[#fbfaf7] px-4 py-3">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-12 rounded-lg border-0 bg-transparent p-0"
        />
        <span className="text-sm text-stone-600">{value}</span>
      </div>
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<Option>;
  onChange: (value: string) => void;
}) {
  const { t } = useLearningUi();
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold text-stone-500">{t(label)}</span>
      <FullTextSelect
        aria-label={t(label)}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-stone-200 bg-[#fbfaf7] px-4 py-3 text-sm text-stone-700 outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {t(option.label)}
          </option>
        ))}
      </FullTextSelect>
    </label>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  const { t } = useLearningUi();
  return (
    <label className="flex items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-[#fbfaf7] px-4 py-3 text-sm text-stone-700">
      <span className="font-medium">{t(label)}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-stone-900"
      />
    </label>
  );
}

function ChipSelectField({
  label,
  values,
  options,
  onToggle,
}: {
  label: string;
  values: string[];
  options: Option[];
  onToggle: (value: string) => void;
}) {
  const { t } = useLearningUi();
  return (
    <div>
      <p className="text-xs font-semibold text-stone-500">{t(label)}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => {
          const active = values.includes(option.value);
          const disabled = Boolean(option.disabled && !active);

          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => onToggle(option.value)}
              className={`rounded-full px-3 py-2 text-xs transition ${
                disabled
                  ? "border border-stone-200 bg-stone-100 text-stone-400"
                  : active
                  ? "bg-stone-900 text-white"
                  : "border border-stone-200 bg-white text-stone-600"
              }`}
            >
              {t(option.label)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TextModelPresetPicker({ protocol, family, onSelect }: { protocol?: string; family?: string; onSelect: (id: string) => void }) {
  const { t } = useLearningUi();
  const presets = getTextModelPresets(protocol, family);
  if (!presets.length) return null;
  return <div className="mt-3 space-y-2">
    <label className="block text-xs font-semibold text-stone-600">
      {t("模型预设（可选，也可直接输入）")}
      <FullTextSelect aria-label={t("模型预设（可选，也可直接输入）")} value="" onChange={(event) => { if (event.target.value) onSelect(event.target.value); }} className="mt-2 block w-full rounded-xl border border-stone-200 bg-white p-3 text-sm">
        <option value="">{t("选择一个预设填入模型 ID")}</option>
        {presets.map((id) => <option key={id} value={id}>{id}</option>)}
      </FullTextSelect>
    </label>
    <p className="text-xs leading-6 text-stone-500">{t("预设不代表账号已开通。中转别名请直接输入；可获取服务端列表并验证选中的模型。")}</p>
  </div>;
}
