import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_AI_LOCAL_PROVIDER_ID,
  DEFAULT_AI_MODELS,
  DEFAULT_AI_PRIVACY_SETTINGS,
  DEFAULT_AI_PROVIDERS,
  DEFAULT_AI_TASK_ROUTING,
} from "@/src/lib/aiConfig";
import {
  applyEditedImageTextToInboxDraft,
  buildImageTextExtractionPrompt,
  getImageTextExtractionRouteStatus,
  parseImageDataUrl,
  validateImageFileForExtraction,
} from "@/src/lib/imageTextExtraction";
import { extractImageTextWithAi } from "@/src/lib/llm/imageTextExtraction";
import { geminiAdapter } from "@/src/lib/llm/providers/gemini";
import { callOpenAICompatible } from "@/src/lib/llm/providers/openaiCompatible";
import type {
  AiModelConfig,
  AiProviderConfig,
  AiTaskRouting,
  InboxDraft,
} from "@/src/lib/types";
import type { LlmRequest } from "@/src/lib/llm/types";
import { VERNIQ_TEST_IMAGE_BASE64 } from "@/src/lib/llm/providerTest";
import { inflateSync } from "node:zlib";

const routeLlmChatMock = vi.hoisted(() => vi.fn());

vi.mock("@/src/lib/llm/router", () => ({
  routeLlmChat: routeLlmChatMock,
}));

const IMAGE_DATA_URL = "data:image/png;base64,VkVSTklRIFRFU1Q=";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function localProvider(): AiProviderConfig {
  return {
    ...clone(DEFAULT_AI_PROVIDERS.find((provider) => provider.id === DEFAULT_AI_LOCAL_PROVIDER_ID)!),
    enabled: true,
    authMode: "none",
    baseUrl: "http://localhost:1234/v1",
    connectionVerification: { status: "verified" },
  };
}

function visionModel(overrides: Partial<AiModelConfig> = {}): AiModelConfig {
  return {
    ...clone(DEFAULT_AI_MODELS.find((model) => model.providerId === DEFAULT_AI_LOCAL_PROVIDER_ID)!),
    id: "local-vision-model",
    providerId: DEFAULT_AI_LOCAL_PROVIDER_ID,
    displayName: "Local vision display",
    modelName: "Local vision display",
    modelId: "vision-model-exact",
    enabled: true,
    supportsText: true,
    supportsVision: true,
    supportsStructuredOutput: false,
    supportsReasoning: false,
    supportsStreaming: false,
    capabilities: ["analysis", "rewrite", "vision"],
    capabilityVerification: {
      text: "verified",
      image: "verified",
      structuredOutput: "unverified",
      reasoning: "unverified",
      streaming: "unverified",
    },
    ...overrides,
  };
}

function imageRouting(modelId = "local-vision-model"): AiTaskRouting {
  return {
    ...clone(DEFAULT_AI_TASK_ROUTING),
    imageTextExtraction: {
      ...clone(DEFAULT_AI_TASK_ROUTING.imageTextExtraction!),
      providerId: DEFAULT_AI_LOCAL_PROVIDER_ID,
      modelId,
      enabled: true,
    },
  };
}

function baseRequest(overrides: Partial<LlmRequest> = {}): LlmRequest {
  return {
    provider: "openai-compatible",
    model: "gpt-5.5",
    apiKey: "test-key",
    baseUrl: "https://api.example.com/v1",
    authMode: "bearer",
    messages: [{ role: "user", content: "Extract text." }],
    images: [{ mimeType: "image/png", data: "VkVSTklRIFRFU1Q=" }],
    requestType: "image-text-extraction",
    ...overrides,
  };
}

function inboxDraft(): InboxDraft {
  return {
    title: "Image import",
    sourceTypeId: "article",
    inputMethod: "direct_paste",
    sourceReference: "",
    originalLanguage: "en",
    summary: "",
    rawContent: "",
    moduleId: "english-blog",
    categoryIds: [],
    productIds: [],
    targetAudience: "",
    preferredPlatformIds: [],
    productMode: "none",
    platformMode: "none",
    rewriteDepth: "medium",
  };
}

