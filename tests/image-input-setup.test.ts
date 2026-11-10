import { describe, expect, it } from "vitest";
import { createCustomAiModelConfig, createCustomAiProviderConfig, DEFAULT_AI_TASK_ROUTING, normalizeAiConfiguration } from "@/src/lib/aiConfig";
import { applyImageInputVerification, getImageInputCandidates } from "@/src/lib/imageInputSetup";
import { getImageTextExtractionRouteStatus } from "@/src/lib/imageTextExtraction";

function setup() {
  const provider = createCustomAiProviderConfig({ id: "existing-relay", presetId: "openai-compatible", name: "My relay", baseUrl: "https://relay.example/v1" });
  provider.enabled = true;
  provider.credentialRef = "already-saved-secret";
  const model = createCustomAiModelConfig(provider, { id: "existing-gpt", modelId: "gpt-5.6-terra", displayName: "My GPT", supportsVision: false, capabilities: ["text"] });
  return { aiProviders: [provider], aiModels: [model], aiTaskRouting: structuredClone(DEFAULT_AI_TASK_ROUTING) };
}
const probe = { success: true, capability: "image" as const, providerId: "existing-relay", modelId: "existing-gpt", checkedAt: "2026-11-08T02:00:00Z", requestUrl: "https://relay.example/v1/chat/completions", message: "Visible test text read" };

describe("image input setup using an existing service", () => {
  it("offers an enabled text model for probing without offering a drawing API", () => {
    const config = setup();
    const drawing = { ...config.aiProviders[0], id: "drawing", adapterProtocol: "openai_images" as const };
    const candidates = getImageInputCandidates({ aiProviders: [...config.aiProviders, drawing], aiModels: [...config.aiModels, { ...config.aiModels[0], id: "draw-model", providerId: drawing.id }] });
    expect(candidates.map(({ model }) => model.id)).toEqual(["existing-gpt"]);
    expect(getImageTextExtractionRouteStatus(config).ok).toBe(false);
  });
  it("keeps the same service and credential and persists a route only after image verification", () => {
    const config = setup();
    const next = normalizeAiConfiguration(applyImageInputVerification(config, probe));
    expect(next.aiProviders.find(p => p.id === "existing-relay")?.credentialRef).toBe("already-saved-secret");
    expect(next.aiModels.filter(m => m.providerId === "existing-relay")).toHaveLength(1);
    expect(getImageTextExtractionRouteStatus(next).ok).toBe(true);
    expect(next.aiTaskRouting.languageAnalysis).toEqual(config.aiTaskRouting.languageAnalysis);
    expect(config.aiModels[0].supportsVision).toBe(false);
  });
  it("records failed image verification without claiming a usable route", () => {
    const next = applyImageInputVerification(setup(), { ...probe, success: false, message: "Unsupported image input" });
    expect(next.aiModels[0].capabilityVerification?.image).toBe("failed");
    expect(next.aiModels[0].supportsVision).toBe(false);
    expect(getImageTextExtractionRouteStatus(next).ok).toBe(false);
  });
  it("does not use a text test or a removed/disabled model to enable image input", () => {
    expect(() => applyImageInputVerification(setup(), { ...probe, capability: "text" })).toThrow();
    const config = setup();
    config.aiModels[0].enabled = false;
    expect(() => applyImageInputVerification(config, probe)).toThrow();
  });
});
