import {
  automationConnections,
  categoryConfigs,
  offers,
  platformConfigs,
  productConfigs,
  routingRules,
  sourceTypeConfigs,
  videoPromptTemplates,
} from "@/src/data/mockData";
import {
  DEFAULT_AI_CONTENT_PREFERENCES,
  DEFAULT_AI_MODELS,
  DEFAULT_AI_PRIVACY_SETTINGS,
  DEFAULT_AI_PROVIDERS,
  DEFAULT_AI_TASK_ROUTING,
  migrateLegacyAiSettings,
  normalizeAiConfiguration,
} from "@/src/lib/aiConfig";
import { DEFAULT_LANGUAGE_SETTINGS, mergeLanguageSettings } from "@/src/lib/languageSettings";
import { normalizeRewrittenOutputs } from "@/src/lib/rewrittenOutputs";
import type { LegacyAiSettings, WorkspaceExport, WorkspaceState } from "@/src/lib/types";
import { validateNestedRecord, validateWorkspaceObjects } from "./recordValidation";

export const WORKSPACE_SCHEMA_VERSION = 5;
export const WORKSPACE_APP_NAME = "my-life-map-web";
const DEMO_CONTENT_ITEM_IDS = new Set([
  "item-ai-agent-review",
  "item-dream-symbol",
  "item-cross-cultural-copy",
  "item-health-routine",
  "item-platform-ecosystem",
]);

const WORKSPACE_ARRAY_FIELDS = [
  "aiProviders",
  "aiModels",
  "automationConnections",
  "recentSavedContentIds",
  "contentPipelineItems",
  "offers",
  "contentConversions",
  "publishPackages",
  "videoPromptTemplates",
  "videoGenerationDrafts",
  "sourceTypeConfigs",
  "categoryConfigs",
  "platformConfigs",
  "productConfigs",
  "routingRules",
  "learningGoals",
  "sourceMaterials",
  "learningSegments",
  "readingSessions",
  "segmentAnalyses",
  "vocabularyItems",
  "expressionItems",
  "grammarNotes",
  "cultureNotes",
  "feynmanNotes",
  "readerMessages",
  "knowledgeNodes",
  "actionItems",
  "outputDrafts",
] as const satisfies ReadonlyArray<keyof WorkspaceState>;

export type WorkspaceValidationResult =
  | {
      valid: true;
      errors: [];
      workspace: WorkspaceState;
    }
  | {
      valid: false;
      errors: string[];
    };

export type WorkspaceImportResult =
  | {
      success: true;
      workspace: WorkspaceState;
    }
  | {
      success: false;
      errors: string[];
    };

export function createDefaultWorkspaceState(): WorkspaceState {
  return cloneValue({
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    languageSettings: DEFAULT_LANGUAGE_SETTINGS,
    aiProviders: DEFAULT_AI_PROVIDERS,
    aiModels: DEFAULT_AI_MODELS,
    aiTaskRouting: DEFAULT_AI_TASK_ROUTING,
    aiContentPreferences: DEFAULT_AI_CONTENT_PREFERENCES,
    aiPrivacySettings: DEFAULT_AI_PRIVACY_SETTINGS,
    automationConnections,
    currentContentId: "",
    recentSavedContentIds: [],
    contentPipelineItems: [],
    offers,
    contentConversions: [],
    publishPackages: [],
    videoPromptTemplates,
    videoGenerationDrafts: [],
    sourceTypeConfigs,
    categoryConfigs,
    platformConfigs,
    productConfigs,
    routingRules,
    learningGoals: [],
    sourceMaterials: [],
    learningSegments: [],
    readingSessions: [],
    segmentAnalyses: [],
    vocabularyItems: [],
    expressionItems: [],
    grammarNotes: [],
    cultureNotes: [],
    feynmanNotes: [],
    readerMessages: [],
    knowledgeNodes: [],
    actionItems: [],
    outputDrafts: [],
  });
}

