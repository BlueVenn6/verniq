import { resolveTaskRuntimeConfig } from "@/src/lib/llm/config";
import { routeLlmChat } from "@/src/lib/llm/router";
import {
  checkAiSendPolicy,
  createAiSendPlan,
  UNTRUSTED_SOURCE_GUARD,
} from "@/src/lib/llm/sendPlan";
import type {
  AiModelConfig,
  AiPrivacySettings,
  AiProviderConfig,
  AiTaskRouting,
  FeynmanFeedback,
  FeynmanNote,
  ReadingSession,
  SegmentAnalysis,
  SourceMaterial,
} from "@/src/lib/types";

export type FeynmanPromptSet = {
  mainIdea: string;
  ownWordsExplanation: string;
  learned: string;
  personalConnection: string;
  questions: string;
  nextSteps: string;
};

export type FeynmanDraftInput = {
  mainIdea: string;
  ownWordsExplanation: string;
  personalConnection: string;
  questions: string;
  nextSteps: string;
};

type FeynmanPromptContext = {
  sourceMaterial: SourceMaterial;
  readingSession: ReadingSession;
  segmentAnalysis?: SegmentAnalysis | null;
  targetLanguage: string;
  nativeLanguage: string;
  userGoal?: string;
};

type FeynmanFeedbackContext = FeynmanPromptContext & {
  draft: FeynmanDraftInput;
  aiProviders: AiProviderConfig[];
  aiModels: AiModelConfig[];
  aiTaskRouting: AiTaskRouting;
  aiPrivacySettings?: AiPrivacySettings;
};

export function createFeynmanPromptSet(context: FeynmanPromptContext): FeynmanPromptSet {
  if (context.nativeLanguage.toLowerCase().startsWith("zh")) {
    return {
      mainIdea: "这篇材料最核心的意思是什么？",
      ownWordsExplanation: "请不用照抄原文，用你自己的话解释一遍。",
      learned: "你从里面学到了什么？",
      personalConnection: "它和你的兴趣、工作或生活有什么关系？",
      questions: "你读完之后还留下了什么问题？",
      nextSteps: "基于这篇材料，你下一步可以做什么？",
    };
  }

  return {
    mainIdea: "What is the main idea of this material?",
    ownWordsExplanation: "Explain it in your own words.",
    learned: "What did you learn from it?",
    personalConnection: "How does this connect to your real interest, work, or life?",
    questions: "What question do you still have?",
    nextSteps: "What can you do next based on this?",
  };
}

export async function reviewFeynmanNoteWithAi(context: FeynmanFeedbackContext) {
  const runtime = await resolveTaskRuntimeConfig({
    task: "feynmanFeedback",
    capability: "analysis",
    aiProviders: context.aiProviders,
    aiModels: context.aiModels,
    aiTaskRouting: context.aiTaskRouting,
  });

  if (!runtime.ok) {
    return {
      ok: false as const,
      error: "AI 费曼反馈暂时不可用，请先配置 AI 服务。",
    };
  }

  const contentText = buildFeynmanSendContent(context);
  const sendPlan = createAiSendPlan({
    task: "feynmanFeedback",
    provider: runtime.provider,
    model: runtime.model,
    contentScope: "feynman_note_only",
    contentText,
    includesFullMaterial: false,
    includesSensitiveContent: false,
    privacySettings: context.aiPrivacySettings,
  });
  const policy = checkAiSendPolicy(sendPlan, context.aiPrivacySettings);

  if (!policy.allowed) {
    return {
      ok: false as const,
      error: policy.reason || "当前 AI 发送设置阻止了这次费曼反馈请求。",
      sendPlan,
    };
  }

  try {
    const result = await routeLlmChat({
      ...runtime.request,
      systemPrompt: buildFeynmanFeedbackSystemPrompt(),
      temperature: 0.25,
      maxTokens: 1400,
      messages: [
        {
          role: "user",
          content: buildFeynmanFeedbackPrompt(context),
        },
      ],
    });
    const feedback = parseFeynmanFeedback(result.text);

    return {
      ok: true as const,
      feedback,
      modelLabel: runtime.modelLabel,
      sendPlan,
    };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "AI 费曼反馈失败，请稍后重试。",
      sendPlan,
    };
  }
}

