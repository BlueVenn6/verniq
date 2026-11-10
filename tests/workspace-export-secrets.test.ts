import { expect, it } from "vitest";
import { createDefaultWorkspaceState, exportWorkspaceState, importWorkspaceState } from "@/src/lib/workspace/core";
import { serializeWorkspaceFile, serializeWorkspaceExport, parseWorkspaceFile } from "@/src/lib/workspace/desktopStorage";

function configuredWorkspace() {
  const workspace = createDefaultWorkspaceState();
  workspace.aiProviders[0].apiKeyRef = "legacy-synthetic-secret";
  workspace.aiProviders[0].credentialRef = "opaque-credential-reference";
  workspace.aiProviders[0].extraHeaders = [{ id: "h", name: "X-Custom-Auth", value: "header-synthetic-secret" }];
  return workspace;
}
it("exports AI configuration without legacy keys or custom header secrets", () => {
  const workspace = configuredWorkspace();
  const exported = JSON.stringify(exportWorkspaceState(workspace));
  expect(exported).not.toContain("legacy-synthetic-secret");
  expect(exported).not.toContain("header-synthetic-secret");
  expect(exported).toContain("opaque-credential-reference");
  expect(importWorkspaceState(exported).success).toBe(true);
});
it("uses the same safe policy for a portable file and keeps learning records restorable", () => {
  const workspace = configuredWorkspace();
  const json = serializeWorkspaceExport(workspace);
  expect(json).not.toContain("legacy-synthetic-secret");
  expect(json).not.toContain("header-synthetic-secret");
  expect(parseWorkspaceFile(json).workspace.aiProviders[0].baseUrl).toBe(workspace.aiProviders[0].baseUrl);
});
it("keeps the working credentials in memory but strips them from ordinary local file saves", () => {
  const workspace = configuredWorkspace();
  exportWorkspaceState(workspace);
  expect(workspace.aiProviders[0].apiKeyRef).toBe("legacy-synthetic-secret");
  const saved = serializeWorkspaceFile(workspace);
  expect(saved).not.toContain("legacy-synthetic-secret");
  expect(saved).not.toContain("header-synthetic-secret");
  expect(saved).toContain("opaque-credential-reference");
});
it("keeps a desktop recovery copy free of plaintext credentials", async () => {
  const values = new Map<string, string>();
  const storage = {
    get length() { return values.size; },
    key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  const globalWithWindow = globalThis as { window?: unknown };
  const previousWindow = globalWithWindow.window;
  globalWithWindow.window = { localStorage: storage };
  try {
    const { saveDesktopRecovery } = await import("@/src/lib/workspace/desktopRecovery");
    saveDesktopRecovery("C:/tmp/workspace.json", configuredWorkspace(), new Date().toISOString());
    const stored = [...values.values()].join("\n");
    expect(stored).not.toContain("legacy-synthetic-secret");
    expect(stored).not.toContain("header-synthetic-secret");
  } finally {
    if (previousWindow === undefined) delete globalWithWindow.window;
    else globalWithWindow.window = previousWindow;
  }
});
