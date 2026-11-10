import { DEFAULT_PUBLISH_SETTINGS, DEFAULT_VISUAL_SETTINGS, type PublishDraftSettings, type PublishVisualSettings } from "./publishPresets";

export const publishDraftRecoveryKey = "my-life-map:publish:draft-recovery";

let recoverySlot = "";
function currentRecoveryKey() {
  if (!recoverySlot) recoverySlot = `${publishDraftRecoveryKey}:${crypto.randomUUID()}`;
  return recoverySlot;
}

export type PublishDraftRecovery = {
  storageKey?: string;
  markdown: string;
  draftId: string;
  sourceChoiceIds: string[];
  customInput: string;
  settings: PublishDraftSettings;
  visualSettings: PublishVisualSettings;
  savedMarkdown: string | null;
  savedAt: string;
};

export function isPublishDraftDirty(markdown: string | null, savedMarkdown: string | null) {
  return markdown !== null && markdown !== savedMarkdown;
}

export function readPublishDraftRecovery(): PublishDraftRecovery | null {
  if (typeof window === "undefined") return null;
  try {
    const ownKey = currentRecoveryKey();
    const own = parseRecovery(window.localStorage.getItem(ownKey), ownKey);
    if (own) return own;
    const candidates = [parseRecovery(window.localStorage.getItem(publishDraftRecoveryKey), publishDraftRecoveryKey)];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(`${publishDraftRecoveryKey}:`)) candidates.push(parseRecovery(window.localStorage.getItem(key), key));
    }
    return candidates.filter((entry): entry is PublishDraftRecovery => entry !== null)
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0] ?? null;
  } catch { return null; }
}

function parseRecovery(raw: string | null, storageKey: string): PublishDraftRecovery | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PublishDraftRecovery>;

    if (
      typeof value.markdown !== "string" ||
      !Array.isArray(value.sourceChoiceIds) ||
      !value.sourceChoiceIds.every((id) => typeof id === "string") ||
      !value.settings || typeof value.settings !== "object" ||
      !value.visualSettings || typeof value.visualSettings !== "object"
    ) {
      return null;
    }

    return {
      storageKey,
      markdown: value.markdown,
      draftId: typeof value.draftId === "string" ? value.draftId : "",
      sourceChoiceIds: value.sourceChoiceIds,
      customInput: typeof value.customInput === "string" ? value.customInput : "",
      settings: {
        ...DEFAULT_PUBLISH_SETTINGS,
        mode: value.settings.mode === "card" ? "card" : "text",
        tone: ["direct", "warm", "editorial"].includes(value.settings.tone) ? value.settings.tone : "calm",
        length: ["short", "long"].includes(value.settings.length) ? value.settings.length : "medium",
        purpose: typeof value.settings.purpose === "string" ? value.settings.purpose : "",
        audience: typeof value.settings.audience === "string" ? value.settings.audience : "",
        customInstruction: typeof value.settings.customInstruction === "string" ? value.settings.customInstruction : "",
        aiModelId: typeof value.settings.aiModelId === "string" ? value.settings.aiModelId : "",
        aiReflection: typeof value.settings.aiReflection === "string" ? value.settings.aiReflection : "",
        aiInstruction: typeof value.settings.aiInstruction === "string" ? value.settings.aiInstruction : "",
        outputLanguage: value.settings.outputLanguage === "zh" ? "zh" : "en",
      },
      visualSettings: {
        ...DEFAULT_VISUAL_SETTINGS,
        layout: ["split", "image_top", "image_left"].includes(value.visualSettings.layout) ? value.visualSettings.layout : "pure_text",
        imageCrop: ["top", "bottom"].includes(value.visualSettings.imageCrop) ? value.visualSettings.imageCrop : "center",
        ratioId: ["1:1", "16:9"].includes(value.visualSettings.ratioId) ? value.visualSettings.ratioId : "4:5",
        brandMode: ["made_with", "custom_name", "custom_logo"].includes(value.visualSettings.brandMode) ? value.visualSettings.brandMode : "none",
        customName: typeof value.visualSettings.customName === "string" ? value.visualSettings.customName : "",
        logoDataUrl: typeof value.visualSettings.logoDataUrl === "string" && /^data:image\/(?:png|jpeg|webp);base64,/.test(value.visualSettings.logoDataUrl) && value.visualSettings.logoDataUrl.length <= 700000 ? value.visualSettings.logoDataUrl : "",
        cardText: typeof value.visualSettings.cardText === "string" ? value.visualSettings.cardText : undefined,
        cardTitle: typeof value.visualSettings.cardTitle === "string" ? value.visualSettings.cardTitle : "",
        fontFamily: value.visualSettings.fontFamily === "sans" ? "sans" : "serif",
        fontScale: typeof value.visualSettings.fontScale === "number" && value.visualSettings.fontScale >= 0.8 && value.visualSettings.fontScale <= 2 ? value.visualSettings.fontScale : DEFAULT_VISUAL_SETTINGS.fontScale,
        fontWeight: [400, 600, 700].includes(value.visualSettings.fontWeight ?? 0) ? value.visualSettings.fontWeight : DEFAULT_VISUAL_SETTINGS.fontWeight,
        textAlign: value.visualSettings.textAlign === "center" ? "center" : "left",
        imageZoom: typeof value.visualSettings.imageZoom === "number" && value.visualSettings.imageZoom >= 1 && value.visualSettings.imageZoom <= 3 ? value.visualSettings.imageZoom : 1,
        imagePositionX: typeof value.visualSettings.imagePositionX === "number" && value.visualSettings.imagePositionX >= 0 && value.visualSettings.imagePositionX <= 1 ? value.visualSettings.imagePositionX : 0.5,
        imagePositionY: typeof value.visualSettings.imagePositionY === "number" && value.visualSettings.imagePositionY >= 0 && value.visualSettings.imagePositionY <= 1 ? value.visualSettings.imagePositionY : value.visualSettings.imageCrop === "top" ? 0 : value.visualSettings.imageCrop === "bottom" ? 1 : 0.5,
      },
      savedMarkdown: typeof value.savedMarkdown === "string" ? value.savedMarkdown : null,
      savedAt: typeof value.savedAt === "string" ? value.savedAt : "",
    };
  } catch {
    return null;
  }
}

export function writePublishDraftRecovery(value: Omit<PublishDraftRecovery, "savedAt" | "storageKey">) {
  if (typeof window === "undefined") return false;

  try {
    window.localStorage.setItem(
      currentRecoveryKey(),
      JSON.stringify({ ...value, savedAt: new Date().toISOString() }),
    );
    return true;
  } catch {
    return false;
  }
}

export function clearPublishDraftRecovery(expectedMarkdown?: string, storageKey = currentRecoveryKey()) {
  if (typeof window === "undefined") return;
  try {
    if (expectedMarkdown !== undefined && parseRecovery(window.localStorage.getItem(storageKey), storageKey)?.markdown !== expectedMarkdown) return;
    window.localStorage.removeItem(storageKey);
  } catch { /* Preserve the editor when storage is unavailable. */ }
}
