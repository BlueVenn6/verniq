import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createDefaultWorkspaceState, exportWorkspaceState } from "@/src/lib/workspace/core";
import { createBrowserLocalStorageAdapter, restoreBrowserWorkspace } from "@/src/lib/workspace/storageAdapter";
import { workspaceStorageKeys } from "@/src/lib/workspace/storage";

let values: Map<string, string>;
let failKey: (key: string) => boolean;
const primary = workspaceStorageKeys.workspaceState;
beforeEach(() => {
  values = new Map([[primary, "{damaged-original"]]); failKey = () => false;
  vi.stubGlobal("window", { localStorage: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { if (failKey(key)) throw new DOMException("Quota", "QuotaExceededError"); values.set(key, value); },
  } });
  vi.stubGlobal("navigator", { locks: { request: async (_name: string, operation: () => unknown) => operation() } });
});
afterEach(() => vi.unstubAllGlobals());
const backup = () => JSON.stringify(exportWorkspaceState(createDefaultWorkspaceState()));

it("validates the selected backup before changing any bytes", async () => {
  await expect(restoreBrowserWorkspace('{"workspace":{"vocabularyItems":[null]}}', values.get(primary)!)).rejects.toThrow(/vocabularyItems/);
  expect([...values]).toEqual([[primary, "{damaged-original"]]);
});
it("restores even a corrupt primary only after retaining its exact original bytes", async () => {
  const result = await restoreBrowserWorkspace(backup(), values.get(primary)!);
  expect(JSON.parse(values.get(result.backupKey!)!).primaryRaw).toBe("{damaged-original");
  expect(JSON.parse(values.get(primary)!)).toEqual(result.workspace);
  await expect(createBrowserLocalStorageAdapter().saveWorkspace(result.workspace)).resolves.toBeUndefined();
});
it("cannot overwrite a change made in another window after confirmation started", async () => {
  const expected = values.get(primary)!; values.set(primary, "NEWER WINDOW DATA");
  await expect(restoreBrowserWorkspace(backup(), expected)).rejects.toThrow();
  expect(values.get(primary)).toBe("NEWER WINDOW DATA");
  expect(values.size).toBe(1);
});
it.each(["backup", "primary"])("keeps the original when the %s write fails", async where => {
  failKey = key => where === "backup" ? key.includes("before-restore:") : key === primary;
  await expect(restoreBrowserWorkspace(backup(), values.get(primary)!)).rejects.toThrow();
  expect(values.get(primary)).toBe("{damaged-original");
});
it("does not report a failed restore after a successful primary write if the timestamp cache fails", async () => {
  failKey = key => key === workspaceStorageKeys.workspaceUpdatedAt;
  const result = await restoreBrowserWorkspace(backup(), values.get(primary)!);
  expect(JSON.parse(values.get(primary)!)).toEqual(result.workspace);
  expect(result.statusWarning).toBeTruthy();
});
