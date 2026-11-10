import type { LlmProvider } from "@/src/lib/llm/types";

export type WorkspaceSourceType = "文本" | "链接" | "PDF" | "图片" | "MD";

export type WorkspaceSource = {
  id: string;
  title: string;
  type: WorkspaceSourceType;
  content: string;
  area?: string;
  sourceUrl?: string;
  dataUrl?: string;
  mimeType?: string;
  importedAt: string;
};

export type WorkspaceRecordType =
  | "划线"
  | "词"
  | "句子"
  | "表达"
  | "想法"
  | "我的翻译"
  | "参考译文";

export type WorkspaceRecord = {
  id: string;
  type: WorkspaceRecordType;
  text: string;
  note?: string;
  area?: string;
  tool?: string;
  sourceTitle?: string;
  createdAt: string;
};

export type WorkspaceActivityType =
  | "导入资料"
  | "保存记录"
  | "模型调用"
  | "保存表达"
  | "翻译练习";

export type WorkspaceActivity = {
  id: string;
  type: WorkspaceActivityType;
  area?: string;
  tool?: string;
  sourceTitle?: string;
  createdAt: string;
};

export type WorkspaceCompareItem = {
  id: string;
  original: string;
  mine: string;
  reference: string;
  note: string;
};

export type WorkspaceSourceDraft = {
  myTranslation: string;
  referenceText: string;
  noteText: string;
  promptInput: string;
  savedExpression: string;
  resultText: string;
  compareNote: string;
  sentenceCompareItems: WorkspaceCompareItem[];
};

export type ModelConfig = {
  id: string;
  name: string;
  provider: LlmProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  useCustomEndpoint: boolean;
  useLocal: boolean;
  temperature: number;
  maxTokens: number;
  remember: boolean;
};

export type StudioMode = "self" | "assist";

export type StudioTool =
  | "understand"
  | "reply"
  | "express"
  | "translate_practice";