export function mergeWorkspaceState(
  base: WorkspaceState,
  patch: Partial<WorkspaceState> & {
    aiSettings?: LegacyAiSettings;
  },
): WorkspaceState {
  const migratedAi = patch.aiSettings ? migrateLegacyAiSettings(patch.aiSettings) : null;
  const contentItems = normalizeContentItems(
    filterDemoWorkspaceItems(cloneValue(patch.contentPipelineItems ?? base.contentPipelineItems)),
  );
  const contentIds = new Set(contentItems.map((item) => item.id));
  const currentContentId = resolveCurrentContentId(
    patch.currentContentId ?? base.currentContentId,
    contentIds,
  );
  const recentSavedContentIds = normalizeRecentSavedIds(
    cloneValue(patch.recentSavedContentIds ?? base.recentSavedContentIds),
    contentIds,
    currentContentId,
  );
  const sourceSchemaVersion =
    typeof patch.schemaVersion === "number"
      ? patch.schemaVersion
      : "aiProviders" in patch || "aiModels" in patch || "aiTaskRouting" in patch
        ? 0
        : base.schemaVersion;
  const normalizedAi = normalizeAiConfiguration({
    aiProviders: patch.aiProviders ?? migratedAi?.aiProviders ?? base.aiProviders,
    aiModels: patch.aiModels ?? migratedAi?.aiModels ?? base.aiModels,
    aiTaskRouting: patch.aiTaskRouting ?? migratedAi?.aiTaskRouting ?? base.aiTaskRouting,
    resetLegacyDefaults: sourceSchemaVersion < WORKSPACE_SCHEMA_VERSION,
  });

  return {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    languageSettings: mergeLanguageSettings(patch.languageSettings ?? base.languageSettings),
    aiProviders: normalizedAi.aiProviders,
    aiModels: normalizedAi.aiModels,
    aiTaskRouting: normalizedAi.aiTaskRouting,
    aiContentPreferences: cloneValue(
      patch.aiContentPreferences ??
        migratedAi?.aiContentPreferences ??
        base.aiContentPreferences,
    ),
    aiPrivacySettings: cloneValue(
      patch.aiPrivacySettings ??
        migratedAi?.aiPrivacySettings ??
        base.aiPrivacySettings ??
        DEFAULT_AI_PRIVACY_SETTINGS,
    ),
    automationConnections: cloneValue(
      patch.automationConnections ?? base.automationConnections,
    ),
    currentContentId,
    recentSavedContentIds,
    contentPipelineItems: contentItems,
    offers: cloneValue(patch.offers ?? base.offers),
    contentConversions: filterDemoConversions(
      cloneValue(patch.contentConversions ?? base.contentConversions),
    ),
    publishPackages: filterDemoPublishPackages(
      cloneValue(patch.publishPackages ?? base.publishPackages),
    ),
    videoPromptTemplates: cloneValue(patch.videoPromptTemplates ?? base.videoPromptTemplates),
    videoGenerationDrafts: filterDemoVideoDrafts(
      cloneValue(patch.videoGenerationDrafts ?? base.videoGenerationDrafts),
    ),
    sourceTypeConfigs: cloneValue(patch.sourceTypeConfigs ?? base.sourceTypeConfigs),
    categoryConfigs: cloneValue(patch.categoryConfigs ?? base.categoryConfigs),
    platformConfigs: cloneValue(patch.platformConfigs ?? base.platformConfigs),
    productConfigs: cloneValue(patch.productConfigs ?? base.productConfigs),
    routingRules: cloneValue(patch.routingRules ?? base.routingRules),
    learningGoals: cloneValue(patch.learningGoals ?? base.learningGoals),
    sourceMaterials: cloneValue(patch.sourceMaterials ?? base.sourceMaterials),
    learningSegments: cloneValue(patch.learningSegments ?? base.learningSegments),
    readingSessions: cloneValue(patch.readingSessions ?? base.readingSessions),
    segmentAnalyses: cloneValue(patch.segmentAnalyses ?? base.segmentAnalyses),
    vocabularyItems: cloneValue(patch.vocabularyItems ?? base.vocabularyItems),
    expressionItems: cloneValue(patch.expressionItems ?? base.expressionItems),
    grammarNotes: cloneValue(patch.grammarNotes ?? base.grammarNotes),
    cultureNotes: cloneValue(patch.cultureNotes ?? base.cultureNotes),
    feynmanNotes: cloneValue(patch.feynmanNotes ?? base.feynmanNotes),
    readerMessages: cloneValue(patch.readerMessages ?? base.readerMessages),
    knowledgeNodes: cloneValue(patch.knowledgeNodes ?? base.knowledgeNodes),
    actionItems: cloneValue(patch.actionItems ?? base.actionItems),
    outputDrafts: cloneValue(patch.outputDrafts ?? base.outputDrafts),
  };
}

