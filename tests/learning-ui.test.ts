import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { translateUiText } from "@/src/lib/copy/en";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { createDefaultWorkspaceState } from "@/src/lib/workspace/core";
import { learningModeSettings } from "@/src/lib/languageSettings";
import { LanguageProvider } from "@/src/components/LanguageProvider";
import { HeroSection } from "@/src/components/home/HeroSection";
import { HomeWorkspaceHub } from "@/src/components/home/HomeWorkspaceHub";
import { InboxPreviewCard } from "@/src/components/InboxPreviewCard";
import { buildReviewQueue, ReviewLocalSummary } from "@/src/components/review/ReviewLocalSummary";
import { ConfigCenterWorkspacePersisted } from "@/src/components/ConfigCenterWorkspacePersisted";
import { InboxPersistedWorkspace } from "@/src/components/InboxPersistedWorkspace";
import { createSourceMaterialFromText } from "@/src/lib/sourceIngestion";
import { DictionaryLookupPanel, ReaderWorkspace, saveVocabularyItem } from "@/src/components/reader/ReaderWorkspace";
import { buildAnkiTsvExport } from "@/src/lib/ankiExport";
import { WordExplanationPanel } from "@/src/components/reader/WordExplanationPanel";
import { createReaderTextSelection } from "@/src/lib/selectionAnalysis";
import { PublishStudio } from "@/src/components/publish/PublishStudio";
import { GrowthLocalRecords } from "@/src/components/growth/GrowthLocalRecords";
import { homePageData } from "@/src/data/homeMock";
import type { InboxDraft } from "@/src/lib/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const uiTestState = vi.hoisted(() => ({ section: null as string | null }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useState: (initial: unknown) => actual.useState(initial === "settings" && uiTestState.section ? uiTestState.section : initial) };
});

vi.mock("@/src/lib/useWorkspaceStore", () => ({ useWorkspaceStore: () => ({ workspace: activeWorkspace, updateWorkspace: vi.fn() }) }));
let activeWorkspace = createDefaultWorkspaceState();
const render = (child: ReturnType<typeof createElement>) => renderToStaticMarkup(createElement(LanguageProvider, null, child));

it("renders English learning UI when learning Chinese, retaining Chinese material text", () => {
  activeWorkspace = createDefaultWorkspaceState();
  activeWorkspace.languageSettings = learningModeSettings("zh");
  const home = render(createElement(HeroSection, { data: homePageData.hero }));
  expect(home).not.toContain("今天继续读点什么");
  expect(render(createElement(HomeWorkspaceHub))).toContain("Import your first material");
  const preview = render(createElement(InboxPreviewCard, {
    draft: { title: "我的中文材料", inputMethod: "direct_paste", originalLanguage: "zh", rawContent: "我喜欢学习中文。", sourceReference: "", sourceTypeId: "article", categoryIds: [] } as unknown as InboxDraft,
    categoryConfigs: [], sourceTypeConfigs: [],
  }));
  expect(preview).toContain("我的中文材料");
  expect(preview).toContain("我喜欢学习中文。");
  expect(preview).toContain("Chinese");
  expect(preview).not.toContain("英语");
  expect(render(createElement(ReviewLocalSummary))).not.toContain("按计划复习词汇与表达");
});

it("keeps a single contextual import action on the empty homepage", () => {
  activeWorkspace = createDefaultWorkspaceState();
  const home = render(createElement(HomeWorkspaceHub));
  expect(home.match(/href="\/inbox"/g)).toHaveLength(1);
  expect(home).not.toContain("设置学习语言");
  expect(render(createElement(HeroSection, { data: homePageData.hero }))).not.toContain('href="/inbox"');
});

it("keeps the settings workspace language consistent in English mode", () => {
  activeWorkspace = createDefaultWorkspaceState();
  activeWorkspace.languageSettings = learningModeSettings("zh");
  const settings = render(createElement(ConfigCenterWorkspacePersisted));

  expect(settings).toContain("Use my AI service");
  expect(settings).toContain("Content organization");
  expect(settings).not.toContain("使用自己的 AI 服务");
  expect(settings).not.toContain("内容整理");
});

