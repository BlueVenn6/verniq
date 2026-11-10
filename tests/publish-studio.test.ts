import { describe, expect, it } from "vitest";
import { getWorkspaceStatusSummary } from "@/src/components/layout/WorkspaceFileControls";
import {
  buildCustomPublishSource,
  buildPublishCardSvg,
  buildPublishSources,
  createOutputDraftFromPublishDraft,
  generateLocalPublishDraft,
  getPngCanvasSize,
  getPublishOutputDraftType,
  getPublishRatio,
  PUBLISH_PACKAGE_MIGRATION_NOTICE,
  publishCardFits,
  validateShareCardText,
} from "@/src/lib/publishStudio";
import { createDefaultWorkspaceState } from "@/src/lib/workspace/core";
import type { WorkspaceStorageStatus } from "@/src/lib/workspace/storageAdapter";
import { markdownToPlainText } from "@/src/lib/publish/publishExport";

describe("publish studio MVP", () => {
  it("keeps standalone source materials and never substitutes an article with the same title", () => {
    const workspace = createDefaultWorkspaceState();
    workspace.contentPipelineItems = [{ id: "entry", title: "Same title", description: "", sourceTypeId: "article", categoryIds: [], status: "raw", extractedText: "First article" }];
    workspace.sourceMaterials = [{ id: "second", title: "Same title", goalId: "", language: "zh", sourceType: "text", originalContent: "第二篇文章。", cleanedContent: "第二篇文章。", metadata: {}, createdAt: "", updatedAt: "" }];
    const sources = buildPublishSources(workspace);
    expect(sources.find((source) => source.sourceMaterialId === "second")?.content).toBe("第二篇文章。");
    expect(sources.find((source) => source.id === "material:entry")?.content).toBe("First article");
  });

  it("copies readable text while preserving paragraphs and link destinations", () => {
    expect(markdownToPlainText("# My note\n\n**Learn** by doing.\n\n[Source](https://example.com/article)"))
      .toBe("My note\n\nLearn by doing.\n\nSource (https://example.com/article)");
  });
  it("builds publish sources from current material and saved vocabulary", () => {
    const workspace = createDefaultWorkspaceState();

    workspace.currentContentId = "content-1";
    workspace.contentPipelineItems = [
      {
        id: "content-1",
        title: "Why small language habits matter",
        description: "A short article about deliberate practice.",
        sourceTypeId: "article",
        categoryIds: ["learning"],
        status: "raw",
        extractedText: "Small habits make language learning easier to sustain.",
      },
    ];
    workspace.sourceMaterials = [
      {
        id: "content-1",
        goalId: "goal-1",
        title: "Why small language habits matter",
        sourceType: "text",
        language: "en",
        originalContent: "Small habits make language learning easier to sustain.",
        cleanedContent: "Small habits make language learning easier to sustain.",
        metadata: {},
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    workspace.vocabularyItems = [
      {
        id: "vocab-1",
        text: "sustain",
        lemma: "sustain",
        language: "en",
        partOfSpeech: "verb",
        meaningZh: "维持",
        meaningEn: "to keep something going",
        sourceMaterialId: "content-1",
        segmentId: "segment-1",
        sentence: "Small habits make language learning easier to sustain.",
        status: "learning",
        stage: 1,
        tags: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];

    const sources = buildPublishSources(workspace);

    expect(sources.some((source) => source.kind === "current_material")).toBe(true);
    expect(sources.some((source) => source.kind === "vocabulary_expression")).toBe(true);
    expect(sources.find((source) => source.kind === "current_material")?.sourceMaterialId).toBe("content-1");
  });

  it("preserves the complete selected content without adding editorial instructions", () => {
    const custom = buildCustomPublishSource(
      "Interest gives reading a reason to continue. The useful part is turning reading into your own explanation.",
    );

    expect(custom?.kind).toBe("custom");

    const draft = generateLocalPublishDraft({
      sources: custom ? [custom] : [],
      settings: {
        mode: "text",
        purpose: "把兴趣阅读整理成可分享的观点",
        audience: "独立学习者",
        tone: "editorial",
        length: "medium",
        customInstruction: "不要写成学习打卡。",
      },
    });

    expect(draft.title).toBe("把兴趣阅读整理成可分享的观点");
    expect(draft.body).toContain("The useful part is turning reading into your own explanation.");
    expect(draft.body).not.toContain("表达上");
    expect(draft.markdown).not.toContain("补充要求：");
    expect(draft.markdown).not.toContain("独立学习者");
  });

  it("keeps only the MVP export ratios and maps them to PNG canvas sizes", () => {
    expect(getPublishRatio("1:1")).toMatchObject({ width: 1600, height: 1600 });
    expect(getPublishRatio("4:5")).toMatchObject({ width: 1600, height: 2000 });
    expect(getPublishRatio("16:9")).toMatchObject({ width: 1920, height: 1080 });
    expect(getPngCanvasSize(getPublishRatio("16:9"))).toEqual({ width: 1920, height: 1080 });
  });

  it("renders brand none or Made with Verniq and includes uploaded image data in split SVG", () => {
    const ratio = getPublishRatio("4:5");
    const imageDataUrl = "data:image/png;base64,abc123";
    const withoutBrand = buildPublishCardSvg({
      ratio,
      layout: "pure_text",
      imageCrop: "center",
      brandMode: "none",
      title: "Read what matters",
      subtitle: "编辑感",
      body: "A clean card should focus on one idea.",
      footer: "Source note",
    });
    const withBrandAndImage = buildPublishCardSvg({
      ratio,
      layout: "split",
      imageCrop: "top",
      brandMode: "made_with",
      title: "Read what matters",
      subtitle: "编辑感",
      body: "A clean card should focus on one idea.",
      footer: "Source note",
      imageDataUrl,
      imageWidth: 400,
      imageHeight: 1200,
    });

    expect(withoutBrand).not.toContain("Made with Verniq");
    expect(withBrandAndImage).toContain("Made with Verniq");
    expect(withBrandAndImage).toContain(imageDataUrl);
    // Cropping now uses measured, draggable coordinates rather than fixed SVG alignment.
    expect(withBrandAndImage).toContain('x="0" y="0" width="1600" height="4800" preserveAspectRatio="none"');
  });

  it("warns when long text is not suitable for a share card", () => {
    const result = validateShareCardText({
      title: "A thoughtful title",
      body: "这是一段很长的正文。".repeat(80),
      ratio: getPublishRatio("16:9"),
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain("内容偏长");
    expect(result.message).toContain("建议精简");
  });

  it("keeps card wording intact, uses valid font attributes, and renders only the chosen identity", () => {
    const input = { ratio: getPublishRatio("1:1"), layout: "pure_text" as const, imageCrop: "center" as const, title: "Small steps", subtitle: "", body: "Read what matters.\n每天学一点。", footer: "" };
    const named = buildPublishCardSvg({ ...input, brandMode: "custom_name", customName: "Ada & Lin" });
    expect(named).toContain('style="display:block;width:100%;height:auto"');
    expect(named).toContain("Ada &amp; Lin"); expect(named).not.toContain("Made with Verniq");
    expect(named).toContain("Read what matters."); expect(named).not.toContain("…");
    expect(named).toContain('font-family="&quot;'); expect(named).not.toContain('font-family=""');
    expect(buildPublishCardSvg({ ...input, brandMode: "none", customName: "Ada" })).not.toContain("Ada");
  });

  it("renders the chosen typography at its requested size without silently shrinking it", () => {
    const input = { ratio: getPublishRatio("1:1"), layout: "pure_text" as const, imageCrop: "center" as const, brandMode: "none" as const, title: "", subtitle: "", body: "One clear idea. 一句话。", footer: "", fontFamily: "serif" as const, fontScale: 1.5, fontWeight: 700, textAlign: "center" as const };
    const svg = buildPublishCardSvg(input);
    expect(svg).toContain("Verniq Card Serif");
    expect(svg).toContain('font-size="77"');
    expect(svg).toContain('font-weight="700"');
    expect(svg).toContain('text-anchor="middle"');
    expect(publishCardFits(input)).toBe(true);
    expect(publishCardFits({ ...input, body: "This text needs more space. ".repeat(100), fontScale: 2 })).toBe(false);
  });

  it("keeps explicit image positions stable across aspect ratios, with text in a separate area", () => {
    const input = { ratio: getPublishRatio("1:1"), imageCrop: "bottom" as const, brandMode: "none" as const, title: "", subtitle: "", body: "One short quote.", footer: "", imageDataUrl: "data:image/png;base64,abc123" };
    const above = buildPublishCardSvg({ ...input, layout: "image_top" });
    const beside = buildPublishCardSvg({ ...input, layout: "image_left" });
    expect(above).toContain('data-card-image-region="true" x="0" y="0" width="1600" height="800"');
    expect(beside).toContain('data-card-image-region="true" x="0" y="0" width="800" height="1600"');
    expect(above).not.toBe(beside);
    expect(buildPublishCardSvg({ ...input, layout: "pure_text" })).not.toContain("<image");
  });

  it("fits a title and a two-line quote below an image on a landscape card", () => {
    expect(publishCardFits({ ratio: getPublishRatio("16:9"), layout: "image_top", imageCrop: "center", brandMode: "none", title: "Small steps", subtitle: "", body: "Read. Reflect.\n每天学一点。", footer: "", imageDataUrl: "data:image/png;base64,abc123", fontScale: 1.4, fontFamily: "sans" })).toBe(true);
  });

  it("fills the top half edge to edge without an inset card frame", () => {
    const svg = buildPublishCardSvg({ ratio: getPublishRatio("1:1"), layout: "image_top", imageCrop: "center", brandMode: "none", title: "", subtitle: "", body: "A thought.", footer: "", imageDataUrl: "data:image/png;base64,abc123" });
    expect(svg).toContain('data-card-image-region="true" x="0" y="0" width="1600" height="800"');
    expect(svg).not.toContain('stroke="#d9cbb6"');
    expect(svg).not.toContain('<line');
  });

  it("saves publish output as text-only outputDrafts data", () => {
    const source = buildCustomPublishSource("A custom idea for a publish draft.");
    const draft = generateLocalPublishDraft({
      sources: source ? [source] : [],
      settings: {
        mode: "card",
        purpose: "整理成分享卡片",
        audience: "读者",
        tone: "calm",
        length: "short",
        customInstruction: "",
      },
    });
    const outputDraft = createOutputDraftFromPublishDraft({
      draft,
      sources: source ? [source] : [],
      outputType: getPublishOutputDraftType("card"),
    });

    expect(outputDraft.outputType).toBe("plan");
    expect(outputDraft.content).toContain(draft.title);
    expect(JSON.stringify(outputDraft)).not.toContain("imageDataUrl");
    expect(JSON.stringify(outputDraft)).not.toContain("brandMode");
    expect(JSON.stringify(outputDraft)).not.toContain("ratioId");
  });

  it("keeps the old publish packages route as a migration entry", () => {
    expect(PUBLISH_PACKAGE_MIGRATION_NOTICE).toBe("发布功能已移至新的发布工作台。");
  });
});

describe("workspace status bar summary", () => {
  const desktopFallbackStatus: WorkspaceStorageStatus = {
    kind: "desktop",
    isDesktop: true,
    hasOpenedWorkspaceFile: false,
    isUsingFallbackStorage: true,
  };

  it("describes local cache and sends data management to settings", () => {
    const summary = getWorkspaceStatusSummary({
      workspaceFile: { storageMode: "browser-cache", backupCount: 0 },
      storageStatus: desktopFallbackStatus,
    });

    expect(summary.label).toBe("保存在本机缓存");
    expect(summary.actionLabel).toBe("数据与备份");
  });

  it("shows opened file name when a desktop workspace file is active", () => {
    const summary = getWorkspaceStatusSummary({
      workspaceFile: {
        storageMode: "desktop-file",
        filePath: "C:\\Users\\demo\\workspace.json",
        backupCount: 2,
        lastSavedAt: "2026-07-27T01:00:00.000Z",
      },
      storageStatus: {
        kind: "desktop",
        isDesktop: true,
        hasOpenedWorkspaceFile: true,
        isUsingFallbackStorage: false,
        workspaceFilePath: "C:\\Users\\demo\\workspace.json",
      },
    });

    expect(summary.label).toBe("workspace.json");
    expect(summary.actionLabel).toBe("管理");
    expect(summary.isOpenedFile).toBe(true);
  });
});