function normalizeContentItems(items: WorkspaceState["contentPipelineItems"]) {
  return items.map((item) => ({
    ...item,
    rewrittenOutputs: normalizeRewrittenOutputs(item.rewrittenOutputs),
  }));
}

function filterDemoWorkspaceItems(items: WorkspaceState["contentPipelineItems"]) {
  return items.filter((item) => !DEMO_CONTENT_ITEM_IDS.has(item.id));
}

function filterDemoConversions(conversions: WorkspaceState["contentConversions"]) {
  return conversions.filter((item) => !DEMO_CONTENT_ITEM_IDS.has(item.contentItemId));
}

function filterDemoPublishPackages(packages: WorkspaceState["publishPackages"]) {
  return packages.filter((item) => !DEMO_CONTENT_ITEM_IDS.has(item.contentItemId));
}

function filterDemoVideoDrafts(drafts: WorkspaceState["videoGenerationDrafts"]) {
  return drafts.filter((item) => !DEMO_CONTENT_ITEM_IDS.has(item.contentItemId));
}

function resolveCurrentContentId(currentContentId: string | undefined, contentIds: Set<string>) {
  return currentContentId && contentIds.has(currentContentId) ? currentContentId : "";
}

function normalizeRecentSavedIds(
  ids: string[] | undefined,
  contentIds: Set<string>,
  currentContentId: string,
) {
  const filtered = (ids ?? []).filter((id) => contentIds.has(id));

  if (currentContentId && !filtered.includes(currentContentId)) {
    filtered.unshift(currentContentId);
  }

  return [...new Set(filtered)].slice(0, 12);
}

export function exportWorkspaceState(state: WorkspaceState): WorkspaceExport {
  const workspace = mergeWorkspaceState(createDefaultWorkspaceState(), state);
  workspace.aiProviders = workspace.aiProviders.map(provider => ({
    ...provider,
    apiKeyRef: undefined,
    // Custom header names can be arbitrary authentication headers. Portable
    // backups keep their names but require values to be entered on the device.
    extraHeaders: provider.extraHeaders?.map(header => ({ ...header, value: "" })),
  }));
  return {
    exportedAt: new Date().toISOString(),
    appName: WORKSPACE_APP_NAME,
    workspace,
  };
}

export function importWorkspaceState(json: string): WorkspaceImportResult {
  try {
    const parsed = JSON.parse(json) as unknown;
    const candidate = isPlainObject(parsed) && "workspace" in parsed ? parsed.workspace : parsed;
    const validation = validateWorkspaceState(candidate);

    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors,
      };
    }

    return {
      success: true,
      workspace: validation.workspace,
    };
  } catch {
    return {
      success: false,
      errors: ["导入失败：不是合法的 JSON。"],
    };
  }
}

