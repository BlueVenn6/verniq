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
  AiSendPlan,
  LanguageAnalysisResult,
  LearningSegment,
  SourceMaterial,
} from "@/src/lib/types";

type LanguageAnalysisContext = {
  sourceMaterial: SourceMaterial;
  learningSegments?: LearningSegment[];
  targetLanguage: string;
  nativeLanguage: string;
  userGoal?: string;
  aiProviders: AiProviderConfig[];
  aiModels: AiModelConfig[];
  aiTaskRouting: AiTaskRouting;
  aiPrivacySettings?: AiPrivacySettings;
  allowRemoteMaterial?: boolean;
  signal?: AbortSignal;
  confirmSend?: (plan: AiSendPlan) => boolean;
  modelId?: string;
};

type SegmentLanguageAnalysisContext = LanguageAnalysisContext & {
  segment: LearningSegment;
};

export async function analyzeSourceMaterialForLanguageLearning(
  context: LanguageAnalysisContext,
) {
  return analyzeLanguageContent(context, false);
}

async function analyzeLanguageContent(
  context: LanguageAnalysisContext,
  isSingleSegment: boolean,
) {
  const model = context.aiModels.find(item => item.id === context.modelId);
  const routing = model ? { ...context.aiTaskRouting, languageAnalysis: { providerId: model.providerId, modelId: model.id } } : context.aiTaskRouting;
  const runtime = await resolveTaskRuntimeConfig({
    task: "languageAnalysis",
    capability: "analysis",
    aiProviders: context.aiProviders,
    aiModels: context.aiModels,
    aiTaskRouting: routing,
  });

  if (!runtime.ok) {
    return {
      ok: false as const,
      error: "AI 语言分析暂时不可用，请先配置 AI 服务。",
      analysis: createFallbackLanguageAnalysis(context, runtime.error),
    };
  }

  const content = getLanguageAnalysisContent(context).slice(0, 12000);
  const privacy = context.allowRemoteMaterial
    ? { ...context.aiPrivacySettings, allowFullMaterialToRemote: true } as AiPrivacySettings
    : context.aiPrivacySettings;
  const sendPlan = createAiSendPlan({
    task: "languageAnalysis",
    provider: runtime.provider,
    model: runtime.model,
    contentScope: isSingleSegment ? "current_segment_only" : "source_material_full_or_truncated",
    contentText: content,
    includesFullMaterial: !isSingleSegment,
    includesSensitiveContent: false,
    privacySettings: privacy,
  });
  const policy = checkAiSendPolicy(sendPlan, privacy);

  if (!policy.allowed) {
    const message = policy.reason || "当前 AI 发送设置阻止了这次语言分析请求。";

    return {
      ok: false as const,
      error: message,
      analysis: createFallbackLanguageAnalysis(context, message),
      sendPlan,
    };
  }

  try {
    if (sendPlan.requiresUserConfirmation && context.confirmSend && !context.confirmSend(sendPlan)) throw new Error("已取消本次分析。");
    if (context.signal?.aborted) throw new Error("已取消本次分析。");
    const result = await routeLlmChat({
      ...runtime.request,
      signal: context.signal,
      systemPrompt: buildLanguageAnalysisSystemPrompt(),
      temperature: 0.25,
      maxTokens: 2200,
      messages: [
        {
          role: "user",
          content: buildSourceMaterialPrompt(context, content),
        },
      ],
    });
    const analysis = parseLanguageAnalysisResponse(
      result.text,
      context.sourceMaterial,
      runtime.modelLabel,
    );

    return {
      ok: true as const,
      analysis,
      modelLabel: runtime.modelLabel,
      sendPlan,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "AI 语言分析失败，请稍后重试。";

    return {
      ok: false as const,
      error: message,
      analysis: createFallbackLanguageAnalysis(context, message),
      sendPlan,
    };
  }
}

export async function analyzeLearningSegmentForLanguageLearning(
  context: SegmentLanguageAnalysisContext,
) {
  return analyzeLanguageContent({
    ...context,
    sourceMaterial: {
      ...context.sourceMaterial,
      cleanedContent: context.segment.text,
      originalContent: context.segment.text,
    },
    learningSegments: [context.segment],
  }, true);
}

export function toSegmentAnalysisRecord(
  analysis: LanguageAnalysisResult,
  sourceMaterial: SourceMaterial,
) {
  return {
    id: createId(),
    sourceMaterialId: sourceMaterial.id,
    segmentId: "",
    summary: analysis.articleOverview.summaryZh,
    difficulty: analysis.articleOverview.difficulty,
    vocabularyCandidateIds: [],
    expressionCandidateIds: [],
    grammarNoteIds: [],
    cultureNoteIds: [],
    logicNotes: analysis.logicReview.structure,
    createdAt: analysis.createdAt,
    articleOverview: analysis.articleOverview,
    vocabularyCandidates: analysis.vocabularyCandidates,
    expressionCandidates: analysis.expressionCandidates,
    grammarCandidates: analysis.grammarCandidates,
    cultureCandidates: analysis.cultureCandidates,
    logicReview: analysis.logicReview,
    learningSuggestions: analysis.learningSuggestions,
    rawModelOutput: analysis.rawModelOutput,
    status: analysis.status ?? "completed",
    errorMessage: analysis.errorMessage,
  };
}

export function buildLanguageAnalysisSystemPrompt() {
  return [
    "You are a language-learning analysis engine for an interest/work/problem-driven reading workspace.",
    UNTRUSTED_SOURCE_GUARD,
    "Your job is to generate learning candidates and explanations, not to save items for the user.",
    "Use the Native language from the user message as the explanation language.",
    "The legacy articleOverview.summaryZh field uses the selected explanation language. Vocabulary and grammar fields meaningZh/explanationZh must be Chinese, while meaningEn/explanationEn must be English, so saved language items remain bilingual.",
    "When the selected explanation language is English, English explanations are acceptable and expected.",
    "Do not write a Feynman summary for the user.",
    "Do not generate blog posts, social posts, product copy, or publishing output.",
    "Do not explain everything as important. Select only useful learning candidates.",
    "If there are no clear idioms, cultural references, or register notes, return empty arrays.",
    "Vocabulary candidates must be few and high-value.",
    "Expression candidates must be reusable real expressions, collocations, idioms, sentence patterns, or fixed phrases.",
    "Grammar points must explain why the pattern is worth learning in this context.",
    "Culture points must be grounded in the source text; do not make broad generic claims.",
    "Return JSON only, with no markdown fence and no extra commentary.",
    "Use exactly this shape:",
    JSON.stringify({
      articleOverview: {
        title: "string",
        topic: "string",
        summaryZh: "string",
        summaryInTargetLanguage: "string",
        difficulty: "string",
        readingGoal: "string",
        keyIdeas: ["string"],
      },
      vocabularyCandidates: [
        {
          text: "string",
          lemma: "string",
          partOfSpeech: "string",
          sentence: "string",
          meaningZh: "string",
          meaningEn: "string",
          reason: "string",
          level: "string",
          segmentId: "string optional",
        },
      ],
      expressionCandidates: [
        {
          text: "string",
          type: "collocation | phrasal_verb | idiom | fixed_expression | sentence_pattern | other",
          sentence: "string",
          meaningZh: "string",
          meaningEn: "string",
          usageNote: "string",
          reason: "string",
          segmentId: "string optional",
        },
      ],
      grammarCandidates: [
        {
          title: "string",
          sentence: "string",
          explanationZh: "string",
          explanationEn: "string",
          importance: 1,
          segmentId: "string optional",
        },
      ],
      cultureCandidates: [
        {
          title: "string",
          term: "string",
          culturalContext: "string",
          explanationZh: "string",
          explanationEn: "string",
          segmentId: "string optional",
        },
      ],
      logicReview: {
        structure: "string",
        authorPosition: "string",
        keyArguments: ["string"],
        implicitAssumptions: ["string"],
        usefulQuestions: ["string"],
      },
      learningSuggestions: [
        {
          title: "string",
          reason: "string",
          action: "string",
        },
      ],
    }),
  ].join("\n");
}

function getLanguageAnalysisContent(context: LanguageAnalysisContext) {
  const segmentsText = (context.learningSegments ?? [])
    .map((segment) => `[${segment.id}] ${segment.text}`)
    .join("\n\n");

  return (
    segmentsText ||
    context.sourceMaterial.cleanedContent ||
    context.sourceMaterial.originalContent
  );
}

export function buildSourceMaterialPrompt(context: LanguageAnalysisContext, content: string) {
  return [
    `SourceMaterial ID: ${context.sourceMaterial.id}`,
    `Title: ${context.sourceMaterial.title}`,
    `Material language: ${context.sourceMaterial.language || context.targetLanguage}`,
    `Target language: ${context.targetLanguage}`,
    `Native language: ${context.nativeLanguage}`,
    "Write articleOverview.summaryZh, keyIdeas, topic, readingGoal and learning suggestions in the requested Native language (the summaryZh field name is retained for compatibility). Write summaryInTargetLanguage in the target language. Keep meaningZh/explanationZh Chinese and meaningEn/explanationEn English for bilingual vocabulary.",
    `User goal: ${context.userGoal || "General language-learning reading practice."}`,
    "Extract the article's main idea and 3–5 grounded key ideas, then select useful language-learning candidates. Do not substitute the opening excerpt for a summary.",
    UNTRUSTED_SOURCE_GUARD,
    "Source text:",
    content.slice(0, 12000),
  ].join("\n");
}

function parseLanguageAnalysisResponse(
  text: string,
  sourceMaterial: SourceMaterial,
  modelLabel: string,
): LanguageAnalysisResult {
  const jsonText = extractJsonBlock(text.trim());
  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("AI 返回的文章分析格式无效，未保存。请重试，原有分析已保留。");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI 返回的文章分析格式无效，未保存。请重试，原有分析已保留。");
  }
  const overview = (parsed as Partial<LanguageAnalysisResult>).articleOverview;
  if (!overview || typeof overview !== "object" ||
    ![overview.summaryZh, overview.summaryInTargetLanguage].some((value) => typeof value === "string" && value.trim()) ||
    !normalizeStringArray(overview.keyIdeas).length) {
    throw new Error("AI 未返回有效的文章主旨和重点，请重试。原有分析已保留。");
  }

  return normalizeLanguageAnalysisResult(
    parsed as Partial<LanguageAnalysisResult>,
    sourceMaterial,
    text,
    modelLabel,
  );
}

