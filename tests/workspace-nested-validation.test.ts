import { describe, expect, it } from "vitest";
import { createDefaultWorkspaceState, validateWorkspaceState } from "@/src/lib/workspace/core";
import { createSourceMaterialFromText } from "@/src/lib/sourceIngestion";
import { createInitialSrsState } from "@/src/lib/srs";

const source = createSourceMaterialFromText({ title: "Reading", content: "A real reading source." }).sourceMaterial;
const word = { id: "word", text: "reading", sourceMaterialId: source.id, createdAt: "2026-11-01T00:00:00Z" };
describe("nested workspace validation before a restore", () => {
  it.each([
    { vocabularyItems: [{ ...word, tags: "not an array" }] },
    { vocabularyItems: [{ ...word, meaningZh: 42 }] },
    { vocabularyItems: [{ ...word, srs: { ...createInitialSrsState(), dueAt: "not-a-date" } }] },
    { vocabularyItems: [{ ...word, srs: { ...createInitialSrsState(), reps: -1 } }] },
    { vocabularyItems: [{ ...word, srs: { ...createInitialSrsState(), reviewHistory: null } }] },
    { sourceMaterials: [source, source] },
    { readerMessages: [{ id: "", sourceMaterialId: source.id, role: "user", text: "question", createdAt: "2026-11-01" }] },
    { readingSessions: [{ id: "r", sourceMaterialId: source.id, startedAt: "2026-11-01", updatedAt: "2026-11-01", progress: 200 }] },
    { aiPrivacySettings: { allowRemoteAi: "false" } },
    { outputDrafts: [{ id: "draft", title: "Draft", content: "text", createdAt: "2026-11-01", publishSourceChoiceIds: [null] }] },
    { segmentAnalyses: [{ id: "analysis", articleOverview: { keyIdeas: "not an array" } }] },
  ])("rejects malformed nested state instead of allowing a later page crash: %j", patch => {
    const value = { ...createDefaultWorkspaceState(), ...patch };
    expect(validateWorkspaceState(value).valid).toBe(false);
  });

  it("preserves valid scheduling history and optional missing legacy fields", () => {
    const state = createDefaultWorkspaceState();
    const value = { ...state, sourceMaterials: [source], vocabularyItems: [{ ...word, tags: [], srs: createInitialSrsState() }] };
    const result = validateWorkspaceState(value);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.workspace.vocabularyItems[0].srs).toEqual(value.vocabularyItems[0].srs);
  });
});
