const stringArrays = new Set([
  "tags", "categoryIds", "moduleIds", "productIds", "platformIds", "savedVocabularyIds",
  "savedExpressionIds", "publishSourceChoiceIds", "keyIdeas", "vocabularyCandidateIds",
  "expressionCandidateIds", "grammarNoteIds", "cultureNoteIds",
]);
const strings = new Set([
  "id", "title", "text", "sourceMaterialId", "segmentId", "createdAt", "updatedAt",
  "startedAt", "completedAt", "language", "lemma", "meaningZh", "meaningEn", "sentence",
  "pronunciation", "partOfSpeech", "usageNote", "notes", "mainIdea", "ownWordsExplanation",
  "userExplanation", "personalConnection", "nextAction", "followUpQuestion", "content",
  "originalContent", "cleanedContent", "publishCustomInput", "summary", "explanationZh", "explanationEn",
]);
const recordArrays = new Set([
  "vocabularyCandidates", "expressionCandidates", "grammarCandidates", "cultureCandidates", "learningSuggestions",
]);

export function validateNestedRecord(record: Record<string, unknown>, path: string, errors: string[]) {
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined) continue;
    if (strings.has(key) && typeof value !== "string") errors.push(`${path}.${key} 必须是字符串。`);
    if (key === "id" && typeof value === "string" && !value.trim()) errors.push(`${path}.id 不能为空。`);
    if (stringArrays.has(key) && (!Array.isArray(value) || value.some(item => typeof item !== "string"))) errors.push(`${path}.${key} 必须是字符串数组。`);
    if (recordArrays.has(key) && (!Array.isArray(value) || value.some(item => !isRecord(item)))) errors.push(`${path}.${key} 必须是对象数组。`);
    if (key === "progress" && (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100)) errors.push(`${path}.progress 必须在 0 到 100 之间。`);
    if (["index", "startOffset", "endOffset", "currentSegmentIndex", "stage"].includes(key) && (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)) errors.push(`${path}.${key} 必须是非负整数。`);
    if (["metadata", "publishVisualSettings", "publishDraftSettings", "articleOverview"].includes(key) && !isRecord(value)) errors.push(`${path}.${key} 必须是对象。`);
  }
  if (isRecord(record.articleOverview)) validateNestedRecord(record.articleOverview, `${path}.articleOverview`, errors);
  if (record.srs !== undefined) validateSrs(record.srs, `${path}.srs`, errors);
}

function validateSrs(value: unknown, path: string, errors: string[]) {
  if (!isRecord(value)) { errors.push(`${path} 必须是对象。`); return; }
  for (const key of ["dueAt", "createdAt", "updatedAt", "lastReviewedAt"]) {
    if (key === "lastReviewedAt" && value[key] === undefined) continue;
    if (typeof value[key] !== "string" || !Number.isFinite(Date.parse(value[key] as string))) errors.push(`${path}.${key} 不是有效日期。`);
  }
  for (const key of ["stability", "difficulty", "elapsedDays", "scheduledDays", "learningSteps", "reps", "lapses"]) {
    const metric = value[key];
    if (typeof metric !== "number" || !Number.isFinite(metric) || metric < 0 || (["learningSteps", "reps", "lapses"].includes(key) && !Number.isSafeInteger(metric))) errors.push(`${path}.${key} 不是有效的复习数值。`);
  }
  if (!["New", "Learning", "Review", "Relearning"].includes(value.state as string)) errors.push(`${path}.state 无效。`);
  if (!Array.isArray(value.reviewHistory)) { errors.push(`${path}.reviewHistory 必须是数组。`); return; }
  value.reviewHistory.forEach((entry, index) => {
    if (!isRecord(entry) || !["again", "hard", "good", "easy"].includes(entry.rating as string)
      || typeof entry.reviewedAt !== "string" || !Number.isFinite(Date.parse(entry.reviewedAt))
      || typeof entry.dueAt !== "string" || !Number.isFinite(Date.parse(entry.dueAt))) errors.push(`${path}.reviewHistory[${index}] 无效。`);
  });
}

export function validateWorkspaceObjects(data: Record<string, unknown>, errors: string[]) {
  for (const field of ["languageSettings", "aiPrivacySettings"]) {
    if (!(field in data)) continue;
    const object = data[field];
    if (!isRecord(object)) { errors.push(`${field} 必须是对象。`); continue; }
    for (const [key, value] of Object.entries(object)) {
      const expected = field === "aiPrivacySettings" ? "boolean" : "string";
      if (typeof value !== expected) errors.push(`${field}.${key} 必须是 ${expected}。`);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
