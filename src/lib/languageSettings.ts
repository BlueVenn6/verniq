import type { LanguageSettings } from "@/src/lib/types";

export const SUPPORTED_UI_LANGUAGE_OPTIONS = [
  { value: "zh-CN", label: "简体中文" },
  { value: "en", label: "English" },
] as const;

export const SUPPORTED_TARGET_LANGUAGE_OPTIONS = [
  { value: "en", label: "英语" },
  { value: "zh", label: "中文 · Chinese" },
] as const;

export const SUPPORTED_EXPLANATION_LANGUAGE_OPTIONS = [
  { value: "zh-CN", label: "简体中文" },
  { value: "en", label: "英语" },
] as const;

export const DEFAULT_LANGUAGE_SETTINGS: LanguageSettings = {
  uiLanguage: "zh-CN",
  targetLanguage: "en",
  explanationLanguage: "zh-CN",
};

export function learningModeSettings(targetLanguage: "en" | "zh"): LanguageSettings {
  return targetLanguage === "zh"
    ? { uiLanguage: "en", targetLanguage: "zh", explanationLanguage: "en" }
    : { ...DEFAULT_LANGUAGE_SETTINGS };
}

export function mergeLanguageSettings(value?: Partial<LanguageSettings>): LanguageSettings {
  return normalizeSupportedLanguageSettings({
    ...DEFAULT_LANGUAGE_SETTINGS,
    ...(value ?? {}),
  });
}

export function normalizeSupportedLanguageSettings(
  value?: Partial<LanguageSettings>,
): LanguageSettings {
  const merged = {
    ...DEFAULT_LANGUAGE_SETTINGS,
    ...(value ?? {}),
  };

  return {
    uiLanguage: pickSupportedLanguage(
      merged.uiLanguage,
      SUPPORTED_UI_LANGUAGE_OPTIONS,
      DEFAULT_LANGUAGE_SETTINGS.uiLanguage,
    ),
    targetLanguage: pickSupportedLanguage(
      merged.targetLanguage,
      SUPPORTED_TARGET_LANGUAGE_OPTIONS,
      DEFAULT_LANGUAGE_SETTINGS.targetLanguage,
    ),
    explanationLanguage: pickSupportedLanguage(
      merged.explanationLanguage,
      SUPPORTED_EXPLANATION_LANGUAGE_OPTIONS,
      DEFAULT_LANGUAGE_SETTINGS.explanationLanguage,
    ),
  };
}

export function normalizeLanguageCode(value: string | undefined, fallback: string) {
  const normalized = value?.trim();
  return normalized || fallback;
}

export function getLanguageDisplayName(value: string) {
  return (
    [
      ...SUPPORTED_UI_LANGUAGE_OPTIONS,
      ...SUPPORTED_TARGET_LANGUAGE_OPTIONS,
      ...SUPPORTED_EXPLANATION_LANGUAGE_OPTIONS,
    ].find((option) => option.value === value)?.label ?? value
  );
}

function pickSupportedLanguage(
  value: string,
  options: ReadonlyArray<{ value: string; label: string }>,
  fallback: string,
) {
  return options.some((option) => option.value === value) ? value : fallback;
}
