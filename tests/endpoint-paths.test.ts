import { describe, expect, it } from "vitest";
import { buildOpenAiCompatibleEndpoint } from "@/src/lib/llm/providers/openaiCompatible";
import { buildGeminiGenerateContentEndpoint } from "@/src/lib/llm/providers/gemini";
import { buildModelCatalogEndpoint } from "@/src/lib/llm/modelCatalog";
import { getProviderRequestUrl } from "@/src/lib/llm/providerTest";
import { createCustomAiProviderConfig } from "@/src/lib/aiConfig";

describe("configured API paths", () => {
  it.each([
    ["https://relay.example/gateway/v1", "/v1/chat/completions", "https://relay.example/gateway/v1/chat/completions"],
    ["https://relay.example/v1/chat/completions", "/v1/chat/completions", "https://relay.example/v1/chat/completions"],
    ["https://relay.example/gateway/v1/messages", "/messages", "https://relay.example/gateway/v1/messages"],
    ["https://relay.example/proxy", "/proxy/v1/messages", "https://relay.example/proxy/v1/messages"],
    ["https://relay.example/gateway/v1/", "/chat/completions", "https://relay.example/gateway/v1/chat/completions"],
  ])("resolves %s + %s without duplicate API segments", (base, path, expected) => {
    expect(buildOpenAiCompatibleEndpoint(base, path)).toBe(expected);
    expect(getProviderRequestUrl({ provider: path.endsWith("messages") ? "claude" : "openai-compatible", baseUrl: base, customEndpointPath: path, model: "My/Exact-ID", messages: [] })).toBe(expected);
  });
  it.each(["//other.example/v1/chat/completions", "/\\other.example/messages", "https://other.example/messages"])("rejects origin-changing endpoint %s", (path) => {
    expect(() => buildOpenAiCompatibleEndpoint("https://relay.example/v1", path)).toThrow();
    expect(() => buildGeminiGenerateContentEndpoint("https://relay.example/v1beta", "exact", path)).toThrow();
  });
  it("keeps Gemini's version prefix and replaces a pasted full generation URL", () => {
    expect(buildGeminiGenerateContentEndpoint("https://relay.example/gateway/v1beta", "exact", "/v1beta/models/{modelId}:generateContent")).toBe("https://relay.example/gateway/v1beta/models/exact:generateContent");
    expect(buildGeminiGenerateContentEndpoint("https://relay.example/v1beta/models/old:generateContent", "exact")).toBe("https://relay.example/v1beta/models/exact:generateContent");
  });
  it.each(["openai-compatible", "anthropic-relay"] as const)("lists models from the same gateway prefix as %s requests", (presetId) => {
    const provider = { ...createCustomAiProviderConfig({ presetId, id: "gateway", name: "Gateway" }), baseUrl: "https://relay.example/gateway", customEndpointPath: presetId === "anthropic-relay" ? "/v1/messages" : "/v1/chat/completions" };
    expect(buildModelCatalogEndpoint(provider)).toBe("https://relay.example/gateway/v1/models");
  });
});
