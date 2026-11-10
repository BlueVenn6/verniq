import { describe, expect, it } from "vitest";
import { createDefaultWorkspaceState, validateWorkspaceState, WORKSPACE_SCHEMA_VERSION } from "@/src/lib/workspace/core";

describe("workspace import validation", () => {
  it("rejects damaged arrays and records before migration", () => {
    for (const patch of [
      { vocabularyItems: [null] },
      { sourceMaterials: [{}] },
      { learningSegments: "not an array" },
      { recentSavedContentIds: [null] },
    ]) {
      expect(validateWorkspaceState({ ...createDefaultWorkspaceState(), ...patch }).valid).toBe(false);
    }
  });

  it("rejects unknown future versions instead of silently downgrading them", () => {
    const result = validateWorkspaceState({ ...createDefaultWorkspaceState(), schemaVersion: WORKSPACE_SCHEMA_VERSION + 1 });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors.join(" ")).toContain("高于当前支持");
  });

  it("keeps supporting older workspaces with missing optional arrays", () => {
    const result = validateWorkspaceState({ schemaVersion: 3 });
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.workspace.vocabularyItems).toEqual([]);
  });
});
