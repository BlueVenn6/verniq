import type { SourceMaterial, WorkspaceState } from "@/src/lib/types";

export type SourceLearningStage =
  | "New"
  | "Reading"
  | "Analyzed"
  | "Explained"
  | "Output Drafted";

export type SourceMaterialLearningStatus = {
  hasReadingSession: boolean;
  vocabularyCount: number;
  expressionCount: number;
  hasAnalysis: boolean;
  hasFeynmanNote: boolean;
  outputDraftCount: number;
  currentStage: SourceLearningStage;
};

export function getSourceMaterialLearningStatus(
  sourceMaterial: SourceMaterial,
  workspace: WorkspaceState,
): SourceMaterialLearningStatus {
  const readingSessions = workspace.readingSessions.filter(
    (session) => session.sourceMaterialId === sourceMaterial.id,
  );
  const feynmanNotes = workspace.feynmanNotes.filter(
    (note) => note.sourceMaterialId === sourceMaterial.id,
  );
  const feynmanNoteIds = new Set(feynmanNotes.map((note) => note.id));
  const outputDraftCount = workspace.outputDrafts.filter((draft) =>
    feynmanNoteIds.has(draft.feynmanNoteId),
  ).length;
  const hasAnalysis = workspace.segmentAnalyses.some(
    (analysis) => analysis.sourceMaterialId === sourceMaterial.id,
  );
  const hasFeynmanNote = feynmanNotes.length > 0;
  const hasReadingSession = readingSessions.length > 0;

  return {
    hasReadingSession,
    vocabularyCount: workspace.vocabularyItems.filter(
      (item) => item.sourceMaterialId === sourceMaterial.id,
    ).length,
    expressionCount: workspace.expressionItems.filter(
      (item) => item.sourceMaterialId === sourceMaterial.id,
    ).length,
    hasAnalysis,
    hasFeynmanNote,
    outputDraftCount,
    currentStage: resolveCurrentStage({
      hasReadingSession,
      hasAnalysis,
      hasFeynmanNote,
      outputDraftCount,
    }),
  };
}

function resolveCurrentStage({
  hasReadingSession,
  hasAnalysis,
  hasFeynmanNote,
  outputDraftCount,
}: {
  hasReadingSession: boolean;
  hasAnalysis: boolean;
  hasFeynmanNote: boolean;
  outputDraftCount: number;
}): SourceLearningStage {
  if (outputDraftCount > 0) return "Output Drafted";
  if (hasFeynmanNote) return "Explained";
  if (hasAnalysis) return "Analyzed";
  if (hasReadingSession) return "Reading";
  return "New";
}
