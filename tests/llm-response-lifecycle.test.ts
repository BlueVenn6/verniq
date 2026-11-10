import { afterEach, describe, expect, it, vi } from "vitest";
import { openAICompatibleAdapter } from "@/src/lib/llm/providers/openaiCompatible";
import { anthropicAdapter } from "@/src/lib/llm/providers/anthropic";
import { geminiAdapter } from "@/src/lib/llm/providers/gemini";
import type { LlmRequest } from "@/src/lib/llm/types";
import { postJsonWithDesktopFallback } from "@/src/lib/llm/desktopTransport";

vi.mock("@/src/lib/workspace/desktopStorage", () => ({ isTauriDesktop: () => false }));
afterEach(() => vi.unstubAllGlobals());
const adapters = [openAICompatibleAdapter, anthropicAdapter, geminiAdapter];
const request: LlmRequest = { provider: "openai-compatible", model: "exact-model", apiKey: "synthetic-key", baseUrl: "https://relay.example/v1", messages: [{ role: "user", content: "test" }], timeoutMs: 25 };

describe("AI response lifecycle", () => {
  it.each(adapters)("rejects an oversized streamed response and cancels the body without returning partial output", async adapter => {
    const cancel = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(8 * 1024 * 1024 + 1)); }, cancel,
    }))));
    await expect(adapter.chat({ ...request, timeoutMs: 1000 })).rejects.toThrow("AI 服务响应过大，已停止读取。");
    expect(cancel).toHaveBeenCalledTimes(1);
  });
  it("rejects oversized Content-Length before reading and cancels the stream", async () => {
    const cancel = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new ReadableStream({ cancel }), { headers: { "Content-Length": String(9 * 1024 * 1024) } })));
    await expect(postJsonWithDesktopFallback(request.baseUrl!, { headers: {} })).rejects.toThrow("响应过大");
    expect(cancel).toHaveBeenCalledTimes(1);
  });
  it("keeps a separate larger response allowance for generated image data", async () => {
    const data = "a".repeat(9 * 1024 * 1024);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ data: [{ b64_json: data }] })));
    const response = await postJsonWithDesktopFallback(request.baseUrl!, { headers: {}, maxResponseBytes: 64 * 1024 * 1024 });
    expect((await response.json()).data[0].b64_json.length).toBe(data.length);
  });
  it.each(adapters)("reports a failed browser connection as an actionable error without retrying or inventing a reply", async adapter => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(adapter.chat(request)).rejects.toThrow("无法连接 AI 服务。请检查网络、服务地址或中转服务状态后重试。");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each(adapters)("bounds the whole response, including a stalled body", async adapter => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new ReadableStream())));
    const result = await Promise.race([
      adapter.chat(request).then(() => "unexpected success", error => String(error)),
      new Promise<string>(resolve => setTimeout(() => resolve("body never timed out"), 180)),
    ]);
    expect(result).toMatch(/超时/);
  });
  it.each(adapters)("does not send an already cancelled request", async adapter => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("should not send"));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController(); controller.abort();
    await expect(adapter.chat({ ...request, signal: controller.signal })).rejects.toThrow("取消");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rejects a non-text completion instead of passing an object to the editor", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: { broken: true } } }] })));
    await expect(openAICompatibleAdapter.chat(request)).rejects.toThrow();
  });
  it.each(adapters)("bounds and redacts an upstream authentication error", async adapter => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: { message: "synthetic-key " + "sensitive ".repeat(500) } }, { status: 401 })));
    const error = await adapter.chat(request).catch(error => error as Error);
    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain("401");
    expect(message).not.toContain("synthetic-key");
    expect(message.length).toBeLessThan(450);
  });
  it.each([
    [openAICompatibleAdapter, { choices: [{ message: { content: "Incomplete article" }, finish_reason: "length" }] }],
    [anthropicAdapter, { content: [{ text: "Incomplete article" }], stop_reason: "max_tokens" }],
    [geminiAdapter, { candidates: [{ content: { parts: [{ text: "Incomplete article" }] }, finishReason: "MAX_TOKENS" }] }],
  ] as const)("does not present a truncated response as a complete article", async (adapter, payload) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(payload)));
    await expect(adapter.chat(request)).rejects.toThrow("输出长度上限");
  });
});
