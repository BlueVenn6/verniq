"use client";


import { useLearningUi } from "@/src/components/LanguageProvider";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createFeynmanNoteRecord,
  reviewFeynmanNoteWithAi,
  type FeynmanDraftInput,
} from "@/src/lib/feynman";
import {
  dictionaryResultToVocabularyFields,
  lookupDictionary,
  type DictionaryLookupResult,
} from "@/src/lib/dictionary";
import { ReaderAssistant } from "./ReaderAssistant";
import { FullTextSelect } from "@/src/components/FullTextSelect";
import { ReaderSelectionPanel } from "@/src/components/reader/ReaderSelectionPanel";
import { SelectionPopover, type SelectionAnchor } from "@/src/components/reader/SelectionPopover";
import { WordExplanationPanel } from "@/src/components/reader/WordExplanationPanel";
import { PronunciationControl } from "@/src/components/reader/PronunciationControl";
import {
  analyzeReaderSelectionForLanguageLearning,
  type SelectionAnalysisKind,
  type SentenceGrammarAnalysisResult,
} from "@/src/lib/sentenceGrammarAnalysis";
import {
  createReaderTextSelection,
  normalizeSelectionText,
  type ReaderTextSelection,
} from "@/src/lib/selectionAnalysis";
import {
  prepareExpressionAnalysisSave,
  prepareGrammarAnalysisSave,
} from "@/src/lib/readerSelectionRecords";
import { getSourceMaterialLearningStatus } from "@/src/lib/learningStatus";
import { normalizeLanguageCode } from "@/src/lib/languageSettings";
import { describeDocumentReadError } from "@/src/lib/ingest";
import { createLearningSegmentsForSourceMaterial } from "@/src/lib/sourceIngestion";
import { UI_COPY_ZH } from "@/src/lib/uiCopy";
import { readFeynmanDraft, writeFeynmanDraft } from "@/src/lib/feynmanDraftStorage";
import { useWorkspaceStore } from "@/src/lib/useWorkspaceStore";
import type {
  CultureCandidate,
  CultureNote,
  ExpressionCandidate,
  ExpressionItem,
  FeynmanFeedback,
  FeynmanNote,
  GrammarCandidate,
  GrammarNote,
  LearningSegment,
  ReadingSession,
  SegmentAnalysis,
  SourceMaterial,
  VocabularyCandidate,
  VocabularyItem,
} from "@/src/lib/types";

