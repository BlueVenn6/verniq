import { translateUiText } from "@/src/lib/copy/en";
import type {
  ContentPipelineItem,
  ExpressionItem,
  FeynmanNote,
  SegmentAnalysis,
  SourceMaterial,
  VocabularyItem,
  WorkspaceState,
} from "@/src/lib/types";

export type PublishSourceKind =
  | "current_material"
  | "material"
  | "feynman"
  | "vocabulary_expression"
  | "analysis"
  | "custom";

export type PublishSource = {
  id: string;
  kind: PublishSourceKind;
  label: string;
  title: string;
  summary: string;
  content: string;
  sourceMaterialId?: string;
  feynmanNoteId?: string;
};

export function buildPublishSources(workspace: WorkspaceState): PublishSource[] {
  const sourcesById = new Map(workspace.sourceMaterials.map((item) => [item.id, item]));
  const sources: PublishSource[] = [];
  const current = workspace.contentPipelineItems.find(
    (item) => item.id === workspace.currentContentId,
  );

  if (current) {
    sources.push(contentItemToPublishSource(current, sourcesById, "current_material"));
  }

  workspace.contentPipelineItems
    .filter((item) => item.id !== current?.id)
    .forEach((item) => sources.push(contentItemToPublishSource(item, sourcesById, "material")));

  const represented = new Set(sources.map((source) => source.sourceMaterialId));
  workspace.sourceMaterials.filter((source) => !represented.has(source.id)).forEach((source) => {
    sources.push({ id: `material:${source.id}`, kind: "material", label: "学习材料",
      title: source.title, summary: trimText(source.cleanedContent, 120),
      content: source.cleanedContent, sourceMaterialId: source.id });
  });

  workspace.feynmanNotes
    .forEach((note) => sources.push(feynmanNoteToPublishSource(note, sourcesById)));

  const vocabularyExpressionSource = buildVocabularyExpressionSource(
    workspace.vocabularyItems,
    workspace.expressionItems,
    sourcesById,
    workspace.languageSettings.uiLanguage,
  );

  if (vocabularyExpressionSource) {
    sources.push(vocabularyExpressionSource);
  }

  workspace.segmentAnalyses
    .filter((analysis) => analysis.articleOverview || analysis.logicReview)
    .forEach((analysis) => sources.push(analysisToPublishSource(analysis, sourcesById)));

  const result = dedupeSources(sources);
  if (workspace.languageSettings.uiLanguage !== "en") return result;
  return result.map((source) => ({ ...source,
    title: source.kind === "vocabulary_expression" ? translateUiText(source.title) : source.title,
    summary: source.kind === "vocabulary_expression" ? translateUiText(source.summary) : source.summary,
  }));
}

export function buildCustomPublishSource(input: string, uiLanguage: string = "zh-CN"): PublishSource | null {
  const content = input.trim();

  if (!content) return null;

  return {
    id: "custom",
    kind: "custom",
    label: "自定义输入",
    title: uiLanguage === "en" ? "Custom content" : "自定义内容",
    summary: trimText(content, 100),
    content,
  };
}

function contentItemToPublishSource(
  item: ContentPipelineItem,
  sourcesById: Map<string, SourceMaterial>,
  kind: "current_material" | "material",
): PublishSource {
  const source = findSourceMaterial(item, sourcesById);
  const content = source?.cleanedContent || item.extractedText || item.rawContent || item.summary || item.description || "";

  return {
    id: `${kind}:${item.id}`,
    kind,
    label: kind === "current_material" ? "当前材料" : "学习材料",
    title: item.title || source?.title || "未命名材料",
    summary: trimText(item.description || item.summary || source?.cleanedContent || content, 120),
    content,
    sourceMaterialId: source?.id,
  };
}