export function validateWorkspaceState(data: unknown): WorkspaceValidationResult {
  if (!isPlainObject(data)) {
    return {
      valid: false,
      errors: ["工作区数据必须是对象。"],
    };
  }

  const errors: string[] = [];
  validateWorkspaceObjects(data, errors);

  if ("schemaVersion" in data) {
    if (!Number.isInteger(data.schemaVersion) || (data.schemaVersion as number) < 1) {
      errors.push("schemaVersion 必须是正整数。");
    } else if ((data.schemaVersion as number) > WORKSPACE_SCHEMA_VERSION) {
      errors.push(`工作区版本 ${data.schemaVersion} 高于当前支持的版本 ${WORKSPACE_SCHEMA_VERSION}，请使用较新版本打开。`);
    }
  }

  if ("aiSettings" in data && !isPlainObject(data.aiSettings)) {
    errors.push("旧版 aiSettings 必须是 object。");
  }

  if ("aiTaskRouting" in data && !isPlainObject(data.aiTaskRouting)) {
    errors.push("aiTaskRouting 必须是 object。");
  }

  if (
    "aiContentPreferences" in data &&
    !isPlainObject(data.aiContentPreferences)
  ) {
    errors.push("aiContentPreferences 必须是 object。");
  }

  WORKSPACE_ARRAY_FIELDS.forEach((field) => {
    if (!(field in data)) return;
    const records = data[field];
    if (!Array.isArray(records)) {
      errors.push(`${field} 必须是 array。`);
      return;
    }

    const ids = new Set<string>();
    records.forEach((record: unknown, index: number) => {
      if (field === "recentSavedContentIds") {
        if (typeof record !== "string") errors.push(`${field}[${index}] 必须是字符串。`);
        return;
      }
      if (!isPlainObject(record)) {
        errors.push(`${field}[${index}] 必须是对象。`);
        return;
      }
      validateNestedRecord(record, `${field}[${index}]`, errors);
      if (typeof record.id === "string") {
        if (ids.has(record.id)) errors.push(`${field}[${index}].id 重复。`);
        ids.add(record.id);
      }
      if (field === "readerMessages" && record.role !== "user" && record.role !== "assistant") errors.push(`${field}[${index}].role 无效。`);
      const requiredFields = REQUIRED_LEARNING_RECORD_STRINGS[field] ?? [];
      requiredFields.forEach((key) => {
        if (typeof record[key] !== "string") {
          errors.push(`${field}[${index}].${key} 必须是字符串。`);
        }
      });
    });
  });

  if (errors.length) {
    return {
      valid: false,
      errors,
    };
  }

  try {
    return {
      valid: true,
      errors: [],
      workspace: normalizeWorkspaceInput(
        data as Partial<WorkspaceState> & { aiSettings?: LegacyAiSettings },
      ),
    };
  } catch {
    return { valid: false, errors: ["工作区包含无法迁移的数据，请检查文件或恢复备份。"] };
  }
}

const REQUIRED_LEARNING_RECORD_STRINGS: Partial<Record<keyof WorkspaceState, string[]>> = {
  sourceMaterials: ["id", "title", "cleanedContent", "originalContent", "createdAt"],
  learningSegments: ["id", "sourceMaterialId", "text", "createdAt"],
  readingSessions: ["id", "sourceMaterialId", "startedAt", "updatedAt"],
  vocabularyItems: ["id", "text", "sourceMaterialId", "createdAt"],
  expressionItems: ["id", "text", "sourceMaterialId", "createdAt"],
  grammarNotes: ["id", "title", "sourceMaterialId", "createdAt"],
  cultureNotes: ["id", "title", "sourceMaterialId", "createdAt"],
  feynmanNotes: ["id", "sourceMaterialId", "createdAt"],
  readerMessages: ["id", "sourceMaterialId", "role", "text", "createdAt"],
  outputDrafts: ["id", "title", "content", "createdAt"],
};

function normalizeWorkspaceInput(
  value: Partial<WorkspaceState> & { aiSettings?: LegacyAiSettings },
) {
  return mergeWorkspaceState(createDefaultWorkspaceState(), value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}