export function ReaderWorkspace() {
  const { t, switchMode } = useLearningUi();
  const { workspace, updateWorkspace } = useWorkspaceStore();
  const [activeSourceId, setActiveSourceId] = useState("");
  const [selection, setSelection] = useState<ReaderTextSelection | null>(null);
  const [message, setMessage] = useState("");
  const [dictionaryPending, setDictionaryPending] = useState(false);
  const [dictionaryResult, setDictionaryResult] = useState<DictionaryLookupResult | null>(null);
  const [dictionaryError, setDictionaryError] = useState("");
  const [selectionMeaning, setSelectionMeaning] = useState("");
  const [selectionMeaningZh, setSelectionMeaningZh] = useState("");
  const [usingAiMeaning, setUsingAiMeaning] = useState(false);
  const [fontSize, setFontSize] = useState(18);
  const [readingFocus, setReadingFocus] = useState(false);
  const [selectionAnchor, setSelectionAnchor] = useState<SelectionAnchor | null>(null);
  const [learningToolsOpen, setLearningToolsOpen] = useState(false);
  const [explainWordOnOpen, setExplainWordOnOpen] = useState(false);
  const learningToolsRef = useRef<HTMLDivElement>(null);
  const dictionaryRequestId = useRef(0);
  const [assistantTab, setAssistantTab] = useState<"chat" | "note" | "selection">("chat");
  const [highlightRequest, setHighlightRequest] = useState(0);
  const [currentNote, setCurrentNote] = useState("");
  const [selectionAnalysisPending, setSelectionAnalysisPending] = useState(false);
  const [selectionAnalysis, setSelectionAnalysis] = useState<SentenceGrammarAnalysisResult | null>(null);
  const [selectionAnalysisError, setSelectionAnalysisError] = useState("");
  const selectionAnalysisRequestIdRef = useRef(0);
  const selectionAnalysisAbortRef = useRef<AbortController | null>(null);

  const sourceMaterials = workspace.sourceMaterials;
  const activeSource =
    sourceMaterials.find((source) => source.id === activeSourceId) ?? sourceMaterials[0] ?? null;

  const persistedSegments = useMemo(
    () => getSegmentsForSource(workspace.learningSegments, activeSource?.id),
    [activeSource?.id, workspace.learningSegments],
  );
  const fallbackSegments = useMemo(
    () =>
      activeSource && !persistedSegments.length
        ? createLearningSegmentsForSourceMaterial(activeSource)
        : [],
    [activeSource, persistedSegments.length],
  );
  const segments = persistedSegments.length ? persistedSegments : fallbackSegments;
  const activeSession = findOpenSession(workspace.readingSessions, activeSource?.id) ?? null;
  const savedVocabularyCount = activeSession?.savedVocabularyIds.length ?? 0;
  const savedExpressionCount = activeSession?.savedExpressionIds.length ?? 0;
  const activeGoal = workspace.learningGoals.find((goal) => goal.id === activeSource?.goalId);
  const targetLanguage = normalizeLanguageCode(
    activeSource?.language || activeGoal?.targetLanguage || workspace.languageSettings.targetLanguage,
    "en",
  );
  const explanationLanguage = normalizeLanguageCode(
    workspace.languageSettings.explanationLanguage || activeGoal?.nativeLanguage,
    "zh-CN",
  );
  const activeAnalysis = useMemo(
    () => getLatestAnalysisForSource(workspace.segmentAnalyses, activeSource?.id),
    [activeSource?.id, workspace.segmentAnalyses],
  );
  const activeLearningStatus = activeSource
    ? getSourceMaterialLearningStatus(activeSource, workspace)
    : null;
  const activeSourceHasContent = Boolean(activeSource?.cleanedContent.trim());

  if (typeof window !== "undefined" && sourceMaterials.length && !activeSourceId) {
    const params = new URLSearchParams(window.location.search);
    const requestedSourceId = params.get("source") ?? "";
    const requestedContentId = params.get("content") ?? "";
    const requestedSource = sourceMaterials.find(
      (source) =>
        source.id === requestedSourceId ||
        source.metadata?.contentItemId === requestedContentId,
    );

    setActiveSourceId(requestedSource?.id ?? sourceMaterials[0].id);
  }

  useEffect(() => {
    if (!activeSource) return;

    const existingSession = findOpenSession(workspace.readingSessions, activeSource.id);
    const generatedSegments =
      getSegmentsForSource(workspace.learningSegments, activeSource.id).length === 0
        ? createLearningSegmentsForSourceMaterial(activeSource)
        : [];
    const nextSession = existingSession ?? createReadingSession(activeSource);

    if (existingSession && !generatedSegments.length) {
      return;
    }

    updateWorkspace((current) => {
      const currentSession = findOpenSession(current.readingSessions, activeSource.id);
      const currentSegments = getSegmentsForSource(current.learningSegments, activeSource.id);
      const sessionToPersist = currentSession ?? nextSession;

      return {
        readingSessions: currentSession
          ? current.readingSessions
          : [sessionToPersist, ...current.readingSessions],
        learningSegments: currentSegments.length
          ? current.learningSegments
          : [...current.learningSegments, ...generatedSegments],
      };
    });
  }, [activeSource, updateWorkspace, workspace.learningSegments, workspace.readingSessions]);

  const [previousSourceId, setPreviousSourceId] = useState(activeSource?.id);
  if (previousSourceId !== activeSource?.id) {
    setPreviousSourceId(activeSource?.id);
    setSelectionMeaning(""); setSelectionMeaningZh(""); setUsingAiMeaning(false);
    setDictionaryPending(false);
    setSelection(null);
    setSelectionAnchor(null);
    setLearningToolsOpen(false);
    setDictionaryResult(null);
    setDictionaryError("");
    setSelectionAnalysis(null);
    setSelectionAnalysisError("");
    setSelectionAnalysisPending(false);
  }
  useEffect(() => {
    dictionaryRequestId.current += 1;
    selectionAnalysisRequestIdRef.current += 1;
    selectionAnalysisAbortRef.current?.abort();
    selectionAnalysisAbortRef.current = null;
  }, [activeSource?.id]);

  useEffect(() => () => selectionAnalysisAbortRef.current?.abort(), []);

  useEffect(() => {
    if (!selectionAnchor) return;
    const close = () => setSelectionAnchor(null);
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Element && !event.target.closest("[data-selection-popover]")) close();
    };
    const onKeyDown = (event: KeyboardEvent) => { if (["Escape", "PageDown", "PageUp"].includes(event.key)) close(); };
    const onScroll = (event: Event) => {
      if (!(event.target instanceof Element) || !event.target.closest("[data-selection-popover]")) close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("wheel", onScroll, { passive: true });
    document.addEventListener("touchmove", onScroll, { passive: true });
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("wheel", onScroll);
      document.removeEventListener("touchmove", onScroll);
      window.removeEventListener("resize", close);
    };
  }, [selectionAnchor]);

  const openLearningTools = () => {
    setSelectionAnchor(null);
    setLearningToolsOpen(true); setAssistantTab("selection");
    setReadingFocus(false);
    requestAnimationFrame(() => {
      learningToolsRef.current?.scrollIntoView({ behavior: "instant", block: "nearest" });
      learningToolsRef.current?.focus({ preventScroll: true });
    });
  };

  const handleSelectSource = (sourceId: string) => {
    dictionaryRequestId.current += 1;
    setDictionaryPending(false);
    setSelectionMeaning(""); setSelectionMeaningZh(""); setUsingAiMeaning(false);
    setActiveSourceId(sourceId);
    selectionAnalysisRequestIdRef.current += 1;
    selectionAnalysisAbortRef.current?.abort();
    selectionAnalysisAbortRef.current = null;
    setSelection(null);
    setDictionaryResult(null);
    setDictionaryError("");
    setSelectionAnalysis(null);
    setSelectionAnalysisError("");
    setSelectionAnalysisPending(false);
    setMessage("");
  };

  const handleSegmentClick = (segment: LearningSegment) => {
    if (!activeSource || !activeSession) return;

    const browserSelectedText = normalizeSelectionText(window.getSelection()?.toString() ?? "");

    if (!browserSelectedText && selection?.segmentId !== segment.id) {
      dictionaryRequestId.current += 1;
      setDictionaryPending(false);
      setSelectionMeaning(""); setSelectionMeaningZh(""); setUsingAiMeaning(false);
      selectionAnalysisRequestIdRef.current += 1;
      selectionAnalysisAbortRef.current?.abort();
      selectionAnalysisAbortRef.current = null;
      setSelection(null);
      setDictionaryResult(null);
      setDictionaryError("");
      setSelectionAnalysis(null);
      setSelectionAnalysisError("");
      setSelectionAnalysisPending(false);
    }

    updateReadingSessionProgress(
      updateWorkspace,
      activeSession.id,
      segment.index,
      segments.length,
    );
  };

  const handleSegmentMouseUp = (segment: LearningSegment, element: HTMLElement) => {
    const browserSelection = window.getSelection();
    const selectedText = normalizeSelectedText(browserSelection?.toString() ?? "");

    if (!selectedText || !browserSelection?.rangeCount || !element.contains(browserSelection.anchorNode) || !element.contains(browserSelection.focusNode)) {
      return;
    }
    const range = browserSelection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const nextSelection = createReaderTextSelection({ selectedText, segment, segments });
    if (nextSelection.selectionType === "invalid") return;
    setSelectionAnchor({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom });

    dictionaryRequestId.current += 1;
    setDictionaryPending(false);
    setSelectionMeaning(""); setSelectionMeaningZh(""); setUsingAiMeaning(false);

    selectionAnalysisRequestIdRef.current += 1;
    selectionAnalysisAbortRef.current?.abort();
    selectionAnalysisAbortRef.current = null;
    setSelection(nextSelection);
    setLearningToolsOpen(false);
    setExplainWordOnOpen(false);
    setDictionaryResult(null);
    setDictionaryError("");
    setSelectionAnalysis(null);
    setSelectionAnalysisError("");
    setSelectionAnalysisPending(false);
    setMessage("");
    if (nextSelection.selectionType === "word") void handleLookupSelection(false, nextSelection);
  };

  const handleLookupSelection = async (includeOnline = false, selected = selection) => {
    if (!selected || selected.selectionType !== "word") {
      setMessage("请选择一个单词或中文词语后查词。");
      return;
    }

    const requestId = ++dictionaryRequestId.current;
    setDictionaryPending(true);
    setDictionaryError("");

    try {
      const result = await lookupDictionary({
        term: selected.selectedText,
        language: targetLanguage,
        includeOnline,
      });

      if (requestId !== dictionaryRequestId.current) return;
      setDictionaryResult(result);
      const fields = dictionaryResultToVocabularyFields(result);
      if (!includeOnline) {
        setSelectionMeaning(fields.meaningEn);
        setSelectionMeaningZh(fields.meaningZh);
        setUsingAiMeaning(false);
      } else {
        // A second lookup (built-in first, then online) must fill any field that
        // is still empty. Reading the previous render's `dictionaryResult` here
        // skipped that fill and left the save guard rejecting a real definition.
        setSelectionMeaning((current) => current.trim() ? current : fields.meaningEn);
        setSelectionMeaningZh((current) => current.trim() ? current : fields.meaningZh);
        if (fields.meaningEn || fields.meaningZh) setUsingAiMeaning(false);
      }
      if (includeOnline) setMessage(
        result.definitions.length || result.chineseDefinitions?.length
          ? `已查到 ${result.normalizedTerm} 的词典结果。`
          : "未找到内置释义，可打开外部词典继续查询。",
      );
    } catch (error) {
      if (requestId !== dictionaryRequestId.current) return;
      setDictionaryError(error instanceof Error ? error.message : "查词失败。");
    } finally {
      if (requestId === dictionaryRequestId.current) setDictionaryPending(false);
    }
  };

  const handleSaveVocabulary = () => {
    if (!activeSource || !activeSession || !selection) return;
    if (selection.selectionType !== "word") {
      setMessage("只有单个单词可以保存为词汇。短语请保存为表达，句子请保存语法笔记。");
      return;
    }

    if (!selectionMeaning.trim() && !selectionMeaningZh.trim()) {
      setMessage("请先查词或填写释义，再加入复习。");
      return;
    }
    const result = saveVocabularyItem({
      workspace,
      source: activeSource,
      session: activeSession,
      selection,
      lookupResult: dictionaryResult,
      // An empty field must fall through to the lookup result, not overwrite it
      // with an empty string.
      meaningOverride: selectionMeaning.trim() ? selectionMeaning : undefined,
      meaningZhOverride: selectionMeaningZh.trim() ? selectionMeaningZh : undefined,
      usingAiMeaning,
      updateWorkspace,
    });

    setMessage(result);
  };

  const handleSaveExpression = () => {
    if (!activeSource || !activeSession || !selection) return;
    if (selection.selectionType !== "phrase") {
      setMessage("保存表达适用于短语或固定搭配。句子分析后可保存其中的表达。");
      return;
    }

    if (!selectionMeaning.trim()) {
      setMessage("请先填写表达的意思，再加入复习。也可以分析后保存表达。");
      return;
    }
    const result = saveExpressionItem({
      workspace,
      source: activeSource,
      session: activeSession,
      selection,
      meaning: selectionMeaning,
      updateWorkspace,
    });

    setMessage(result);
  };

  const handleAnalyzeSelection = async (kind: SelectionAnalysisKind) => {
    if (!activeSource || !selection) return;
    if (kind === "phrase" && selection.selectionType !== "phrase") return;
    if (kind === "sentence" && selection.selectionType !== "sentence") return;
    if (kind === "paragraph" && selection.selectionType !== "paragraph") return;

    const task = kind === "phrase" ? "phraseAnalysis" : "sentenceGrammarAnalysis";
    if (!confirmRemoteAiSend(workspace, task, t)) {
      setMessage("已取消发送。本次内容没有发给远程 AI 服务。");
      return;
    }

    const requestId = selectionAnalysisRequestIdRef.current + 1;
    selectionAnalysisRequestIdRef.current = requestId;
    selectionAnalysisAbortRef.current?.abort();
    const controller = new AbortController();
    selectionAnalysisAbortRef.current = controller;
    setSelectionAnalysisPending(true);
    setSelectionAnalysisError("");
    setSelectionAnalysis(null);

    const result = await analyzeReaderSelectionForLanguageLearning({
      kind,
      selection,
      sourceMaterial: activeSource,
      targetLanguage,
      explanationLanguage,
      aiProviders: workspace.aiProviders,
      aiModels: workspace.aiModels,
      aiTaskRouting: workspace.aiTaskRouting,
      aiPrivacySettings: workspace.aiPrivacySettings,
      signal: controller.signal,
    });

    if (requestId !== selectionAnalysisRequestIdRef.current || controller.signal.aborted) {
      return;
    }

    if (result.ok) {
      setSelectionAnalysis(result.analysis);
      setMessage(`分析已完成。实际使用：${result.analysis.providerName} · ${result.analysis.modelId}。`);
    } else {
      setSelectionAnalysisError(result.error);
    }

    setSelectionAnalysisPending(false);
    selectionAnalysisAbortRef.current = null;
  };

  const handleCancelSelectionAnalysis = () => {
    selectionAnalysisRequestIdRef.current += 1;
    selectionAnalysisAbortRef.current?.abort();
    selectionAnalysisAbortRef.current = null;
    setSelectionAnalysisPending(false);
    setSelectionAnalysisError("已取消本次分析。");
  };

  const handleSaveAnalyzedExpression = (expressionIndex: number) => {
    if (!activeSource || !activeSession || !selection || !selectionAnalysis) return;
    const expression = selectionAnalysis.fixedExpressions[expressionIndex];
    if (!expression) return;

    const saved = prepareExpressionAnalysisSave({
      workspace,
      source: activeSource,
      session: activeSession,
      selection,
      expression,
    });
    updateWorkspace(() => ({
      expressionItems: saved.expressionItems,
      readingSessions: saved.readingSessions,
    }));
    setMessage(saved.message);
  };

  const handleSaveGrammarNote = () => {
    if (!activeSource || !selection || !selectionAnalysis) return;
    const saved = prepareGrammarAnalysisSave({
      workspace,
      source: activeSource,
      selection,
      analysis: selectionAnalysis,
    });
    updateWorkspace(() => ({ grammarNotes: saved.grammarNotes }));
    setMessage(saved.message);
  };

  if (!sourceMaterials.length) {
    return (
      <section className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-stone-600">
        <p className="text-sm font-semibold text-stone-500">{t(UI_COPY_ZH.reader.title)}</p>
        <h1 className="mt-2 text-2xl font-semibold text-stone-950">
          {t(UI_COPY_ZH.reader.emptyTitle)}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7">
          {t(UI_COPY_ZH.reader.emptyDescription)}
        </p>
        <Link
          href="/inbox"
          className="mt-5 inline-flex rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white"
        >
          {t(UI_COPY_ZH.reader.emptyAction)}
        </Link>
      </section>
    );
  }

  return (
    <div className={readingFocus ? "mx-auto max-w-3xl space-y-4" : "reader-workbench grid gap-4 min-[900px]:grid-cols-[minmax(0,1.35fr)_minmax(310px,0.9fr)]"}>
      <div hidden={readingFocus} className="min-w-0 min-[900px]:col-span-full">
        <label className="flex items-center gap-3 text-sm"><span className="shrink-0">{t("当前材料")}</span>
          <FullTextSelect aria-label={t("当前材料")} value={activeSource?.id || ""} onChange={event => handleSelectSource(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-stone-300 p-2">
            {sourceMaterials.map(source => <option key={source.id} value={source.id}>{source.title}</option>)}
          </FullTextSelect>
        </label>
      </div>

      <main aria-label={t("阅读原文")} className="reader-original min-w-0 rounded-xl border border-stone-200 bg-white p-4">
        <div className="border-b border-stone-200 pb-4">
          <p className="text-sm font-semibold text-stone-500">{t(UI_COPY_ZH.reader.title)}</p>
          <h1 className="mt-2 text-2xl font-semibold text-stone-950">
            {activeSource?.title ?? t("未选择材料")}
          </h1>
          <p className="mt-2 text-sm leading-7 text-stone-500">
            {t(UI_COPY_ZH.reader.intro)}
          </p>
          {activeSourceHasContent && ["zh", "en"].includes(targetLanguage) && targetLanguage !== workspace.languageSettings.targetLanguage ? (
            <div role="status" className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">
              <p>{t(targetLanguage === "zh"
                ? "已导入中文材料。你当前正在学英语，材料仍可正常阅读；练习英语请导入英文正文或文件。"
                : "已导入英文材料。你当前正在学中文，材料仍可正常阅读；练习中文请导入中文正文或文件。")}</p>
              <button type="button" onClick={() => switchMode(targetLanguage as "en" | "zh")} className="font-semibold underline">
                {t(targetLanguage === "zh" ? "切换为学习中文" : "切换为学习英语")}
              </button>
            </div>
          ) : null}
          <LearningFlowProgress status={activeLearningStatus} />
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-stone-500">
            <span>{t("阅读进度")} {Math.round((activeSession?.progress ?? 0) * 100)}%</span>
            <span>{t("词汇")} {savedVocabularyCount} · {t("表达")} {savedExpressionCount}</span>
            <span>{t("选词即查释义，记录或分析时再展开学习工具。")}</span>
          </div>
          {selection && !learningToolsOpen && !selectionAnchor ? <button type="button" onClick={openLearningTools} className="mt-2 text-xs underline">{t("继续上次选区的学习")}</button> : null}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">{t("字号")}<input aria-label={t("字号")} type="range" min="16" max="28" value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} />
            </label>
            <button type="button" onClick={() => setReadingFocus((value) => !value)} className="rounded-lg border border-stone-300 px-3 py-2 text-sm">{readingFocus ? t("退出专注阅读") : t("专注阅读")}</button>
            <button type="button" onClick={() => { setReadingFocus(false); setAssistantTab("chat"); setHighlightRequest(value => value + 1); }} disabled={!activeSourceHasContent}
              className="rounded-lg bg-stone-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">
              {t("AI 提取文章重点")}
            </button>
            <Link href={`/publish?source=${encodeURIComponent(activeSource?.id ?? "")}`} className="text-sm underline">{t("整理阅读输出")}</Link>
          </div>
          <p className="mt-2 text-xs leading-6 text-stone-500">{t("提取文章主旨、关键观点及值得学习的词汇与表达；需要配置 AI，长文最多分析前 12,000 个字符。")}</p>
        </div>

        <div className="mt-5 space-y-4">
          {segments.length ? (
            segments.map((segment) => (
              <article
                key={segment.id}
                onClick={() => handleSegmentClick(segment)}
                onPointerUp={(event) => handleSegmentMouseUp(segment, event.currentTarget)}
                onKeyUp={(event) => { if (event.key === "Shift" || event.key.startsWith("Arrow")) handleSegmentMouseUp(segment, event.currentTarget); }}
                tabIndex={0}
                data-reading-segment={segment.id}
                className={`rounded-lg px-3 py-4 transition ${
                  activeSession?.currentSegmentIndex === segment.index
                    ? "border-stone-900 bg-stone-50"
                    : "border-stone-200 bg-[#fbfaf7] hover:border-stone-300"
                }`}
              >
                <p className="text-xs font-semibold text-stone-400">
                  {t("第")}{segment.index + 1} {t("段")}</p>
                <p lang={targetLanguage} style={{ fontSize, lineHeight: 1.9 }} className="mt-2 whitespace-pre-wrap text-stone-800">
                  {segment.text}
                </p>
              </article>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-stone-200 bg-[#fbfaf7] p-6 text-sm leading-7 text-stone-500">
              {activeSourceHasContent
                ? t(UI_COPY_ZH.reader.missingSegments)
                : (
                    <span>
                      {t("这篇材料没有提取到正文，属于读取问题，与学习语言无关。请重新导入可复制文字的文件，或粘贴正文；扫描件可在导入页上传图片识别。")}
                      {typeof activeSource?.metadata?.ingestError === "string" ? <span className="mt-2 block">{t(describeDocumentReadError(activeSource.metadata.ingestError))}</span> : null}
                      <Link href="/inbox" className="mt-3 flex w-fit font-semibold text-stone-950">
                        {t("返回导入页")}</Link>
                    </span>
                  )}
            </div>
          )}
        </div>
      </main>

      <aside hidden={readingFocus} aria-label={t("阅读助手")} className="reader-assistant min-w-0 rounded-xl border border-stone-200 bg-white p-4">
        <div role="tablist" aria-label={t("阅读助手")} className="mb-3 flex flex-wrap gap-2 border-b border-stone-200 pb-3">
          {([ ["chat", "AI 对话"], ["note", "我的笔记"], ["selection", "选区记录"] ] as const).map(([tab, label]) => <button key={tab} type="button" role="tab" aria-selected={assistantTab === tab} onClick={() => { setAssistantTab(tab); if (tab === "selection") setLearningToolsOpen(true); }} className={`rounded-lg px-3 py-2 text-sm ${assistantTab === tab ? "bg-stone-900 text-white" : "border border-stone-300"}`}>{t(label)}</button>)}
        </div>
        <div hidden={assistantTab !== "chat"} className="reader-chat-panel min-h-0">
          {activeSource ? <ReaderAssistant key={activeSource.id} source={activeSource} segments={segments} note={currentNote} selection={selection?.selectedText || ""} highlightRequest={highlightRequest}
            highlights={activeAnalysis ? <details className="mt-3 text-sm"><summary className="cursor-pointer">{t("查看学习候选与详细分析")}</summary><LanguageAnalysisPanel analysis={activeAnalysis} source={activeSource} updateWorkspace={updateWorkspace} workspace={workspace} /></details> : null} /> : null}
        </div>
        <div hidden={assistantTab !== "note"} className="reader-notes-panel"><FeynmanOutputPanel readingSession={activeSession} source={activeSource} updateWorkspace={updateWorkspace} workspace={workspace} onDraftChange={setCurrentNote} /></div>
      <div ref={learningToolsRef} role="region" tabIndex={-1} hidden={assistantTab !== "selection" || !learningToolsOpen} aria-label={t("学习工具")} className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-stone-950">{t("学习工具")}</h2>
          <button type="button" onClick={() => { setLearningToolsOpen(false); setAssistantTab("chat"); }} className="text-sm underline">{t("返回阅读")}</button>
        </div>

        <ReaderSelectionPanel
          selection={selection}
          sourceTitle={activeSource?.title ?? t("未选择材料")}
          dictionaryPanel={<DictionaryLookupPanel pending={dictionaryPending} result={dictionaryResult} error={dictionaryError} onOnlineLookup={() => handleLookupSelection(true)} />}
          dictionaryPending={dictionaryPending}
          analysisPending={selectionAnalysisPending}
          analysisError={selectionAnalysisError}
          analysis={selectionAnalysis}
          meaning={selectionMeaning}
          meaningZh={selectionMeaningZh}
          wordExplanationPanel={learningToolsOpen && selection?.selectionType === "word" ? <WordExplanationPanel key={`${activeSource?.id}:${selection.segmentId}:${selection.selectedText}:${selection.containingSentence}:${targetLanguage}`} selection={selection} explainOnOpen={explainWordOnOpen}
            language={targetLanguage} workspace={workspace} confirmSend={() => confirmRemoteAiSend(workspace, "languageAnalysis", t)}
            onUse={(result) => { setSelectionMeaning(result.meaningEn); setSelectionMeaningZh(result.meaningZh); setUsingAiMeaning(true); }} /> : null}
          onMeaningChange={setSelectionMeaning}
          onMeaningZhChange={setSelectionMeaningZh}
          onLookupWord={() => handleLookupSelection()}
          onSaveVocabulary={handleSaveVocabulary}
          onSaveExpression={handleSaveExpression}
          onAnalyze={handleAnalyzeSelection}
          onCancelAnalysis={handleCancelSelectionAnalysis}
          onSaveAnalyzedExpression={handleSaveAnalyzedExpression}
          onSaveGrammarNote={handleSaveGrammarNote}
        />

        {message ? (
          <div className="rounded-lg bg-stone-100 p-3 text-sm leading-7 text-stone-700">
            {t(message)}
          </div>
        ) : null}
      </div>
      </aside>

      {selection && selectionAnchor ? <SelectionPopover selection={selection} anchor={selectionAnchor} result={dictionaryResult} pending={dictionaryPending} error={dictionaryError} language={targetLanguage}
        onClose={() => setSelectionAnchor(null)} onRecord={openLearningTools} onRetry={() => void handleLookupSelection()}
        onExplain={() => { setExplainWordOnOpen(true); openLearningTools(); }}
        onAnalyze={(kind) => { openLearningTools(); void handleAnalyzeSelection(kind); }} /> : null}


    </div>
  );
}

function LearningFlowProgress({
  status,
}: {
  status: ReturnType<typeof getSourceMaterialLearningStatus> | null;
}) {
  const { t } = useLearningUi();
  if (!status) return null;

  const steps = [
    { label: "已导入", done: true },
    { label: "阅读中", done: status.hasReadingSession },
    { label: "语言分析", done: status.hasAnalysis },
    { label: "费曼笔记", done: status.hasFeynmanNote },
  ];

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {steps.map((step) => (
        <span
          key={step.label}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            step.done
              ? "bg-stone-900 text-white"
              : "border border-stone-200 bg-[#fbfaf7] text-stone-500"
          }`}
        >
          {t(step.label)}
        </span>
      ))}
    </div>
  );
}

export function DictionaryLookupPanel({
  pending,
  result,
  error,
  onOnlineLookup,
}: {
  pending: boolean;
  result: DictionaryLookupResult | null;
  error: string;
  onOnlineLookup: () => void;
}) {
  const { t } = useLearningUi();
  if (!pending && !result && !error) return null;

  return (
    <div className="rounded-lg border border-stone-200 p-4 text-sm leading-7 text-stone-600">
      <p className="text-xs font-semibold text-stone-500">{t("词典")}</p>
      {pending ? <p className="mt-3">{t("正在查询词典…")}</p> : null}
      {error ? <p className="mt-3 text-rose-700">{t(error)}</p> : null}
      {result ? (
        <div className="mt-3 space-y-3">
          <div>
            <p className="text-lg font-semibold text-stone-950">{result.normalizedTerm}</p>
            <p className="text-xs text-stone-500">
              {result.source}
              {result.phonetic ? ` · ${result.phonetic}` : ""}
            </p>
          </div>
          <PronunciationControl key={`${result.normalizedTerm}:${result.language}`} text={result.normalizedTerm} language={result.language} audioUrl={result.audioUrl} />
          {result.language.startsWith("en") ? <>
            <button type="button" onClick={onOnlineLookup} disabled={pending} className="rounded-full border border-stone-300 px-3 py-1 disabled:opacity-40">{t("补充在线英文释义与录音")}</button>
            <p className="text-xs text-stone-500">{t("普通查词使用内置 ECDICT；在线补充只向 Free Dictionary API 发送这个词。中英释义来自不同条目，不逐条对应。")}</p>
            <h4 className="font-semibold">{t("中文词典释义")}</h4>
            {result.chineseDefinitions?.length ? result.chineseDefinitions.map((definition, index) => <p key={index} lang="zh-CN" className="whitespace-pre-line rounded-lg bg-[#fbfaf7] p-3">{definition}</p>)
              : <p>{t("词库暂未收录中文释义，可尝试 AI 双语讲解。")}</p>}
          </> : null}
          <h4 className="font-semibold">{t("英文词典释义")}</h4>
          {result.definitions.length ? (
            <div className="space-y-2">
              {result.definitions.slice(0, 4).map((definition, index) => (
                <div key={`${definition.partOfSpeech}-${index}`} className="rounded-lg bg-[#fbfaf7] p-3">
                  <p className="text-xs font-semibold text-stone-500">
                    {definition.partOfSpeech}
                  </p>
                  <p lang="en" className="mt-1 whitespace-pre-line text-stone-800">{definition.definition}</p>
                  {definition.example ? (
                    <p className="mt-2 text-xs text-stone-500">{t("例句：")}{definition.example}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg bg-[#fbfaf7] p-3 text-stone-500">
              {t("没有拿到可内嵌的释义，可打开外部词典继续查。")}</p>
          )}
          {result.notices?.map((notice) => <p key={notice} role="status" className="text-xs text-amber-700">{t(notice)}</p>)}
          <div className="flex flex-wrap gap-2">
            {result.externalLinks.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold text-stone-700 hover:border-stone-300"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function findOpenSession(sessions: ReadingSession[], sourceMaterialId: string | undefined) {
  if (!sourceMaterialId) return null;

  return sessions.find(
    (session) => session.sourceMaterialId === sourceMaterialId && !session.completedAt,
  ) ?? null;
}

function createReadingSession(source: SourceMaterial): ReadingSession {
  const now = new Date().toISOString();

  return {
    id: createId(),
    sourceMaterialId: source.id,
    goalId: source.goalId,
    startedAt: now,
    updatedAt: now,
    progress: 0,
    currentSegmentIndex: 0,
    savedVocabularyIds: [],
    savedExpressionIds: [],
    notes: "",
  };
}

function getSegmentsForSource(segments: LearningSegment[], sourceMaterialId: string | undefined) {
  if (!sourceMaterialId) return [];

  return segments
    .filter((segment) => segment.sourceMaterialId === sourceMaterialId)
    .sort((a, b) => a.index - b.index);
}

function getLatestAnalysisForSource(
  analyses: SegmentAnalysis[],
  sourceMaterialId: string | undefined,
) {
  if (!sourceMaterialId) return null;

  return analyses
    .filter((analysis) => analysis.sourceMaterialId === sourceMaterialId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

function LanguageAnalysisPanel({
  analysis,
  source,
  workspace,
  updateWorkspace,
}: {
  analysis: SegmentAnalysis | null;
  source: SourceMaterial | null;
  workspace: ReturnType<typeof useWorkspaceStore>["workspace"];
  updateWorkspace: ReturnType<typeof useWorkspaceStore>["updateWorkspace"];
}) {
  const { t } = useLearningUi();
  if (!source) {
    return null;
  }

  if (!analysis?.articleOverview) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-6 text-sm leading-7 text-stone-500 shadow-sm shadow-stone-200/60">
        {t("暂无文章重点。点击阅读器顶部“AI 提取文章重点”，生成主旨、关键观点和学习候选。")}</div>
    );
  }

  const overview = analysis.articleOverview;

  return (
    <div className="space-y-5 rounded-xl border border-stone-200 bg-white p-6 shadow-sm shadow-stone-200/60">
      <div>
        <p className="text-sm font-semibold text-stone-500">{t("语言分析")}</p>
        <h2 className="mt-2 text-2xl font-semibold text-stone-950">
          {overview.title || source.title}
        </h2>
        {analysis.status === "failed" ? (
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm leading-7 text-amber-800">
            {t("AI 语言分析暂时不可用。请先配置 AI 服务。")}{analysis.errorMessage ? ` ${analysis.errorMessage}` : ""}
          </p>
        ) : null}
      </div>

      <AnalysisBlock title={t("文章概览")}>
        <p><strong>{t("主题：")}</strong>{overview.topic || t("暂无")}</p>
        <p><strong>{t("难度：")}</strong>{overview.difficulty || t("暂无")}</p>
        <p><strong>{t("阅读目标：")}</strong>{overview.readingGoal || t("暂无")}</p>
        <p>{overview.summaryZh || overview.summaryInTargetLanguage}</p>
        {overview.keyIdeas.length ? (
          <ul className="list-inside list-disc">
            {overview.keyIdeas.map((idea) => <li key={idea}>{idea}</li>)}
          </ul>
        ) : null}
      </AnalysisBlock>

      <CandidateList title={t("候选词汇")}>
        {(analysis.vocabularyCandidates ?? []).map((candidate) => {
          const saved = Boolean(findExistingVocabulary(workspace.vocabularyItems, source, candidate));

          return (
            <CandidateCard
              key={`${candidate.segmentId ?? ""}-${candidate.text}`}
              title={candidate.text}
              detail={`${candidate.meaningZh || candidate.meaningEn} · ${candidate.reason}`}
              saved={saved}
              actionLabel={t("保存词汇")}
              onSave={() => saveVocabularyCandidate({ workspace, source, candidate, updateWorkspace })}
            />
          );
        })}
      </CandidateList>

      <CandidateList title={t("候选表达")}>
        {(analysis.expressionCandidates ?? []).map((candidate) => {
          const saved = Boolean(findExistingExpression(workspace.expressionItems, source, candidate));

          return (
            <CandidateCard
              key={`${candidate.segmentId ?? ""}-${candidate.text}`}
              title={candidate.text}
              detail={`${candidate.meaningZh || candidate.meaningEn} · ${candidate.usageNote || candidate.reason}`}
              saved={saved}
              actionLabel={t("保存表达")}
              onSave={() => saveExpressionCandidate({ workspace, source, candidate, updateWorkspace })}
            />
          );
        })}
      </CandidateList>

      <CandidateList title={t("语法点")}>
        {(analysis.grammarCandidates ?? []).map((candidate) => {
          const saved = Boolean(findExistingGrammar(workspace.grammarNotes, source, candidate));

          return (
            <CandidateCard
              key={`${candidate.segmentId ?? ""}-${candidate.title}`}
              title={candidate.title}
              detail={candidate.explanationZh || candidate.explanationEn}
              saved={saved}
              actionLabel={t("保存语法笔记")}
              onSave={() => saveGrammarCandidate({ workspace, source, candidate, updateWorkspace })}
            />
          );
        })}
      </CandidateList>

      <CandidateList title={t("文化提示")}>
        {(analysis.cultureCandidates ?? []).map((candidate) => {
          const saved = Boolean(findExistingCulture(workspace.cultureNotes, source, candidate));

          return (
            <CandidateCard
              key={`${candidate.segmentId ?? ""}-${candidate.term || candidate.title}`}
              title={candidate.title || candidate.term}
              detail={`${candidate.culturalContext} ${candidate.explanationZh || candidate.explanationEn}`}
              saved={saved}
              actionLabel={t("保存文化笔记")}
              onSave={() => saveCultureCandidate({ workspace, source, candidate, updateWorkspace })}
            />
          );
        })}
      </CandidateList>

      <AnalysisBlock title={t("文章逻辑")}>
        <p><strong>{t("结构：")}</strong>{analysis.logicReview?.structure || t("暂无")}</p>
        <p><strong>{t("作者立场：")}</strong>{analysis.logicReview?.authorPosition || t("暂无")}</p>
        {analysis.logicReview?.keyArguments.length ? (
          <ul className="list-inside list-disc">
            {analysis.logicReview.keyArguments.map((item) => <li key={item}>{item}</li>)}
          </ul>
        ) : null}
      </AnalysisBlock>

      <AnalysisBlock title={t("学习建议")}>
        {(analysis.learningSuggestions ?? []).length ? (
          <div className="space-y-3">
            {(analysis.learningSuggestions ?? []).map((item) => (
              <div key={item.title} className="rounded-lg bg-[#fbfaf7] p-3">
                <p className="font-semibold text-stone-900">{item.title}</p>
                <p>{item.reason}</p>
                <p>{item.action}</p>
              </div>
            ))}
          </div>
        ) : (
          <p>{t("暂无建议。")}</p>
        )}
      </AnalysisBlock>
    </div>
  );
}

function AnalysisBlock({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useLearningUi();
  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4 text-sm leading-7 text-stone-700">
      <h3 className="text-base font-semibold text-stone-950">{t(title)}</h3>
      <div className="mt-3 space-y-2">{children}</div>
    </section>
  );
}

function CandidateList({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useLearningUi();
  return (
    <AnalysisBlock title={t(title)}>
      <div className="space-y-3">
        {Array.isArray(children) && children.length === 0 ? (
          <p>{t("暂无候选项。")}</p>
        ) : children}
      </div>
    </AnalysisBlock>
  );
}

function CandidateCard({
  title,
  detail,
  saved,
  actionLabel,
  onSave,
}: {
  title: string;
  detail: string;
  saved: boolean;
  actionLabel: string;
  onSave: () => void;
}) {
  const { t } = useLearningUi();
  return (
    <article className="rounded-lg bg-[#fbfaf7] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-stone-900">{t(title)}</p>
          <p className="mt-1 text-sm leading-7 text-stone-600">{detail || t("暂无说明。")}</p>
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={saved}
          className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 disabled:cursor-not-allowed disabled:text-stone-300"
        >
          {saved ? t("已保存") : actionLabel}
        </button>
      </div>
    </article>
  );
}

function FeynmanOutputPanel({
  onDraftChange,
  readingSession,
  source,
  workspace,
  updateWorkspace,
}: {
  onDraftChange: (note: string) => void;
  readingSession: ReadingSession | null;
  source: SourceMaterial | null;
  workspace: ReturnType<typeof useWorkspaceStore>["workspace"];
  updateWorkspace: ReturnType<typeof useWorkspaceStore>["updateWorkspace"];
}) {
  const { t } = useLearningUi();
  const existingNote = useMemo(
    () => findFeynmanNote(workspace.feynmanNotes, source?.id, readingSession?.id),
    [readingSession?.id, source?.id, workspace.feynmanNotes],
  );
  const [draft, setDraft] = useState<FeynmanDraftInput>(() => draftFromNote(existingNote));
  const [message, setMessage] = useState("");
  const [requestingFeedback, setRequestingFeedback] = useState(false);
  const draftCacheRef = useRef<Record<string, FeynmanDraftInput>>({});
  const draftKey = `${source?.id ?? ""}:${readingSession?.id ?? ""}`;

  useEffect(() => {
    let active = true;
    const restored = draftCacheRef.current[draftKey] ?? readFeynmanDraft(draftKey, existingNote?.updatedAt) ?? draftFromNote(existingNote);
    queueMicrotask(() => { if (active) { setDraft(restored); setMessage(""); } });
    return () => { active = false; };
  }, [draftKey, existingNote]);

  useEffect(() => { onDraftChange(Object.values(draft).filter(Boolean).join("\n\n")); }, [draft, onDraftChange]);

  const updateDraft = (field: keyof FeynmanDraftInput, value: string) => {
    const next = { ...draft, [field]: value };
    draftCacheRef.current[draftKey] = next;
    setDraft(next);
    if (!writeFeynmanDraft(draftKey, next)) {
      setMessage("草稿缓存失败，请立即保存笔记并留意工作区保存状态。");
    }
  };

  if (!source || !readingSession) {
    return null;
  }

  const handleSave = () => {
    const note = createFeynmanNoteRecord({
      sourceMaterial: source,
      readingSession,
      draft,
      feedback: feedbackFromNote(existingNote),
      existingNote,
    });

    updateWorkspace((current) => ({
      feynmanNotes: upsertById(current.feynmanNotes, note),
    }));
    setMessage("费曼笔记已提交保存，请留意工作区保存状态。之后可在积累页查看。");
    if (JSON.stringify(draftCacheRef.current[draftKey]) === JSON.stringify(draft)) {
      delete draftCacheRef.current[draftKey];
    }
  };

  const handleRequestFeedback = async () => {
    if (!source || !readingSession) return;
    if (!draft.ownWordsExplanation.trim()) {
      setMessage("请先用你自己的话写一段总结，再请求 AI 反馈。");
      return;
    }
    if (!confirmRemoteAiSend(workspace, "feynmanFeedback", t)) {
      setMessage("已取消发送。本次内容没有发给远程 AI 服务。");
      return;
    }

    setRequestingFeedback(true);
    setMessage("正在请求 AI 反馈…");
    try {
      const result = await reviewFeynmanNoteWithAi({
        sourceMaterial: source,
        readingSession,
        targetLanguage: workspace.languageSettings.targetLanguage,
        nativeLanguage: workspace.languageSettings.explanationLanguage,
        draft,
        aiProviders: workspace.aiProviders,
        aiModels: workspace.aiModels,
        aiTaskRouting: workspace.aiTaskRouting,
        aiPrivacySettings: workspace.aiPrivacySettings,
      });

      if (!result.ok) {
        setMessage(result.error);
        return;
      }

      // Persist the feedback with the note so it survives a reload.
      const note = createFeynmanNoteRecord({
        sourceMaterial: source,
        readingSession,
        draft,
        feedback: result.feedback,
        existingNote,
      });
      updateWorkspace((current) => ({
        feynmanNotes: upsertById(current.feynmanNotes, note),
      }));
      setMessage("AI 反馈已生成并随笔记保存。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI 费曼反馈失败，请稍后重试。");
    } finally {
      setRequestingFeedback(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-600">{t("用自己的话记录理解和感受，可以在这里直接请求 AI 反馈。")}</p>
      <label className="block text-sm font-semibold">{t("我的总结与思考")}
        <textarea aria-label={t("我的总结与思考")} value={draft.ownWordsExplanation} onChange={event => updateDraft("ownWordsExplanation", event.target.value)} rows={12} className="mt-2 w-full rounded-lg border border-stone-300 p-3 text-sm font-normal leading-7" />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={handleSave} className="rounded-lg bg-stone-900 px-4 py-2 text-sm text-white">{t("保存笔记")}</button>
        <button type="button" disabled={requestingFeedback} onClick={handleRequestFeedback} className="rounded-lg border border-stone-300 px-4 py-2 text-sm disabled:opacity-40">{requestingFeedback ? t("正在请求反馈…") : t("请求 AI 反馈")}</button>
      </div>
      {message ? <p role="status" className="text-sm text-stone-600">{t(message)}</p> : null}
      {[draft.mainIdea, draft.personalConnection, draft.questions, draft.nextSteps].some(Boolean) ? <details className="text-sm"><summary className="cursor-pointer">{t("查看旧笔记补充（内容已保留）")}</summary>
        {([ ["核心意思", draft.mainIdea], ["和我的关系", draft.personalConnection], ["还想追问的问题", draft.questions], ["下一步行动", draft.nextSteps] ] as const).filter(([, value]) => value.trim()).map(([label, value]) => <div key={label} className="mt-3"><h3 className="font-semibold">{t(label)}</h3><p className="whitespace-pre-wrap">{value}</p></div>)}
      </details> : null}
      {existingNote?.aiFeedback ? <details className="text-sm"><summary className="cursor-pointer">{t("查看以前的 AI 反馈")}</summary><FeynmanFeedbackView feedback={feedbackFromNote(existingNote)} /></details> : null}
    </div>
  );
}

function FeynmanFeedbackView({ feedback }: { feedback: FeynmanFeedback | null }) {
  const { t } = useLearningUi();
  if (!feedback) {
    return (
      <div className="rounded-lg border border-dashed border-stone-200 bg-[#fbfaf7] p-4 text-sm leading-7 text-stone-500">
        {t("请求反馈后，会显示 AI 反馈。")}</div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-stone-200 bg-[#fbfaf7] p-4 text-sm leading-7 text-stone-700">
      <div className="flex flex-wrap gap-3">
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold">
          {t("清晰度")}{feedback.clarityScore}/100
        </span>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold">
          {t("准确度")}{feedback.accuracyScore}/100
        </span>
      </div>
      <p>{feedback.feedbackSummary}</p>
      <FeedbackList title={t("做得好的地方")} items={feedback.strengths} />
      <FeedbackList title={t("可能的误解")} items={feedback.possibleMisunderstandings} />
      <FeedbackList title={t("遗漏的关键点")} items={feedback.missingKeyPoints} />
      <FeedbackList title={t("语言建议")} items={feedback.languageSuggestions} />
      <FeedbackList title={t("可以继续追问的问题")} items={feedback.nextQuestions} />
      <FeedbackList title={t("行动建议")} items={feedback.actionSuggestions} />
    </div>
  );
}

function FeedbackList({ title, items }: { title: string; items: string[] }) {
  const { t } = useLearningUi();
  if (!items.length) return null;

  return (
    <div>
      <p className="font-semibold text-stone-900">{t(title)}</p>
      <ul className="mt-1 list-inside list-disc">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function updateReadingSessionProgress(
  updateWorkspace: ReturnType<typeof useWorkspaceStore>["updateWorkspace"],
  sessionId: string,
  currentSegmentIndex: number,
  totalSegments: number,
) {
  const now = new Date().toISOString();
  const progress = totalSegments > 0 ? Math.min(1, (currentSegmentIndex + 1) / totalSegments) : 0;

  updateWorkspace((current) => ({
    readingSessions: current.readingSessions.map((session) =>
      session.id === sessionId
        ? {
            ...session,
            currentSegmentIndex,
            progress,
            updatedAt: now,
          }
        : session,
    ),
  }));
}

export function saveVocabularyItem({
  workspace,
  source,
  session,
  selection,
  lookupResult,
  meaningOverride,
  meaningZhOverride,
  usingAiMeaning,
  updateWorkspace,
}: {
  workspace: ReturnType<typeof useWorkspaceStore>["workspace"];
  source: SourceMaterial;
  session: ReadingSession;
  selection: ReaderTextSelection;
  lookupResult?: DictionaryLookupResult | null;
  meaningOverride?: string;
  meaningZhOverride?: string;
  usingAiMeaning?: boolean;
  updateWorkspace: ReturnType<typeof useWorkspaceStore>["updateWorkspace"];
}) {
  const text = normalizeSelectionText(selection.selectedText);
  const existing = workspace.vocabularyItems.find(
    (item) =>
      item.sourceMaterialId === source.id &&
      item.segmentId === selection.segmentId &&
      item.text.toLocaleLowerCase() === text.toLocaleLowerCase(),
  );
  const itemId = existing?.id ?? createId();
  const now = new Date().toISOString();
  const lookupFields = lookupResult
    ? dictionaryResultToVocabularyFields(lookupResult)
    : null;
  const nextItem: VocabularyItem = existing ?? {
    id: itemId,
    text,
    lemma: lookupFields?.lemma || text,
    pronunciation: lookupFields?.pronunciation,
    language: source.language,
    partOfSpeech: lookupFields?.partOfSpeech || "unknown",
    meaningZh: meaningZhOverride !== undefined ? meaningZhOverride.trim() : lookupFields?.meaningZh || "",
    meaningEn: meaningOverride !== undefined ? meaningOverride.trim() : lookupFields?.meaningEn || "",
    sourceMaterialId: source.id,
    segmentId: selection.segmentId,
    sentence: selection.containingSentence,
    status: "new",
    stage: 0,
    tags: [...(lookupFields?.tags ?? []), ...(usingAiMeaning ? ["ai:word-explanation"] : [])],
    createdAt: now,
    updatedAt: now,
  };

  updateWorkspace((current) => ({
    vocabularyItems: existing
      ? current.vocabularyItems.map((entry) =>
          entry.id === existing.id
            ? { ...(lookupFields ? mergeVocabularyLookupFields(entry, lookupFields, now) : entry),
                ...(meaningOverride !== undefined ? { meaningEn: meaningOverride.trim() } : {}),
                ...(meaningZhOverride !== undefined ? { meaningZh: meaningZhOverride.trim() } : {}),
                ...(usingAiMeaning ? { tags: pushUnique(entry.tags, "ai:word-explanation") } : {}), updatedAt: now }
            : entry,
        )
      : [nextItem, ...current.vocabularyItems],
    readingSessions: current.readingSessions.map((entry) =>
      entry.id === session.id
        ? {
            ...entry,
            savedVocabularyIds: pushUnique(entry.savedVocabularyIds, itemId),
            updatedAt: now,
          }
        : entry,
    ),
  }));

  if (existing && lookupFields) {
    return "这个词汇已经保存过，已用本次查词结果补充释义。";
  }

  return existing ? "这个词汇已经保存过，已复用现有词条。" : "已保存为词汇。";
}

function mergeVocabularyLookupFields(
  item: VocabularyItem,
  fields: ReturnType<typeof dictionaryResultToVocabularyFields>,
  now: string,
): VocabularyItem {
  return {
    ...item,
    lemma: item.lemma || fields.lemma,
    pronunciation: item.pronunciation || fields.pronunciation,
    partOfSpeech:
      item.partOfSpeech && item.partOfSpeech !== "unknown"
        ? item.partOfSpeech
        : fields.partOfSpeech,
    meaningEn: item.meaningEn || fields.meaningEn,
    meaningZh: item.meaningZh || fields.meaningZh,
    tags: pushUniqueMany(item.tags, fields.tags),
    updatedAt: now,
  };
}

function saveExpressionItem({
  workspace,
  source,
  session,
  selection,
  meaning,
  updateWorkspace,
}: {
  workspace: ReturnType<typeof useWorkspaceStore>["workspace"];
  source: SourceMaterial;
  session: ReadingSession;
  selection: ReaderTextSelection;
  meaning: string;
  updateWorkspace: ReturnType<typeof useWorkspaceStore>["updateWorkspace"];
}) {
  const text = normalizeSelectionText(selection.selectedText);
  const existing = workspace.expressionItems.find(
    (item) =>
      item.sourceMaterialId === source.id &&
      item.segmentId === selection.segmentId &&
      item.text.toLocaleLowerCase() === text.toLocaleLowerCase(),
  );
  const itemId = existing?.id ?? createId();
  const now = new Date().toISOString();
  const nextItem: ExpressionItem = existing ?? {
    id: itemId,
    text,
    language: source.language,
    type: "other",
    meaningZh: "",
    meaningEn: meaning.trim(),
    usageNote: "",
    sourceMaterialId: source.id,
    segmentId: selection.segmentId,
    sentence: selection.containingSentence,
    status: "new",
    stage: 0,
    tags: [],
    createdAt: now,
    updatedAt: now,
  };

  updateWorkspace((current) => ({
    expressionItems: existing ? current.expressionItems : [nextItem, ...current.expressionItems],
    readingSessions: current.readingSessions.map((entry) =>
      entry.id === session.id
        ? {
            ...entry,
            savedExpressionIds: pushUnique(entry.savedExpressionIds, itemId),
            updatedAt: now,
          }
        : entry,
    ),
  }));

  return existing ? "这个表达已经保存过，已复用现有表达。" : "已保存为表达。";
}

function saveVocabularyCandidate({
  workspace,
  source,
  candidate,
  updateWorkspace,
}: {
  workspace: ReturnType<typeof useWorkspaceStore>["workspace"];
  source: SourceMaterial;
  candidate: VocabularyCandidate;
  updateWorkspace: ReturnType<typeof useWorkspaceStore>["updateWorkspace"];
}) {
  if (findExistingVocabulary(workspace.vocabularyItems, source, candidate)) {
    return;
  }

  const now = new Date().toISOString();
  const item: VocabularyItem = {
    id: createId(),
    text: candidate.text.trim(),
    lemma: candidate.lemma.trim() || candidate.text.trim(),
    language: source.language,
    partOfSpeech: candidate.partOfSpeech.trim() || "unknown",
    meaningZh: candidate.meaningZh,
    meaningEn: candidate.meaningEn,
    sourceMaterialId: source.id,
    segmentId: candidate.segmentId ?? "",
    sentence: candidate.sentence,
    status: "new",
    stage: 0,
    tags: [],
    createdAt: now,
    updatedAt: now,
  };

  updateWorkspace((current) => ({
    vocabularyItems: [item, ...current.vocabularyItems],
  }));
}

function saveExpressionCandidate({
  workspace,
  source,
  candidate,
  updateWorkspace,
}: {
  workspace: ReturnType<typeof useWorkspaceStore>["workspace"];
  source: SourceMaterial;
  candidate: ExpressionCandidate;
  updateWorkspace: ReturnType<typeof useWorkspaceStore>["updateWorkspace"];
}) {
  if (findExistingExpression(workspace.expressionItems, source, candidate)) {
    return;
  }

  const now = new Date().toISOString();
  const item: ExpressionItem = {
    id: createId(),
    text: candidate.text.trim(),
    language: source.language,
    type: candidate.type,
    meaningZh: candidate.meaningZh,
    meaningEn: candidate.meaningEn,
    usageNote: candidate.usageNote,
    sourceMaterialId: source.id,
    segmentId: candidate.segmentId ?? "",
    sentence: candidate.sentence,
    status: "new",
    stage: 0,
    tags: [],
    createdAt: now,
    updatedAt: now,
  };

  updateWorkspace((current) => ({
    expressionItems: [item, ...current.expressionItems],
  }));
}

function saveGrammarCandidate({
  workspace,
  source,
  candidate,
  updateWorkspace,
}: {
  workspace: ReturnType<typeof useWorkspaceStore>["workspace"];
  source: SourceMaterial;
  candidate: GrammarCandidate;
  updateWorkspace: ReturnType<typeof useWorkspaceStore>["updateWorkspace"];
}) {
  if (findExistingGrammar(workspace.grammarNotes, source, candidate)) {
    return;
  }

  const now = new Date().toISOString();
  const note: GrammarNote = {
    id: createId(),
    title: candidate.title.trim(),
    language: source.language,
    explanationZh: candidate.explanationZh,
    explanationEn: candidate.explanationEn,
    sourceMaterialId: source.id,
    segmentId: candidate.segmentId ?? "",
    sentence: candidate.sentence,
    importance: candidate.importance,
    tags: [],
    createdAt: now,
    updatedAt: now,
  };

  updateWorkspace((current) => ({
    grammarNotes: [note, ...current.grammarNotes],
  }));
}

function saveCultureCandidate({
  workspace,
  source,
  candidate,
  updateWorkspace,
}: {
  workspace: ReturnType<typeof useWorkspaceStore>["workspace"];
  source: SourceMaterial;
  candidate: CultureCandidate;
  updateWorkspace: ReturnType<typeof useWorkspaceStore>["updateWorkspace"];
}) {
  if (findExistingCulture(workspace.cultureNotes, source, candidate)) {
    return;
  }

  const now = new Date().toISOString();
  const note: CultureNote = {
    id: createId(),
    title: candidate.title.trim() || candidate.term.trim(),
    language: source.language,
    term: candidate.term,
    explanationZh: candidate.explanationZh,
    explanationEn: candidate.explanationEn,
    sourceMaterialId: source.id,
    segmentId: candidate.segmentId ?? "",
    culturalContext: candidate.culturalContext,
    tags: [],
    createdAt: now,
    updatedAt: now,
  };

  updateWorkspace((current) => ({
    cultureNotes: [note, ...current.cultureNotes],
  }));
}

function findExistingVocabulary(
  items: VocabularyItem[],
  source: SourceMaterial,
  candidate: VocabularyCandidate,
) {
  const text = candidate.text.trim().toLocaleLowerCase();

  return items.find(
    (item) =>
      item.sourceMaterialId === source.id &&
      item.segmentId === (candidate.segmentId ?? "") &&
      item.text.trim().toLocaleLowerCase() === text,
  );
}

function findExistingExpression(
  items: ExpressionItem[],
  source: SourceMaterial,
  candidate: ExpressionCandidate,
) {
  const text = candidate.text.trim().toLocaleLowerCase();

  return items.find(
    (item) =>
      item.sourceMaterialId === source.id &&
      item.segmentId === (candidate.segmentId ?? "") &&
      item.text.trim().toLocaleLowerCase() === text,
  );
}

function findExistingGrammar(
  items: GrammarNote[],
  source: SourceMaterial,
  candidate: GrammarCandidate,
) {
  const title = candidate.title.trim().toLocaleLowerCase();

  return items.find(
    (item) =>
      item.sourceMaterialId === source.id &&
      item.segmentId === (candidate.segmentId ?? "") &&
      item.title.trim().toLocaleLowerCase() === title,
  );
}

function findExistingCulture(
  items: CultureNote[],
  source: SourceMaterial,
  candidate: CultureCandidate,
) {
  const key = (candidate.term || candidate.title).trim().toLocaleLowerCase();

  return items.find(
    (item) =>
      item.sourceMaterialId === source.id &&
      item.segmentId === (candidate.segmentId ?? "") &&
      (item.term || item.title).trim().toLocaleLowerCase() === key,
  );
}

function findFeynmanNote(
  notes: FeynmanNote[],
  sourceMaterialId: string | undefined,
  readingSessionId: string | undefined,
) {
  if (!sourceMaterialId || !readingSessionId) return null;

  return notes.find(
    (note) =>
      note.sourceMaterialId === sourceMaterialId &&
    note.readingSessionId === readingSessionId,
  ) ?? null;
}

function draftFromNote(note: FeynmanNote | null): FeynmanDraftInput {
  return {
    mainIdea: note?.mainIdea ?? "",
    ownWordsExplanation: note?.ownWordsExplanation ?? note?.userExplanation ?? "",
    personalConnection: note?.personalConnection ?? "",
    questions: note?.questions ?? "",
    nextSteps: note?.nextSteps ?? note?.actionInsight ?? "",
  };
}

function feedbackFromNote(note: FeynmanNote | null): FeynmanFeedback | null {
  if (!note?.aiFeedback) {
    return null;
  }

  return {
    clarityScore: note.clarityScore,
    accuracyScore: note.accuracyScore,
    strengths: note.feedbackStrengths ?? [],
    possibleMisunderstandings: [],
    missingKeyPoints: note.feedbackMissingPoints ?? [],
    languageSuggestions: note.feedbackLanguageSuggestions ?? [],
    nextQuestions: note.feedbackNextQuestions ?? [],
    actionSuggestions: [],
    feedbackSummary: note.aiFeedback,
  };
}

function confirmRemoteAiSend(
  workspace: ReturnType<typeof useWorkspaceStore>["workspace"],
  task: "languageAnalysis" | "phraseAnalysis" | "sentenceGrammarAnalysis" | "feynmanFeedback",
  t: (text: string) => string,
) {
  const route = workspace.aiTaskRouting[task] ?? workspace.aiTaskRouting.analysis;
  const provider = workspace.aiProviders.find((item) => item.id === route?.providerId);
  const isLocal = Boolean(provider?.isLocal || provider?.providerType === "local");
  const isRemote = Boolean(provider?.isRemote ?? (provider ? !isLocal : false));

  if (!provider || !isRemote || !workspace.aiPrivacySettings.requireConfirmationBeforeRemoteSend) {
    return true;
  }

  if (typeof window === "undefined") {
    return true;
  }

  return window.confirm(
    t(`本次内容将发送给远程 AI 服务“${provider.displayName ?? provider.name}”。是否继续？`),
  );
}

function upsertById<T extends { id: string }>(items: T[], nextItem: T) {
  return items.some((item) => item.id === nextItem.id)
    ? items.map((item) => (item.id === nextItem.id ? nextItem : item))
    : [nextItem, ...items];
}

function normalizeSelectedText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function pushUnique(values: string[], nextValue: string) {
  return values.includes(nextValue) ? values : [nextValue, ...values];
}

function pushUniqueMany(values: string[], nextValues: string[]) {
  return Array.from(new Set([...nextValues.filter(Boolean), ...values]));
}

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
