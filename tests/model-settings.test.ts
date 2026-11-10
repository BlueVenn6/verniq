import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_AI_MODELS, DEFAULT_AI_PROVIDERS, DEFAULT_AI_TASK_ROUTING, createCustomAiModelConfig, createCustomAiProviderConfig, normalizeAiConfiguration } from "@/src/lib/aiConfig";
import { CLAUDE_TEXT_MODEL_PRESETS, GPT56_TEXT_MODEL_PRESETS, OPENAI_TEXT_MODEL_PRESETS, getTextModelPresets } from "@/src/lib/aiModelPresets";
import { callOpenAICompatible } from "@/src/lib/llm/providers/openaiCompatible";
import { anthropicAdapter } from "@/src/lib/llm/providers/anthropic";
import { WorkspaceFileControls } from "@/src/components/layout/WorkspaceFileControls";
import { translateUiText } from "@/src/lib/copy/en";

const store = vi.hoisted(() => ({ desktop: true, message: "" }));
vi.mock("@/src/lib/useWorkspaceStore", () => ({ useWorkspaceStore: () => ({
  isDesktopStorageAvailable: store.desktop,
  workspaceFileMessage: store.message,
  workspaceFile: { storageMode: "browser-cache", backupCount: 0 },
  storageStatus: { isUsingFallbackStorage: true },
}) }));
afterEach(() => { vi.restoreAllMocks(); store.message = ""; store.desktop = true; });

describe("editable model configuration", () => {
  it("offers five current OpenAI and Claude shortcuts plus all three GPT 5.6 variants", () => {
    expect(OPENAI_TEXT_MODEL_PRESETS).toHaveLength(5);
    expect(CLAUDE_TEXT_MODEL_PRESETS).toHaveLength(5);
    expect(GPT56_TEXT_MODEL_PRESETS).toEqual(["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"]);
    expect(getTextModelPresets("openai_chat_completions", "custom")).toEqual(expect.arrayContaining([...OPENAI_TEXT_MODEL_PRESETS, ...GPT56_TEXT_MODEL_PRESETS, ...CLAUDE_TEXT_MODEL_PRESETS]));
    expect(DEFAULT_AI_MODELS.some((m) => /^gpt-5\.5/.test(m.modelId))).toBe(false);
  });

  it("removes historical built-in 5.5 defaults while preserving edited IDs, credentials and routes", () => {
    const provider = { ...DEFAULT_AI_PROVIDERS[0], enabled: true, credentialRef: "secret-reference-only" };
    const old = { ...DEFAULT_AI_MODELS[0], id: "model-openai-gpt-5-5-mini", modelId: "gpt-5.5-mini" };
    const manual = { ...DEFAULT_AI_MODELS[1], id: "model-openai-gpt-5-5", modelId: "MY-exact-alias/2026", displayName: "My model" };
    const result = normalizeAiConfiguration({ aiProviders: [provider], aiModels: [old, manual], aiTaskRouting: {
      ...DEFAULT_AI_TASK_ROUTING, analysis: { providerId: provider.id, modelId: old.id },
      languageAnalysis: { providerId: provider.id, modelId: manual.id },
    }});
    expect(result.aiModels.find((m) => m.id === old.id)).toBeUndefined();
    expect(result.aiProviders.find((p) => p.id === provider.id)?.credentialRef).toBe("secret-reference-only");
    expect(result.aiModels.find((m) => m.id === manual.id)?.modelId).toBe("MY-exact-alias/2026");
    expect(result.aiTaskRouting.languageAnalysis?.modelId).toBe(manual.id);
    expect(result.aiTaskRouting.analysis.modelId).toBe(DEFAULT_AI_MODELS[0].id);
    expect(normalizeAiConfiguration(result)).toEqual(result);
  });

  it("keeps Claude and other user models across old schema migration, without name matching deletion", () => {
    const provider = createCustomAiProviderConfig({ presetId: "anthropic-relay", id: "my-claude", baseUrl: "https://relay.example/v1" });
    provider.authMode = "bearer";
    const model = createCustomAiModelConfig(provider, { id: "custom-claude", modelId: "claude-sonnet-5-5", displayName: "My Claude" });
    const result = normalizeAiConfiguration({ aiProviders: [provider], aiModels: [model], resetLegacyDefaults: true,
      aiTaskRouting: { ...DEFAULT_AI_TASK_ROUTING, languageAnalysis: { providerId: provider.id, modelId: model.id } } });
    expect(result.aiModels.find((m) => m.id === model.id)?.modelId).toBe(model.modelId);
    expect(result.aiProviders.find((p) => p.id === provider.id)?.authMode).toBe("bearer");
    expect(result.aiTaskRouting.languageAnalysis?.modelId).toBe(model.id);
  });

  it.each(GPT56_TEXT_MODEL_PRESETS)("sends exact %s using completion token limits", async (model) => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "OK" } }] })));
    await callOpenAICompatible({ provider: "openai", model, baseUrl: "https://api.openai.com/v1", messages: [{ role: "user", content: "Ping" }], temperature: 0.3, maxTokens: 60, requestType: "test" });
    const body = JSON.parse(String(fetch.mock.calls[0][1]?.body));
    expect(body.model).toBe(model);
    expect(body.max_completion_tokens).toBe(1024);
    expect(body).not.toHaveProperty("max_tokens");
    expect(body).not.toHaveProperty("temperature");
  });

  it("honors a Claude relay endpoint, bearer authentication and exact model ID", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ content: [{ type: "text", text: "OK" }] })));
    await anthropicAdapter.chat({ provider: "claude", model: "claude-sonnet-5-5", apiKey: "test-only", authMode: "bearer", baseUrl: "https://relay.example/v1", customEndpointPath: "/v1/custom/messages", messages: [{ role: "user", content: "Ping" }] });
    expect(fetch.mock.calls[0][0]).toBe("https://relay.example/v1/custom/messages");
    const headers = new Headers(fetch.mock.calls[0][1]?.headers);
    expect(headers.get("Authorization")).toBe("Bearer test-only");
    expect(headers.get("x-api-key")).toBeNull();
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body)).model).toBe("claude-sonnet-5-5");
  });
});

describe("data controls visibility", () => {
  it("translates a connection result obtained before switching to English", () => {
    expect(translateUiText("服务可访问，密钥有效，文本能力可用。已验证：Acceptance relay · My-EXACT/Model-v3。"))
      .toBe("Text connection test passed (valid API key). Tested: Acceptance relay · My-EXACT/Model-v3.");
    expect(translateUiText("网页模式不提供系统级密钥存储。API 密钥只会保存在当前浏览器会话中。"))
      .not.toMatch(/[\u3400-\u9fff]/);
  });
  it("keeps the homepage free of normal file controls and cancelled action messages", () => {
    store.message = "已取消打开工作区。";
    expect(renderToStaticMarkup(createElement(WorkspaceFileControls))).toBe("");
  });
  it("keeps real recovery failures visible globally", () => {
    store.message = "保存失败：磁盘不可用。";
    const html = renderToStaticMarkup(createElement(WorkspaceFileControls));
    expect(html).toContain('role="alert"');
    expect(html).toContain("下载恢复副本");
    expect(html).toContain("重新打开数据文件");
  });
  it("retains the data file operations on the settings page", () => {
    const html = renderToStaticMarkup(createElement(WorkspaceFileControls, { manage: true }));
    for (const label of ["数据与备份", "打开学习数据文件", "选择数据文件保存", "从备份恢复", "导出全部数据备份"]) expect(html).toContain(label);
    expect(html).not.toContain("临时工作区");
  });
});
