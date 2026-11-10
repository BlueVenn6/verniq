import { describe, expect, it, vi } from "vitest";
import { createDefaultWorkspaceState } from "@/src/lib/workspace/core";
import { readWorkspaceFileSession, writeWorkspaceFileSession, saveWorkspaceFile, exportWorkspaceFile } from "@/src/lib/workspace/desktopStorage";

const { invoke, saveDialog } = vi.hoisted(() => ({ invoke: vi.fn(), saveDialog: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ save: saveDialog }));

describe("desktop workspace recovery and conflict checks", () => {
  it("restores a persisted desktop path after session storage is gone", () => {
    const values = new Map<string, string>([
      [
        "my-life-map:workspace:file:metadata",
        JSON.stringify({
          storageMode: "desktop-file",
          filePath: "C:\\Users\\test\\workspace.json",
          lastSavedAt: "2026-11-05T10:00:00.000Z",
          backupCount: 3,
        }),
      ],
    ]);
    const localStorage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };
    const sessionStorage = {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    };

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { localStorage, sessionStorage },
    });

    expect(readWorkspaceFileSession()).toMatchObject({
      storageMode: "desktop-file",
      filePath: "C:\\Users\\test\\workspace.json",
      backupCount: 3,
    });
  });
});

it("isolates a window's file and hash from another window's persisted session", () => {
  const localValues = new Map<string, string>();
  const windowValues = new Map<string, string>();
  const storage = (values: Map<string, string>) => ({ getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) });
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: storage(localValues), sessionStorage: storage(windowValues) } });
  writeWorkspaceFileSession({ storageMode: "desktop-file", filePath: "first.json", contentHash: "first-hash" });
  localValues.set("my-life-map:workspace:file:metadata", JSON.stringify({ storageMode: "desktop-file", filePath: "second.json", contentHash: "other-hash" }));
  expect(readWorkspaceFileSession()).toMatchObject({ filePath: "first.json", contentHash: "first-hash" });
});

it("sends the last-read hash to the native atomic command and uses its returned hash", async () => {
  Object.defineProperty(globalThis, "window", { configurable: true, value: { __TAURI_INTERNALS__: {} } });
  invoke.mockResolvedValueOnce({ contentHash: "new-hash", backupCount: 4 });
  const result = await saveWorkspaceFile(createDefaultWorkspaceState(), { storageMode: "desktop-file", filePath: "C:/workspace.json", contentHash: "last-read", backupCount: 3 });
  expect(invoke).toHaveBeenLastCalledWith("workspace_write_atomic", expect.objectContaining({ filePath: "C:/workspace.json", expectedHash: "last-read", backup: true }));
  expect(result).toMatchObject({ contentHash: "new-hash", backupCount: 4 });
});

it("does not let export bypass the current file's conflict check", async () => {
  Object.defineProperty(globalThis, "window", { configurable: true, value: { __TAURI_INTERNALS__: {} } });
  saveDialog.mockResolvedValueOnce("C:/workspace.json");
  invoke.mockClear();
  await expect(exportWorkspaceFile(createDefaultWorkspaceState(), { storageMode: "desktop-file", filePath: "C:/workspace.json", contentHash: "old" })).rejects.toThrow("导出副本请选择不同的文件名");
  expect(invoke).not.toHaveBeenCalled();
});
