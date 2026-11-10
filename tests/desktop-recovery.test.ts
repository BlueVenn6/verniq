import { beforeEach, expect, it } from "vitest";
import { createDefaultWorkspaceState } from "@/src/lib/workspace/core";
import { clearDesktopRecovery, readDesktopRecovery, resolveDesktopRecovery, saveDesktopRecovery } from "@/src/lib/workspace/desktopRecovery";

let values: Map<string, string>;
beforeEach(() => {
  values = new Map();
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: {
    get length() { return values.size; },
    key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  } } });
});

it("keeps a newer pending snapshot when an older write finishes", () => {
  const workspace = createDefaultWorkspaceState();
  const key = saveDesktopRecovery("file.json", workspace, "2026-11-05T10:00:00.000Z");
  saveDesktopRecovery("file.json", { ...workspace, languageSettings: { ...workspace.languageSettings, uiLanguage: "en" } }, "2026-11-05T10:00:01.000Z");
  clearDesktopRecovery(key);
  expect(readDesktopRecovery("file.json")?.workspace.languageSettings.uiLanguage).toBe("en");
  expect(readDesktopRecovery("other.json")).toBeNull();
});

it("ignores damaged recovery entries and retains their bytes", () => {
  values.set("my-life-map:workspace:recovery:broken", "not json");
  saveDesktopRecovery("file.json", createDefaultWorkspaceState(), new Date().toISOString());
  expect(readDesktopRecovery("file.json")).not.toBeNull();
  expect(values.get("my-life-map:workspace:recovery:broken")).toBe("not json");
});

it("does not restore an explicitly resolved snapshot again", () => {
  const key = saveDesktopRecovery("file.json", createDefaultWorkspaceState(), "2020-01-01T00:00:00.000Z");
  resolveDesktopRecovery("file.json");
  expect(readDesktopRecovery("file.json")).toBeNull();
  expect(values.has(key.key)).toBe(true);
});

it("resolving this window does not suppress another window's unsaved work", () => {
  const workspace = createDefaultWorkspaceState();
  saveDesktopRecovery("file.json", workspace, "2020-01-01T00:00:00.000Z");
  const key = "my-life-map:workspace:recovery:another-window";
  values.set(key, JSON.stringify({ filePath: "file.json", workspace, updatedAt: "2020-01-01T00:00:01.000Z" }));
  resolveDesktopRecovery("file.json");
  expect(readDesktopRecovery("file.json")?.storageKey).toBe(key);
});

it("distinguishes saves created in the same millisecond", () => {
  const workspace = createDefaultWorkspaceState();
  const first = saveDesktopRecovery("file.json", workspace, "2026-11-05T10:00:00.000Z");
  saveDesktopRecovery("file.json", { ...workspace, languageSettings: { ...workspace.languageSettings, uiLanguage: "en" } }, "2026-11-05T10:00:00.000Z");
  clearDesktopRecovery(first);
  expect(readDesktopRecovery("file.json")?.workspace.languageSettings.uiLanguage).toBe("en");
});