beforeEach(() => {
  routeLlmChatMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("image text extraction helpers", () => {
  it("ships a complete, decodable PNG for real image capability probes", () => {
    expect(VERNIQ_TEST_IMAGE_BASE64).toMatch(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/);
    const png = Buffer.from(VERNIQ_TEST_IMAGE_BASE64, "base64");
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    let offset = 8;
    const pixels: Buffer[] = [];
    const chunks: string[] = [];
    while (offset < png.length) {
      const length = png.readUInt32BE(offset);
      const type = png.toString("ascii", offset + 4, offset + 8);
      expect(offset + 12 + length).toBeLessThanOrEqual(png.length);
      const chunk = png.subarray(offset + 4, offset + 8 + length);
      let crc = 0xffffffff;
      for (const byte of chunk) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
      }
      expect((crc ^ 0xffffffff) >>> 0).toBe(png.readUInt32BE(offset + 8 + length));
      if (type === "IDAT") pixels.push(png.subarray(offset + 8, offset + 8 + length));
      chunks.push(type);
      offset += 12 + length;
    }
    expect(chunks[0]).toBe("IHDR");
    expect(chunks.at(-1)).toBe("IEND");
    expect(inflateSync(Buffer.concat(pixels)).length).toBeGreaterThan(0);
  });
  it("extracts the original language without rejecting Chinese-only images", () => {
    const prompt = buildImageTextExtractionPrompt();
    expect(prompt).toContain("including English and Chinese");
    expect(prompt).not.toContain("no usable English");
    expect(prompt).toContain("no readable text");
  });
  it("strips the data URL header and keeps MIME separately", () => {
    expect(parseImageDataUrl(IMAGE_DATA_URL)).toEqual({
      mimeType: "image/png",
      base64: "VkVSTklRIFRFU1Q=",
    });
  });

  it("rejects unsupported image formats before any provider call", () => {
    const file = new File(["x"], "scan.gif", { type: "image/gif" });

    expect(validateImageFileForExtraction(file).ok).toBe(false);
  });

  it("reports unverified vision models without treating them as usable", () => {
    const provider = localProvider();
    const model = visionModel({
      capabilityVerification: {
        text: "verified",
        image: "unverified",
        structuredOutput: "unverified",
        reasoning: "unverified",
        streaming: "unverified",
      },
    });
    const status = getImageTextExtractionRouteStatus({
      aiProviders: [provider],
      aiModels: [model],
      aiTaskRouting: imageRouting(model.id),
    });

    expect(status.ok).toBe(false);
    expect(status.imageVerificationStatus).toBe("unverified");
    expect(status.message).toContain("图片能力尚未验证");
  });

  it("blocks a verified image model when its service connection is not verified", () => {
    const provider = {
      ...localProvider(),
      connectionVerification: { status: "unverified" as const },
    };
    const status = getImageTextExtractionRouteStatus({
      aiProviders: [provider],
      aiModels: [visionModel()],
      aiTaskRouting: imageRouting(),
    });

    expect(status.ok).toBe(false);
    expect(status.message).toContain("尚未完成连接验证");
  });

  it("calls the routed vision model only after extraction is explicitly requested", async () => {
    routeLlmChatMock.mockResolvedValue({ text: "VERNIQ TEST" });

    expect(routeLlmChatMock).not.toHaveBeenCalled();

    const result = await extractImageTextWithAi({
      imageDataUrl: IMAGE_DATA_URL,
      aiProviders: [localProvider()],
      aiModels: [visionModel()],
      aiTaskRouting: imageRouting(),
    });

    expect(result.text).toBe("VERNIQ TEST");
    expect(result.modelId).toBe("vision-model-exact");
    expect(routeLlmChatMock).toHaveBeenCalledTimes(1);
    expect(routeLlmChatMock.mock.calls[0][0].images[0]).toEqual({
      mimeType: "image/png",
      data: "VkVSTklRIFRFU1Q=",
    });
    expect(JSON.stringify(routeLlmChatMock.mock.calls[0][0])).not.toContain("data:image");
  });

  it("does not send an image when AI is disabled", async () => {
    await expect(extractImageTextWithAi({
      imageDataUrl: IMAGE_DATA_URL,
      aiProviders: [localProvider()],
      aiModels: [visionModel()],
      aiTaskRouting: imageRouting(),
      aiPrivacySettings: { ...DEFAULT_AI_PRIVACY_SETTINGS, allowRemoteAi: false, onlyUseLocalModels: false },
    })).rejects.toThrow("AI 已关闭");
    expect(routeLlmChatMock).not.toHaveBeenCalled();
  });

  it("does not create extracted content from an empty model response", async () => {
    routeLlmChatMock.mockResolvedValue({ text: "   " });

    await expect(
      extractImageTextWithAi({
        imageDataUrl: IMAGE_DATA_URL,
        aiProviders: [localProvider()],
        aiModels: [visionModel()],
        aiTaskRouting: imageRouting(),
      }),
    ).rejects.toThrow("未能识别图片中的文字");
  });

  it("uses only the edited extraction text when building the Reader import draft", () => {
    const result = applyEditedImageTextToInboxDraft({
      draft: inboxDraft(),
      editedText: "  User corrected text.  ",
      fileName: "lesson.PNG",
      mimeType: "image/png",
    });

    expect(result.rawContent).toBe("User corrected text.");
    expect(result.sourceFileName).toBe("lesson.PNG");
    expect(result.sourceFileExt).toBe("png");
    expect(result.sourceAssetType).toBe("image");
  });

  it("refuses to build a Reader import draft without confirmed editable text", () => {
    expect(() =>
      applyEditedImageTextToInboxDraft({
        draft: inboxDraft(),
        editedText: "   ",
        fileName: "lesson.png",
        mimeType: "image/png",
      }),
    ).toThrow("请先提取图片文字");
  });
});

describe("multimodal provider requests", () => {
  it("builds OpenAI-compatible chat messages with text and image in the same user message", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: "VERNIQ TEST" } }] }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await callOpenAICompatible(
      baseRequest({
        model: "relay-vision-model-exact",
        baseUrl: "https://api.example.com/v1",
        customEndpointPath: "/v1/chat/completions",
      }),
    );

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.example.com/v1/chat/completions",
    );
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));

    expect(body.model).toBe("relay-vision-model-exact");
    expect(body.messages[0].content[0]).toEqual({
      type: "text",
      text: "Extract text.",
    });
    expect(body.messages[0].content[1]).toEqual({
      type: "image_url",
      image_url: { url: "data:image/png;base64,VkVSTklRIFRFU1Q=" },
    });
  });

  it("classifies unsupported image input separately for non-vision adapters", async () => {
    await expect(
      callOpenAICompatible(baseRequest({ provider: "claude" })),
    ).rejects.toThrow("不支持图片");
  });

  it("builds Gemini image requests with MIME and bare base64 data", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: "VERNIQ TEST" }] } }] }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await geminiAdapter.chat(
      baseRequest({
        provider: "gemini",
        model: "gemini-3.1-pro",
        apiKey: "gemini-test-key",
        baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      }),
    );

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    const inlineData = body.contents[0].parts[1].inlineData;

    expect(inlineData).toEqual({
      mimeType: "image/png",
      data: "VkVSTklRIFRFU1Q=",
    });
    expect(JSON.stringify(body)).not.toContain("data:image");
  });
});
