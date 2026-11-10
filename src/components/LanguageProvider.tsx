"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useWorkspaceStore } from "@/src/lib/useWorkspaceStore";
import { learningModeSettings } from "@/src/lib/languageSettings";
import { translateUiText } from "@/src/lib/copy/en";

type LearningUi = {
  english: boolean;
  targetLanguage: string;
  t: <T>(text: T) => T;
  switchMode: (target: "en" | "zh") => void;
};

const LanguageContext = createContext<LearningUi>({
  english: false,
  targetLanguage: "en",
  t: (text) => text,
  switchMode: () => undefined,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { workspace, updateWorkspace } = useWorkspaceStore();
  const english = workspace.languageSettings.uiLanguage === "en";
  useEffect(() => { document.documentElement.lang = english ? "en" : "zh-CN"; }, [english]);
  const value = useMemo<LearningUi>(() => ({
    english,
    targetLanguage: workspace.languageSettings.targetLanguage,
    t: <T,>(text: T): T => english ? translateUiText(text) : text,
    switchMode: (target) => updateWorkspace(() => ({ languageSettings: learningModeSettings(target) })),
  }), [english, workspace.languageSettings.targetLanguage, updateWorkspace]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLearningUi() { return useContext(LanguageContext); }
