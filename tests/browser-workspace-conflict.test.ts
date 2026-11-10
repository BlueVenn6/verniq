import { beforeEach, expect, it, vi } from "vitest";
import { createDefaultWorkspaceState } from "@/src/lib/workspace/core";
import { createBrowserLocalStorageAdapter, createDesktopWorkspaceFileAdapter } from "@/src/lib/workspace/storageAdapter";
import { workspaceStorageKeys } from "@/src/lib/workspace/storage";

let values: Map<string, string>;
const request = vi.fn(async (_name: string, write: () => void) => write());
beforeEach(() => {
  values = new Map(); request.mockClear();
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  } } });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { locks: { request } } });
});

it("rejects stale browser state without overwriting another window's version", async () => {
  const adapter = createBrowserLocalStorageAdapter();
  const initial = createDefaultWorkspaceState();
  values.set(workspaceStorageKeys.workspaceState, JSON.stringify(initial));
  await adapter.loadWorkspace();
  const external = JSON.stringify({ ...initial, languageSettings: { ...initial.languageSettings, uiLanguage: "en" } });
  values.set(workspaceStorageKeys.workspaceState, external);
  await expect(adapter.saveWorkspace(initial)).rejects.toThrow("浏览器工作区已变化");
  expect(values.get(workspaceStorageKeys.workspaceState)).toBe(external);
  expect(request).toHaveBeenCalledWith("verniq-workspace-write", expect.any(Function));
});

it("uses the updated baseline for consecutive saves in the same window", async () => {
  const adapter = createBrowserLocalStorageAdapter();
  const initial = createDefaultWorkspaceState();
  await adapter.loadWorkspace();
  await adapter.saveWorkspace(initial);
  await adapter.saveWorkspace({ ...initial, languageSettings: { ...initial.languageSettings, uiLanguage: "en" } });
  expect(JSON.parse(values.get(workspaceStorageKeys.workspaceState)! as string).languageSettings.uiLanguage).toBe("en");
});

it("preserves existing data when cross-window locking is unavailable", async () => {
  const adapter = createBrowserLocalStorageAdapter();
  const initial = createDefaultWorkspaceState();
  values.set(workspaceStorageKeys.workspaceState, JSON.stringify(initial));
  await adapter.loadWorkspace();
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} });
  await expect(adapter.saveWorkspace(initial)).rejects.toThrow("不支持跨窗口安全保存");
  expect(values.get(workspaceStorageKeys.workspaceState)).toBe(JSON.stringify(initial));
});

it("applies the same conflict protection to an unsaved desktop workspace", async () => {
  const adapter = createDesktopWorkspaceFileAdapter(() => ({ storageMode: "browser-cache" }));
  const workspace = createDefaultWorkspaceState();
  await adapter.loadWorkspace();
  const external = JSON.stringify(workspace);
  values.set(workspaceStorageKeys.workspaceState, external);
  await expect(adapter.saveWorkspace(workspace)).rejects.toThrow("浏览器工作区已变化");
  expect(values.get(workspaceStorageKeys.workspaceState)).toBe(external);
});