function feynmanNoteToPublishSource(
  note: FeynmanNote,
  sourcesById: Map<string, SourceMaterial>,
): PublishSource {
  const source = sourcesById.get(note.sourceMaterialId);
  const content = [
    note.mainIdea,
    note.ownWordsExplanation || note.userExplanation,
    note.personalConnection,
    note.actionInsight,
    note.nextSteps,
  ].filter(Boolean).join("\n\n");

  return {
    id: `feynman:${note.id}`,
    kind: "feynman",
    label: "费曼笔记",
    title: note.mainIdea || source?.title || "费曼笔记",
    summary: trimText(content || note.aiFeedback, 120),
    content: content || note.aiFeedback,
    sourceMaterialId: note.sourceMaterialId,
    feynmanNoteId: note.id,
  };
}

function buildVocabularyExpressionSource(
  vocabularyItems: VocabularyItem[],
  expressionItems: ExpressionItem[],
  sourcesById: Map<string, SourceMaterial>,
  uiLanguage: string,
): PublishSource | null {
  const vocabulary = vocabularyItems.filter((item) => item.status !== "ignored").slice(0, 8);
  const expressions = expressionItems.filter((item) => item.status !== "ignored").slice(0, 8);

  if (!vocabulary.length && !expressions.length) return null;

  const lines = [
    ...vocabulary.map((item) => {
      const source = sourcesById.get(item.sourceMaterialId);
      return `${item.text}: ${item.meaningZh || item.meaningEn}\n${uiLanguage === "en" ? "Example: " : "例句："}${item.sentence}\n${uiLanguage === "en" ? "Source: " : "来源："}${source?.title ?? ""}`;
    }),
    ...expressions.map((item) => {
      const source = sourcesById.get(item.sourceMaterialId);
      return `${item.text}: ${item.meaningZh || item.meaningEn || item.usageNote}\n${uiLanguage === "en" ? "Example: " : "例句："}${item.sentence}\n${uiLanguage === "en" ? "Source: " : "来源："}${source?.title ?? ""}`;
    }),
  ];

  return {
    id: "vocabulary-expression",
    kind: "vocabulary_expression",
    label: "词汇与表达",
    title: "已保存词汇与表达",
    summary: `包含 ${vocabulary.length} 个词汇、${expressions.length} 条表达。`,
    content: lines.join("\n\n"),
  };
}

function analysisToPublishSource(
  analysis: SegmentAnalysis,
  sourcesById: Map<string, SourceMaterial>,
): PublishSource {
  const source = sourcesById.get(analysis.sourceMaterialId);
  const content = [
    analysis.articleOverview?.summaryZh,
    analysis.articleOverview?.keyIdeas?.join("\n"),
    analysis.logicReview?.structure,
    analysis.logicReview?.authorPosition,
    analysis.logicReview?.usefulQuestions?.join("\n"),
  ].filter(Boolean).join("\n\n");

  return {
    id: `analysis:${analysis.id}`,
    kind: "analysis",
    label: "分析结果",
    title: analysis.articleOverview?.title || source?.title || "材料分析",
    summary: trimText(analysis.articleOverview?.summaryZh || analysis.summary || content, 120),
    content,
    sourceMaterialId: analysis.sourceMaterialId,
  };
}

function findSourceMaterial(
  item: ContentPipelineItem,
  sourcesById: Map<string, SourceMaterial>,
) {
  return sourcesById.get(item.id) ??
    [...sourcesById.values()].find(
      (source) =>
        source.metadata?.contentItemId === item.id ||
        Boolean(item.sourceFileName && source.fileName === item.sourceFileName) ||
        Boolean(item.sourceReference && source.url === item.sourceReference),
    );
}

function dedupeSources(sources: PublishSource[]) {
  const seen = new Set<string>();

  return sources.filter((source) => {
    if (seen.has(source.id)) return false;
    seen.add(source.id);
    return Boolean(source.title.trim() || source.content.trim());
  });
}

function trimText(value: string | undefined, maxLength: number) {
  const text = (value ?? "").replace(/\s+/g, " ").trim();

  if (text.length <= maxLength) return text;
  const prefix = text.slice(0, maxLength - 1);
  // Keep the final English word whole when creating a short source excerpt.
  const complete = /[A-Za-z]$/.test(prefix) && /[A-Za-z]/.test(text[maxLength - 1])
    ? prefix.replace(/\s+\S*$/, "") : prefix;
  return `${complete}…`;
}
