import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { contentPipelineItems } from "@/src/data/mockData";
import { createDefaultWorkspaceState } from "@/src/lib/workspace/core";
import { createBrowserLocalStorageAdapter, loadWorkspaceFromLocalStorage } from "@/src/lib/workspace/storageAdapter";
import { workspaceStorageKeys } from "@/src/lib/workspace/storage";

let values: Map<string, string>;
const item = { ...contentPipelineItems[0], id: "real-user-material", title: "Current title" };
beforeEach(() => {
  values = new Map();
  vi.stubGlobal("window", { localStorage: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  } });
  vi.stubGlobal("navigator", { locks: { request: async (_name: string, save: () => void) => save() } });
});
afterEach(() => vi.unstubAllGlobals());

describe("authoritative browser workspace", () => {
  it("does not let an old mirror overwrite edits or resurrect removed records", () => {
    const workspace = createDefaultWorkspaceState();
    workspace.contentPipelineItems = [item];
    values.set(workspaceStorageKeys.workspaceState, JSON.stringify(workspace));
    values.set(workspaceStorageKeys.contentPipelineItems, JSON.stringify([{ ...item, title: "Old title" }, { ...item, id: "deleted-record" }]));
    expect(loadWorkspaceFromLocalStorage().contentPipelineItems).toEqual([item]);
  });

  it("ignores malformed legacy mirrors when the primary workspace is valid", () => {
    values.set(workspaceStorageKeys.workspaceState, JSON.stringify(createDefaultWorkspaceState()));
    values.set(workspaceStorageKeys.contentPipelineItems, JSON.stringify({ broken: true }));
    expect(() => loadWorkspaceFromLocalStorage()).not.toThrow();
  });

  it("still migrates a valid legacy-only workspace without rewriting it during read", () => {
    const legacy = JSON.stringify([item]);
    values.set(workspaceStorageKeys.contentPipelineItems, legacy);
    expect(loadWorkspaceFromLocalStorage().contentPipelineItems).toEqual([item]);
    expect(values.get(workspaceStorageKeys.contentPipelineItems)).toBe(legacy);
  });

  it("reports damaged legacy-only data rather than treating it as an empty workspace", () => {
    values.set(workspaceStorageKeys.contentPipelineItems, "{broken");
    expect(() => loadWorkspaceFromLocalStorage()).toThrow();
    expect(values.get(workspaceStorageKeys.contentPipelineItems)).toBe("{broken");
  });

  it("does not turn a successful primary write into a partial-save conflict", async () => {
    const adapter = createBrowserLocalStorageAdapter();
    await adapter.loadWorkspace();
    vi.stubGlobal("window", { localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (key === workspaceStorageKeys.contentPipelineItems) throw new DOMException("Quota exceeded", "QuotaExceededError");
        values.set(key, value);
      },
    } });
    const workspace = createDefaultWorkspaceState();
    await expect(adapter.saveWorkspace(workspace)).resolves.toBeUndefined();
    await expect(adapter.saveWorkspace({ ...workspace, contentPipelineItems: [item] })).resolves.toBeUndefined();
    expect(loadWorkspaceFromLocalStorage().contentPipelineItems).toEqual([item]);
  });
});