function normalizeLanguageAnalysisResult(
  parsed: Partial<LanguageAnalysisResult>,
  sourceMaterial: SourceMaterial,
  rawModelOutput: string,
  modelLabel: string,
): LanguageAnalysisResult {
  const now = new Date().toISOString();
  const overview = parsed.articleOverview ?? createFallbackOverview(sourceMaterial);

  return {
    sourceMaterialId: sourceMaterial.id,
    articleOverview: {
      title: String(overview.title || sourceMaterial.title),
      topic: String(overview.topic || ""),
      summaryZh: String(overview.summaryZh || ""),
      summaryInTargetLanguage: String(overview.summaryInTargetLanguage || ""),
      difficulty: String(overview.difficulty || ""),
      readingGoal: String(overview.readingGoal || ""),
      keyIdeas: normalizeStringArray(overview.keyIdeas),
    },
    vocabularyCandidates: normalizeArray(parsed.vocabularyCandidates).map((item) => ({
      text: String(item.text || ""),
      lemma: String(item.lemma || item.text || ""),
      partOfSpeech: String(item.partOfSpeech || "unknown"),
      sentence: String(item.sentence || ""),
      meaningZh: String(item.meaningZh || ""),
      meaningEn: String(item.meaningEn || ""),
      reason: String(item.reason || ""),
      level: String(item.level || ""),
      segmentId: typeof item.segmentId === "string" ? item.segmentId : undefined,
    })).filter((item) => item.text.trim()),
    expressionCandidates: normalizeArray(parsed.expressionCandidates).map((item) => ({
      text: String(item.text || ""),
      type: normalizeExpressionType(item.type),
      sentence: String(item.sentence || ""),
      meaningZh: String(item.meaningZh || ""),
      meaningEn: String(item.meaningEn || ""),
      usageNote: String(item.usageNote || ""),
      reason: String(item.reason || ""),
      segmentId: typeof item.segmentId === "string" ? item.segmentId : undefined,
    })).filter((item) => item.text.trim()),
    grammarCandidates: normalizeArray(parsed.grammarCandidates).map((item) => ({
      title: String(item.title || ""),
      sentence: String(item.sentence || ""),
      explanationZh: String(item.explanationZh || ""),
      explanationEn: String(item.explanationEn || ""),
      importance: normalizeImportance(item.importance),
      segmentId: typeof item.segmentId === "string" ? item.segmentId : undefined,
    })).filter((item) => item.title.trim()),
    cultureCandidates: normalizeArray(parsed.cultureCandidates).map((item) => ({
      title: String(item.title || ""),
      term: String(item.term || ""),
      culturalContext: String(item.culturalContext || ""),
      explanationZh: String(item.explanationZh || ""),
      explanationEn: String(item.explanationEn || ""),
      segmentId: typeof item.segmentId === "string" ? item.segmentId : undefined,
    })).filter((item) => item.title.trim() || item.term.trim()),
    logicReview: {
      structure: String(parsed.logicReview?.structure || ""),
      authorPosition: String(parsed.logicReview?.authorPosition || ""),
      keyArguments: normalizeStringArray(parsed.logicReview?.keyArguments),
      implicitAssumptions: normalizeStringArray(parsed.logicReview?.implicitAssumptions),
      usefulQuestions: normalizeStringArray(parsed.logicReview?.usefulQuestions),
    },
    learningSuggestions: normalizeArray(parsed.learningSuggestions).map((item) => ({
      title: String(item.title || ""),
      reason: String(item.reason || ""),
      action: String(item.action || ""),
    })).filter((item) => item.title.trim()),
    createdAt: now,
    rawModelOutput,
    status: "completed",
    modelUsed: modelLabel,
  };
}

