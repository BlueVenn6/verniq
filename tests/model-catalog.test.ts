import { afterEach, describe, expect, it, vi } from "vitest";
import { listProviderModels, parseModelCatalog } from "@/src/lib/llm/modelCatalog";
import { DEFAULT_AI_PROVIDERS, DEFAULT_AI_LOCAL_PROVIDER_ID } from "@/src/lib/aiConfig";

afterEach(() => vi.unstubAllGlobals());
describe("provider model listing", () => {
  it("reads OpenAI/Anthropic and Gemini lists without treating partial results as a retirement list", () => {
    expect(parseModelCatalog({ data: [{ id: "custom-EXACT" }], has_more: true })).toEqual({ models: [{ id: "custom-EXACT", name: "custom-EXACT" }], partial: true });
    expect(parseModelCatalog({ models: [{ name: "models/gemini-example", displayName: "Example" }] }).models[0].id).toBe("gemini-example");
    expect(() => parseModelCatalog({})).toThrow("did not return a model list");
  });
  it("uses GET with no inference body and preserves custom IDs", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ id: "local/loaded-exact-model" }] })));
    vi.stubGlobal("fetch", fetchMock);
    const provider = { ...DEFAULT_AI_PROVIDERS.find((entry) => entry.id === DEFAULT_AI_LOCAL_PROVIDER_ID)!, baseUrl: "http://localhost:1234/v1", authMode: "none" as const };
    const result = await listProviderModels(provider);
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:1234/v1/models");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "GET", body: undefined });
    expect(result.models[0].id).toBe("local/loaded-exact-model");
  });
});