it("renders every primary empty workspace in English", () => {
  activeWorkspace = createDefaultWorkspaceState();
  activeWorkspace.languageSettings = learningModeSettings("zh");
  const mixed: Array<{ component: string; text: string[] }> = [];
  for (const component of [HomeWorkspaceHub, InboxPersistedWorkspace, ReaderWorkspace, ReviewLocalSummary, PublishStudio, GrowthLocalRecords, ConfigCenterWorkspacePersisted]) {
    const html = render(createElement(component));
    const text = html.replace(/<[^>]+>/g, " ");
    const matches = text.match(/[\u3400-\u9fff][^<>]{0,150}/g);
    if (matches) mixed.push({ component: component.name, text: matches });
  }
  expect(mixed).toEqual([]);
});

function interfaceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? interfaceFiles(join(directory, entry.name)) : entry.name.endsWith(".tsx") ? [join(directory, entry.name)] : []);
}

// Keep each file's assertions independent so slow disk access across the whole
// repository is not mistaken for a single UI operation exceeding five seconds.
it.each([...interfaceFiles("src/components"), ...interfaceFiles("app")])("has English interface translations in %s", (file) => {
  const missing: string[] = [];
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX);
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "t") {
      function check(argument: ts.Node) {
        if (ts.isStringLiteral(argument) && /[\u3400-\u9fff]/.test(translateUiText(argument.text))) missing.push(argument.text);
        ts.forEachChild(argument, check);
      }
      node.arguments.forEach(check);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  expect(missing).toEqual([]);
});

it("keeps the expanded AI configuration in English", () => {
  activeWorkspace = createDefaultWorkspaceState();
  activeWorkspace.languageSettings = learningModeSettings("zh");
  uiTestState.section = "ai";
  try {
    const html = render(createElement(ConfigCenterWorkspacePersisted));
    const text = html.replace(/<[^>]+>/g, " ");
    expect(text.match(/[\u3400-\u9fff][^<>]{0,100}/g)).toBeNull();
    expect(html.match(/(?:placeholder|title|aria-label)="[^"<>]*[\u3400-\u9fff][^"<>]*"/g)).toBeNull();
  } finally { uiTestState.section = null; }
});

it("translates populated workspace labels while preserving Chinese learning content", () => {
  activeWorkspace = createDefaultWorkspaceState();
  activeWorkspace.languageSettings = learningModeSettings("zh");
  const { sourceMaterial, learningSegments } = createSourceMaterialFromText({ title: "My material", content: "我喜欢学习。", language: "zh" });
  activeWorkspace.sourceMaterials = [sourceMaterial];
  activeWorkspace.learningSegments = learningSegments;
  activeWorkspace.contentPipelineItems = [{ id: "entry", title: "My article", description: "My description", sourceTypeId: "article", categoryIds: [], status: "raw", rawContent: "我喜欢学习。" }];
  activeWorkspace.vocabularyItems = [{ id: "word-1", text: "学习", lemma: "学习", language: "zh", partOfSpeech: "verb", meaningZh: "", meaningEn: "to learn", sourceMaterialId: sourceMaterial.id, segmentId: learningSegments[0]?.id ?? "", sentence: "我喜欢学习。", status: "learning", stage: 0, tags: [], createdAt: "2020-01-01T00:00:00.000Z", updatedAt: "2020-01-01T00:00:00.000Z" }];
  const mixed: Array<{ component: string; text: string[] }> = [];
  for (const component of [HomeWorkspaceHub, InboxPersistedWorkspace, ReaderWorkspace, ReviewLocalSummary, PublishStudio, GrowthLocalRecords, ConfigCenterWorkspacePersisted]) {
    const html = render(createElement(component));
    const text = html.replace(/<[^>]+>/g, " ").replaceAll("我喜欢学习。", "").replaceAll("学习", "");
    const matches = text.match(/[\u3400-\u9fff][^<>]{0,100}/g);
    if (matches) mixed.push({ component: component.name, text: matches });
  }
  expect(mixed).toEqual([]);
  expect(render(createElement(ReaderWorkspace))).toContain("我喜欢学习。");
  const reader = render(createElement(ReaderWorkspace));
  expect(reader.slice(reader.indexOf("<main"), reader.indexOf("</main>"))).toContain("AI article highlights");
});

