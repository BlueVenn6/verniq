import type {
  WorkspaceActivity,
  ModelConfig,
  WorkspaceSourceDraft,
  WorkspaceRecord,
  WorkspaceSource,
} from "@/src/lib/workspace/types";
import type { ContentPipelineItem } from "@/src/lib/types";

export const workspaceStorageKeys = {
  workspaceState: "my-life-map:workspace:core:v1",
  workspaceUpdatedAt: "my-life-map:workspace:updated-at",
  draft: "my-life-map:studio:draft",
  sources: "my-life-map:studio:sources",
  activeSourceId: "my-life-map:studio:active-source",
  records: "my-life-map:workspace:records",
  activities: "my-life-map:workspace:activities",
  modelConfigs: "my-life-map:llm:configs",
  activeModelConfigId: "my-life-map:llm:active-config",
  sourceDrafts: "my-life-map:studio:source-drafts",
  contentPipelineItems: "my-life-map:content-pipeline:items",
};

export function readLocalArray<T>(key: string): T[] {
  if (typeof window === "undefined") return [];

  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T[]) : [];
  } catch {
    return [];
  }
}

export function writeLocalArray<T>(key: string, value: T[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function readLocalObject<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeLocalObject<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function readSources() {
  return readLocalArray<WorkspaceSource>(workspaceStorageKeys.sources);
}

export function writeSources(sources: WorkspaceSource[]) {
  writeLocalArray(workspaceStorageKeys.sources, sources);
}

export function readRecords() {
  return readLocalArray<WorkspaceRecord>(workspaceStorageKeys.records);
}

export function writeRecords(records: WorkspaceRecord[]) {
  writeLocalArray(workspaceStorageKeys.records, records);
}

export function readActivities() {
  return readLocalArray<WorkspaceActivity>(workspaceStorageKeys.activities);
}

export function writeActivities(activities: WorkspaceActivity[]) {
  writeLocalArray(workspaceStorageKeys.activities, activities);
}

export function readModelConfigs() {
  return readLocalArray<ModelConfig>(workspaceStorageKeys.modelConfigs);
}

export function writeModelConfigs(configs: ModelConfig[]) {
  writeLocalArray(workspaceStorageKeys.modelConfigs, configs);
}

export function readSourceDrafts() {
  return readLocalObject<Record<string, WorkspaceSourceDraft>>(
    workspaceStorageKeys.sourceDrafts,
    {},
  );
}

export function writeSourceDrafts(drafts: Record<string, WorkspaceSourceDraft>) {
  writeLocalObject(workspaceStorageKeys.sourceDrafts, drafts);
}

export function readContentPipelineItems() {
  return readLocalArray<ContentPipelineItem>(workspaceStorageKeys.contentPipelineItems);
}

export function writeContentPipelineItems(items: ContentPipelineItem[]) {
  writeLocalArray(workspaceStorageKeys.contentPipelineItems, items);
}
