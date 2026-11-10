import { afterEach, describe, expect, it, vi } from "vitest";
import { loadWorkspaceFromLocalStorage } from "@/src/lib/workspace/storageAdapter";
import { workspaceStorageKeys } from "@/src/lib/workspace/storage";

afterEach(() => vi.unstubAllGlobals());

describe("damaged local workspaces", () => {
  it.each(["{broken", JSON.stringify({ schemaVersion: 999 })])(
    "rejects invalid data without replacing the original value",
    (raw) => {
      const values = new Map([[workspaceStorageKeys.workspaceState, raw]]);
      const setItem = vi.fn((key: string, value: string) => values.set(key, value));
      vi.stubGlobal("window", { localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem } });

      expect(() => loadWorkspaceFromLocalStorage()).toThrow();
      expect(values.get(workspaceStorageKeys.workspaceState)).toBe(raw);
      expect(setItem).not.toHaveBeenCalled();
    },
  );
});