it("distinguishes bilingual dictionary text, recorded audio and AI explanations in English UI", () => {
  activeWorkspace = createDefaultWorkspaceState();
  activeWorkspace.languageSettings = learningModeSettings("zh");
  const dictionary = render(createElement(DictionaryLookupPanel, { pending: false, error: "", onOnlineLookup: vi.fn(),
    result: { term: "learn", normalizedTerm: "learn", language: "en", source: "ecdict", phonetic: "lɜːn", chineseDefinitions: ["学习"],
      definitions: [{ partOfSpeech: "verb", definition: "To acquire knowledge.", synonyms: [] }], externalLinks: [] } }));
  expect(dictionary).toContain("Chinese dictionary meanings");
  expect(dictionary).toContain("English dictionary definitions");
  expect(dictionary).toContain("学习");
  expect(dictionary).toContain("No dictionary recording for this entry.");
  expect(dictionary).not.toContain("中文词典释义");
  const { sourceMaterial, learningSegments } = createSourceMaterialFromText({ title: "Words", content: "We learn English.", language: "en" });
  const selection = createReaderTextSelection({ selectedText: "learn", segment: learningSegments[0], segments: learningSegments });
  const ai = render(createElement(WordExplanationPanel, { selection, language: sourceMaterial.language, workspace: activeWorkspace, confirmSend: () => true, onUse: vi.fn() }));
  expect(ai).toContain("AI bilingual explanation");
  expect(ai.replace(/<[^>]+>/g, " ")).not.toMatch(/[\u3400-\u9fff]/);
});

it("keeps both meanings through reader save, repeated save, review and Anki export", () => {
  activeWorkspace = createDefaultWorkspaceState();
  const { sourceMaterial, learningSegments } = createSourceMaterialFromText({ title: "Words", content: "We learn English.", language: "en" });
  activeWorkspace.sourceMaterials = [sourceMaterial];
  const session = { id: "session", sourceMaterialId: sourceMaterial.id, goalId: "", startedAt: sourceMaterial.createdAt, updatedAt: sourceMaterial.createdAt,
    progress: 0, currentSegmentIndex: 0, savedVocabularyIds: [], savedExpressionIds: [], notes: "" };
  activeWorkspace.readingSessions = [session];
  const selection = createReaderTextSelection({ selectedText: "learn", segment: learningSegments[0], segments: learningSegments });
  const updateWorkspace: Parameters<typeof saveVocabularyItem>[0]["updateWorkspace"] = (updater) => {
    activeWorkspace = { ...activeWorkspace, ...(typeof updater === "function" ? updater(activeWorkspace) : updater) };
  };
  const save = () => saveVocabularyItem({ workspace: activeWorkspace, source: sourceMaterial, session, selection, meaningOverride: "To acquire knowledge.", meaningZhOverride: "学习", usingAiMeaning: true, updateWorkspace });
  save(); save();
  expect(activeWorkspace.vocabularyItems).toHaveLength(1);
  expect(activeWorkspace.vocabularyItems[0]).toMatchObject({ meaningZh: "学习", meaningEn: "To acquire knowledge.", tags: ["ai:word-explanation"] });
  const queue = buildReviewQueue(activeWorkspace);
  expect(queue[0].detail).toContain("学习");
  expect(queue[0].detail).toContain("To acquire knowledge.");
  expect(JSON.stringify(buildAnkiTsvExport(activeWorkspace))).toContain("学习 / To acquire knowledge.");
});