function createFallbackLanguageAnalysis(
  context: LanguageAnalysisContext,
  errorMessage: string,
): LanguageAnalysisResult {
  const now = new Date().toISOString();

  return {
    sourceMaterialId: context.sourceMaterial.id,
    articleOverview: createFallbackOverview(context.sourceMaterial),
    vocabularyCandidates: [],
    expressionCandidates: [],
    grammarCandidates: [],
    cultureCandidates: [],
    logicReview: {
      structure: "AI 语言分析暂时不可用，请先配置 AI 服务。",
      authorPosition: "",
      keyArguments: [],
      implicitAssumptions: [],
      usefulQuestions: [],
    },
    learningSuggestions: [],
    createdAt: now,
    status: "failed",
    errorMessage,
  };
}

function createFallbackOverview(sourceMaterial: SourceMaterial) {
  const content = sourceMaterial.cleanedContent || sourceMaterial.originalContent;

  return {
    title: sourceMaterial.title,
    topic: "",
    summaryZh: content.slice(0, 240),
    summaryInTargetLanguage: content.slice(0, 240),
    difficulty: "",
    readingGoal: "Read the material and manually save useful language items.",
    keyIdeas: [],
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

function normalizeArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    : [];
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
}

function normalizeImportance(value: unknown) {
  const numeric = Number(value);

  return Number.isFinite(numeric) ? Math.max(1, Math.min(5, numeric)) : 3;
}

function normalizeExpressionType(value: unknown) {
  const allowed = new Set([
    "collocation",
    "phrasal_verb",
    "idiom",
    "fixed_expression",
    "sentence_pattern",
    "other",
  ]);
  const text = String(value || "");

  return allowed.has(text) ? text as "collocation" | "phrasal_verb" | "idiom" | "fixed_expression" | "sentence_pattern" | "other" : "other";
}

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