export function createFeynmanNoteRecord({
  sourceMaterial,
  readingSession,
  draft,
  feedback,
  existingNote,
}: {
  sourceMaterial: SourceMaterial;
  readingSession: ReadingSession;
  draft: FeynmanDraftInput;
  feedback?: FeynmanFeedback | null;
  existingNote?: FeynmanNote | null;
}): FeynmanNote {
  const now = new Date().toISOString();
  const userExplanation = [
    draft.mainIdea.trim(),
    draft.ownWordsExplanation.trim(),
    draft.questions.trim() ? `Questions: ${draft.questions.trim()}` : "",
  ].filter(Boolean).join("\n\n");

  return {
    id: existingNote?.id ?? createId(),
    sourceMaterialId: sourceMaterial.id,
    readingSessionId: readingSession.id,
    goalId: sourceMaterial.goalId,
    userExplanation,
    personalConnection: draft.personalConnection.trim(),
    actionInsight: draft.nextSteps.trim(),
    aiFeedback: feedback?.feedbackSummary ?? existingNote?.aiFeedback ?? "",
    clarityScore: feedback?.clarityScore ?? existingNote?.clarityScore ?? 0,
    accuracyScore: feedback?.accuracyScore ?? existingNote?.accuracyScore ?? 0,
    createdAt: existingNote?.createdAt ?? now,
    updatedAt: now,
    mainIdea: draft.mainIdea.trim(),
    ownWordsExplanation: draft.ownWordsExplanation.trim(),
    questions: draft.questions.trim(),
    nextSteps: draft.nextSteps.trim(),
    feedbackStrengths: feedback?.strengths ?? existingNote?.feedbackStrengths,
    feedbackMissingPoints: feedback?.missingKeyPoints ?? existingNote?.feedbackMissingPoints,
    feedbackLanguageSuggestions:
      feedback?.languageSuggestions ?? existingNote?.feedbackLanguageSuggestions,
    feedbackNextQuestions: feedback?.nextQuestions ?? existingNote?.feedbackNextQuestions,
  };
}

function buildFeynmanFeedbackSystemPrompt() {
  return [
    "You are reviewing a user's Feynman learning note.",
    UNTRUSTED_SOURCE_GUARD,
    "Give feedback only. Do not rewrite the whole answer for the user.",
    "Do not replace the user's explanation.",
    "Do not generate blog posts, publishing content, product copy, or video scripts.",
    "Keep the user's own thinking as the center.",
    "Point out unclear logic, missing points, or possible misunderstandings.",
    "Language suggestions must be short and actionable.",
    "If the answer is too short, ask follow-up questions instead of generating a full answer.",
    "Do not pretend the user understood things they did not write.",
    "Return JSON only, with no markdown fence and no extra commentary.",
    "Use exactly this shape:",
    JSON.stringify({
      clarityScore: 0,
      accuracyScore: 0,
      strengths: ["string"],
      possibleMisunderstandings: ["string"],
      missingKeyPoints: ["string"],
      languageSuggestions: ["string"],
      nextQuestions: ["string"],
      actionSuggestions: ["string"],
      feedbackSummary: "string",
    }),
  ].join("\n");
}

function buildFeynmanFeedbackPrompt(context: FeynmanFeedbackContext) {
  return [
    `Source title: ${context.sourceMaterial.title}`,
    `Target language: ${context.targetLanguage}`,
    `Native language: ${context.nativeLanguage}`,
    `User goal: ${context.userGoal || "General learning"}`,
    `Article overview: ${context.segmentAnalysis?.articleOverview?.summaryZh || context.sourceMaterial.cleanedContent.slice(0, 800)}`,
    `Key ideas: ${context.segmentAnalysis?.articleOverview?.keyIdeas?.join("; ") || "Not available"}`,
    UNTRUSTED_SOURCE_GUARD,
    "User's Feynman note:",
    `Main idea: ${context.draft.mainIdea}`,
    `Own words explanation: ${context.draft.ownWordsExplanation}`,
    `Personal connection: ${context.draft.personalConnection}`,
    `Questions: ${context.draft.questions}`,
    `Next action: ${context.draft.nextSteps}`,
    "Review the user's note. Give feedback only.",
  ].join("\n");
}

function buildFeynmanSendContent(context: FeynmanFeedbackContext) {
  return [
    context.segmentAnalysis?.articleOverview?.summaryZh || "",
    context.draft.mainIdea,
    context.draft.ownWordsExplanation,
    context.draft.personalConnection,
    context.draft.questions,
    context.draft.nextSteps,
  ].join("\n");
}

function parseFeynmanFeedback(text: string): FeynmanFeedback {
  const jsonText = extractJsonBlock(text.trim());
  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("AI returned feedback, but it was not parseable JSON.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI returned an invalid Feynman feedback shape.");
  }

  const candidate = parsed as Partial<FeynmanFeedback>;

  return {
    clarityScore: normalizeScore(candidate.clarityScore),
    accuracyScore: normalizeScore(candidate.accuracyScore),
    strengths: normalizeStringArray(candidate.strengths),
    possibleMisunderstandings: normalizeStringArray(candidate.possibleMisunderstandings),
    missingKeyPoints: normalizeStringArray(candidate.missingKeyPoints),
    languageSuggestions: normalizeStringArray(candidate.languageSuggestions),
    nextQuestions: normalizeStringArray(candidate.nextQuestions),
    actionSuggestions: normalizeStringArray(candidate.actionSuggestions),
    feedbackSummary: String(candidate.feedbackSummary || "").trim(),
  };
}

function extractJsonBlock(text: string) {
  const fencedMatch = text.match(/```json\s*([\s\S]*?)```/i) ?? text.match(/```\s*([\s\S]*?)```/i);

  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBraceIndex = text.indexOf("{");
  const lastBraceIndex = text.lastIndexOf("}");

  if (firstBraceIndex >= 0 && lastBraceIndex > firstBraceIndex) {
    return text.slice(firstBraceIndex, lastBraceIndex + 1);
  }

  return text;
}

function normalizeScore(value: unknown) {
  const numeric = Number(value);

  return Number.isFinite(numeric) ? Math.max(0, Math.min(100, Math.round(numeric))) : 0;
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
}

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
