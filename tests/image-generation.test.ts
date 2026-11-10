import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_AI_TASK_ROUTING,
  aiModelDeclaresImageInput,
  createCustomAiModelConfig,
  createCustomAiProviderConfig,
  normalizeAiConfiguration,
} from "@/src/lib/aiConfig";
import {
  DRAGTOKEN_IMAGES_BASE_URL,
  DRAGTOKEN_IMAGES_MODEL_ID,
  buildOpenAiImagesEditFormData,
  buildOpenAiImagesEndpoint,
  buildOpenAiImagesGenerationBody,
  editOpenAiImage,
  generateOpenAiImage,
} from "@/src/lib/llm/imageGeneration";

describe("OpenAI Images API image generation routes", () => {
  it("uses DragToken documented image generation and edit endpoints", () => {
    expect(buildOpenAiImagesEndpoint(DRAGTOKEN_IMAGES_BASE_URL, "generation")).toBe(
      "https://draw.dragtokens.com/v1/images/generations",
    );
    expect(buildOpenAiImagesEndpoint(DRAGTOKEN_IMAGES_BASE_URL, "edit")).toBe(
      "https://draw.dragtokens.com/v1/images/edits",
    );
  });

  it("does not turn an Images API base URL into Chat Completions", () => {
    const endpoint = buildOpenAiImagesEndpoint("https://draw.dragtokens.com/v1", "generation");

    expect(endpoint).not.toContain("/chat/completions");
    expect(endpoint).not.toContain("/image-generation");
    expect(endpoint).toBe("https://draw.dragtokens.com/v1/images/generations");
  });

  it("preserves the image model ID exactly in generation requests", () => {
    const body = buildOpenAiImagesGenerationBody({
      modelId: DRAGTOKEN_IMAGES_MODEL_ID,
      prompt: "A clean editorial card.",
      size: "1536x1024",
      outputFormat: "png",
      quality: "auto",
      moderation: "auto",
      n: 1,
    });

    expect(body.model).toBe("gpt-image-2");
    expect(body.model).not.toBe("gpt-image-2-mini");
    expect(body).toMatchObject({
      prompt: "A clean editorial card.",
      size: "1536x1024",
      output_format: "png",
      quality: "auto",
      moderation: "auto",
    });
  });

  it("builds edit form data for Images API without JSON chat messages", () => {
    const formData = buildOpenAiImagesEditFormData({
      modelId: "custom-image-model",
      prompt: "Remove the background.",
      images: [{ blob: new Blob(["image"], { type: "image/png" }), fileName: "input.png" }],
      size: "1254x1254",
      outputFormat: "webp",
      quality: "high",
      background: "opaque",
      n: 1,
    });

    expect(formData.get("model")).toBe("custom-image-model");
    expect(formData.get("prompt")).toBe("Remove the background.");
    expect(formData.get("size")).toBe("1254x1254");
    expect(formData.get("output_format")).toBe("webp");
    expect(formData.get("quality")).toBe("high");
    expect(formData.get("background")).toBe("opaque");
    expect(formData.getAll("image")).toHaveLength(1);
  });

  it("sends generation requests to Images API with Bearer auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ b64_json: "abc123" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const response = await generateOpenAiImage({
      baseUrl: DRAGTOKEN_IMAGES_BASE_URL,
      apiKey: "test-key",
      modelId: "gpt-image-2",
      prompt: "Generate a typography card.",
      fetchImpl: fetchMock as typeof fetch,
    });

    expect(response.endpoint).toBe("https://draw.dragtokens.com/v1/images/generations");
    expect(response.modelId).toBe("gpt-image-2");
    expect(response.images).toEqual([{ kind: "base64", value: "abc123" }]);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://draw.dragtokens.com/v1/images/generations");
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      Authorization: "Bearer test-key",
    });
    expect(JSON.parse(init.body as string)).toMatchObject({
      model: "gpt-image-2",
      prompt: "Generate a typography card.",
    });
  });

  it("sends image edits to /images/edits and parses URL responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ url: "https://example.com/image.png" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const response = await editOpenAiImage({
      baseUrl: DRAGTOKEN_IMAGES_BASE_URL,
      apiKey: "test-key",
      modelId: "gpt-image-2",
      prompt: "Edit the image.",
      images: [{ blob: new Blob(["image"], { type: "image/png" }), fileName: "input.png" }],
      fetchImpl: fetchMock as typeof fetch,
    });

    expect(response.endpoint).toBe("https://draw.dragtokens.com/v1/images/edits");
    expect(response.images).toEqual([
      { kind: "url", value: "https://example.com/image.png" },
    ]);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://draw.dragtokens.com/v1/images/edits");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer test-key",
    });
    expect(init.headers).not.toHaveProperty("Content-Type");
    expect(init.body).toBeInstanceOf(FormData);
  });

  it("preserves image-generation model capability without treating it as image input OCR", () => {
    const provider = {
      ...createCustomAiProviderConfig({ presetId: "dragtoken-images" }),
      id: "provider-image",
      adapterProtocol: "openai_images" as const,
      baseUrl: DRAGTOKEN_IMAGES_BASE_URL,
      enabled: true,
      connectionVerification: { status: "verified" as const },
    };
    const model = createCustomAiModelConfig(provider, {
      id: "model-image",
      displayName: "DragToken gpt-image-2",
      modelId: DRAGTOKEN_IMAGES_MODEL_ID,
      capabilities: ["image"],
      supportsText: false,
      supportsVision: false,
      enabled: true,
      capabilityVerification: {
        text: "unverified",
        image: "unverified",
        structuredOutput: "unverified",
        reasoning: "unverified",
        streaming: "unverified",
      },
    });

    expect(model.capabilities).toContain("image");
    expect(model.capabilities).not.toContain("text");
    expect(model.capabilities).not.toContain("vision");
    expect(aiModelDeclaresImageInput(model)).toBe(false);

    const normalized = normalizeAiConfiguration({
      aiProviders: [provider],
      aiModels: [model],
      aiTaskRouting: {
        ...DEFAULT_AI_TASK_ROUTING,
        analysis: { providerId: provider.id, modelId: model.id },
        imageGeneration: { providerId: provider.id, modelId: model.id },
        imageEditing: { providerId: provider.id, modelId: model.id },
      },
    });
    const normalizedModel = normalized.aiModels.find((item) => item.id === model.id);

    expect(normalizedModel?.modelId).toBe(DRAGTOKEN_IMAGES_MODEL_ID);
    expect(normalizedModel?.capabilities).toContain("image");
    expect(normalizedModel?.capabilities).not.toContain("vision");
    expect(normalized.aiTaskRouting.imageGeneration).toEqual({
      providerId: provider.id,
      modelId: model.id,
    });
  });
});
