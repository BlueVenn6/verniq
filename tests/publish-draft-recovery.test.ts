import { describe, expect, it } from "vitest";
import {
  clearPublishDraftRecovery,
  isPublishDraftDirty,
  publishDraftRecoveryKey,
  readPublishDraftRecovery,
  writePublishDraftRecovery,
} from "@/src/lib/publish/publishDraftRecovery";
import { DEFAULT_PUBLISH_SETTINGS, DEFAULT_VISUAL_SETTINGS } from "@/src/lib/publish/publishPresets";

function installStorage() {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        get length() { return values.size; },
        key: (index: number) => [...values.keys()][index] ?? null,
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    },
  });
  return values;
}

describe("publish draft recovery", () => {
  it("recovers card text, custom identity and writing feedback without losing the separate text draft", () => {
    installStorage();
    const visualSettings = { ...DEFAULT_VISUAL_SETTINGS, layout: "image_top" as const, brandMode: "custom_name" as const, customName: "Ada", cardText: "One short idea.", cardTitle: "My reflection", fontFamily: "sans" as const, fontWeight: 700, fontScale: 1.65, textAlign: "center" as const, imageZoom: 1.8, imagePositionX: 0.15, imagePositionY: 0.85 };
    writePublishDraftRecovery({ markdown: "# My reflection\n\nOne short idea.", draftId: "card", sourceChoiceIds: [], customInput: "Preserved full article notes", settings: { ...DEFAULT_PUBLISH_SETTINGS, mode: "card", aiReflection: "My thought", aiInstruction: "Compare the sources" }, visualSettings, savedMarkdown: null });
    expect(readPublishDraftRecovery()).toMatchObject({ customInput: "Preserved full article notes", visualSettings, settings: { aiReflection: "My thought", aiInstruction: "Compare the sources" } });
  });
  it("only treats an edited markdown value as dirty", () => {
    expect(isPublishDraftDirty(null, null)).toBe(false);
    expect(isPublishDraftDirty("same", "same")).toBe(false);
    expect(isPublishDraftDirty("changed", "same")).toBe(true);
  });

  it("round trips a recoverable draft and clears it after save", () => {
    const values = installStorage();
    writePublishDraftRecovery({
      markdown: "# A draft",
      draftId: "draft-1",
      sourceChoiceIds: ["source-1"],
      customInput: "",
      settings: DEFAULT_PUBLISH_SETTINGS,
      visualSettings: DEFAULT_VISUAL_SETTINGS,
      savedMarkdown: null,
    });

    expect([...values.keys()].some((key) => key.startsWith(`${publishDraftRecoveryKey}:`))).toBe(true);
    expect(readPublishDraftRecovery()).toMatchObject({
      markdown: "# A draft",
      draftId: "draft-1",
      sourceChoiceIds: ["source-1"],
    });

    clearPublishDraftRecovery();
    expect(readPublishDraftRecovery()).toBeNull();
  });
});

it("preserves edits newer than the saved snapshot", () => {
  installStorage();
  const draft = { markdown: "newer", draftId: "draft-1", sourceChoiceIds: [], customInput: "", settings: DEFAULT_PUBLISH_SETTINGS, visualSettings: DEFAULT_VISUAL_SETTINGS, savedMarkdown: "older" };
  expect(writePublishDraftRecovery(draft)).toBe(true);
  clearPublishDraftRecovery("older");
  expect(readPublishDraftRecovery()?.markdown).toBe("newer");
});

it("recovers text from damaged optional settings without passing invalid values to the editor", () => {
  const values = installStorage();
  values.set(publishDraftRecoveryKey, JSON.stringify({ markdown: "valuable text", sourceChoiceIds: [], settings: { mode: "bad", purpose: 42 }, visualSettings: { ratioId: "bad" } }));
  expect(readPublishDraftRecovery()).toMatchObject({ markdown: "valuable text", settings: DEFAULT_PUBLISH_SETTINGS, visualSettings: DEFAULT_VISUAL_SETTINGS });
});

it("reports unavailable recovery storage", () => {
  installStorage();
  window.localStorage.setItem = () => { throw new Error("quota exceeded"); };
  expect(writePublishDraftRecovery({ markdown: "text", draftId: "", sourceChoiceIds: [], customInput: "", settings: DEFAULT_PUBLISH_SETTINGS, visualSettings: DEFAULT_VISUAL_SETTINGS, savedMarkdown: null })).toBe(false);
});

it("does not delete a different window's recovery when clearing this editor", () => {
  const values = installStorage();
  const otherKey = `${publishDraftRecoveryKey}:other-window`;
  values.set(otherKey, JSON.stringify({ markdown: "other window", sourceChoiceIds: [], settings: DEFAULT_PUBLISH_SETTINGS, visualSettings: DEFAULT_VISUAL_SETTINGS }));
  clearPublishDraftRecovery();
  expect(readPublishDraftRecovery()?.markdown).toBe("other window");
  expect(values.has(otherKey)).toBe(true);
});

it("keeps legacy card text available for migration from the recovered Markdown", () => {
  const values = installStorage();
  values.set(publishDraftRecoveryKey, JSON.stringify({ markdown: "# Legacy quote\n\nKeep this valuable text.", sourceChoiceIds: [], settings: { ...DEFAULT_PUBLISH_SETTINGS, mode: "card" }, visualSettings: DEFAULT_VISUAL_SETTINGS }));
  const recovered = readPublishDraftRecovery();
  expect(recovered?.markdown).toContain("Keep this valuable text.");
  expect(recovered?.visualSettings.cardText).toBeUndefined();
});
