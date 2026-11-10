import type { AnalyzedExpression, SentenceGrammarAnalysisResult } from "@/src/lib/sentenceGrammarAnalysis";
import { normalizeSelectionText, type ReaderTextSelection } from "@/src/lib/selectionAnalysis";
import type {
  ExpressionItem,
  GrammarNote,
  ReadingSession,
  SourceMaterial,
  WorkspaceState,
} from "@/src/lib/types";

type WorkspaceRecords = Pick<WorkspaceState, "expressionItems" | "grammarNotes" | "readingSessions">;

export function prepareExpressionAnalysisSave({
  workspace,
  source,
  session,
  selection,
  expression,
  now = new Date().toISOString(),
}: {
  workspace: WorkspaceRecords;
  source: SourceMaterial;
  session: ReadingSession;
  selection: ReaderTextSelection;
  expression: AnalyzedExpression;
  now?: string;
}) {
  const text = normalizeSelectionText(expression.text);
  const existing = workspace.expressionItems.find(
    (item) =>
      item.sourceMaterialId === source.id &&
      item.segmentId === selection.segmentId &&
      item.text.toLocaleLowerCase() === text.toLocaleLowerCase(),
  );
  const itemId = existing?.id ?? createId();
  const usageNote = [
    expression.roleInContext ? `本句作用：${expression.roleInContext}` : "",
    expression.usageNote,
    expression.example ? `例句：${expression.example}` : "",
  ].filter(Boolean).join("\n");
  const item: ExpressionItem = existing ?? {
    id: itemId,
    text,
    language: source.language,
    type: expression.type,
    meaningZh: expression.meaning,
    meaningEn: "",
    usageNote,
    sourceMaterialId: source.id,
    segmentId: selection.segmentId,
    sentence: selection.containingSentence,
    status: "new",
    stage: 0,
    tags: ["阅读器分析"],
    createdAt: now,
    updatedAt: now,
  };

  return {
    expressionItems: existing ? workspace.expressionItems : [item, ...workspace.expressionItems],
    readingSessions: workspace.readingSessions.map((entry) =>
      entry.id === session.id
        ? {
            ...entry,
            savedExpressionIds: pushUnique(entry.savedExpressionIds, itemId),
            updatedAt: now,
          }
        : entry,
    ),
    message: existing ? "这个表达已经保存过，已保留现有记录。" : "已保存为表达。",
  };
}

export function prepareGrammarAnalysisSave({
  workspace,
  source,
  selection,
  analysis,
  now = new Date().toISOString(),
}: {
  workspace: WorkspaceRecords;
  source: SourceMaterial;
  selection: ReaderTextSelection;
  analysis: SentenceGrammarAnalysisResult;
  now?: string;
}) {
  const primaryPoint = analysis.grammarPoints[0];
  const title = primaryPoint?.title || `${selection.selectedText.slice(0, 48)} 的结构说明`;
  const existing = workspace.grammarNotes.find(
    (item) =>
      item.sourceMaterialId === source.id &&
      item.segmentId === selection.segmentId &&
      item.title.toLocaleLowerCase() === title.toLocaleLowerCase(),
  );
  const explanation = [
    analysis.overallMeaning ? `句意：${analysis.overallMeaning}` : "",
    ...analysis.grammarPoints.map((point) => `${point.title}：${point.explanation}`),
    ...analysis.structureBreakdown.slice(0, 3).map((part) => `${part.label}：${part.explanation}`),
  ].filter(Boolean).join("\n");
  const note: GrammarNote = existing ?? {
    id: createId(),
    title,
    language: source.language,
    explanationZh: explanation,
    explanationEn: analysis.simplifiedRewrite,
    sourceMaterialId: source.id,
    segmentId: selection.segmentId,
    sentence: selection.containingSentence,
    importance: 3,
    tags: ["阅读器分析"],
    createdAt: now,
    updatedAt: now,
  };

  return {
    grammarNotes: existing ? workspace.grammarNotes : [note, ...workspace.grammarNotes],
    message: existing ? "这个语法笔记已经保存过。" : "已保存语法笔记，暂不会加入间隔复习。",
  };
}

function pushUnique(values: string[], nextValue: string) {
  return values.includes(nextValue) ? values : [nextValue, ...values];
}

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
