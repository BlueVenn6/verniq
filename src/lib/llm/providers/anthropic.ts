import { describeProviderHttpError, describeProviderNetworkError, INCOMPLETE_AI_RESPONSE } from "@/src/lib/llm/responseError";
import {
  getDefaultBaseUrl,
  maskApiKey,
  type LlmAdapter,
  type LlmDebugInfo,
  type LlmRequest,
  type LlmResponse,
} from "@/src/lib/llm/types";
import { postJsonWithDesktopFallback } from "@/src/lib/llm/desktopTransport";
import { assertAllowedDesktopNetworkUrl } from "@/src/lib/security/url";
import { buildOpenAiCompatibleEndpoint } from "@/src/lib/llm/providers/openaiCompatible";

export const anthropicAdapter: LlmAdapter = {
  chat: callAnthropic,
  test: async (request) =>
    callAnthropic({
      ...request,
      messages: [{ role: "user", content: "请回复：连接正常" }],
      maxTokens: 60,
    }),
};

async function callAnthropic(request: LlmRequest): Promise<LlmResponse> {
  if (request.authMode !== "none" && !request.apiKey) {
    throw new Error("请先填写 Claude API 密钥。");
  }

  const baseUrl = request.baseUrl || getDefaultBaseUrl("claude");
  assertAllowedDesktopNetworkUrl(baseUrl, "AI 接口地址");
  const endpoint = buildOpenAiCompatibleEndpoint(baseUrl, request.customEndpointPath || "/messages");
  const headers: Record<string, string> = { "Content-Type": "application/json", "anthropic-version": "2023-06-01" };
  for (const header of request.extraHeaders ?? []) {
    if (!["authorization", "x-api-key", "content-type", "anthropic-version"].includes(header.name.toLowerCase())) headers[header.name] = header.value;
  }
  if (request.apiKey && request.authMode !== "none") {
    if (request.authMode === "bearer") headers.Authorization = `Bearer ${request.apiKey}`;
    else if (request.authMode === "header" && request.authHeaderName) headers[request.authHeaderName] = request.apiKey;
    else headers["x-api-key"] = request.apiKey;
  }
  const debug: LlmDebugInfo = {
    provider: request.provider,
    model: request.model,
    baseUrl,
    endpoint,
    requestType: request.requestType ?? "chat",
    configSource: request.configSource,
    configName: request.configName,
  };
  if (process.env.NODE_ENV === "development") {
    console.log("[llm]", {
      provider: debug.provider,
      model: debug.model,
      baseUrl: debug.baseUrl,
      endpoint: debug.endpoint,
      requestType: debug.requestType,
      configSource: debug.configSource,
      configName: debug.configName,
      apiKey: maskApiKey(request.apiKey),
    });
  }
  let response: Response;
  if (request.signal?.aborted) throw new Error("请求已取消。");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), request.timeoutMs ?? 45000);
  const abortFromCaller = () => controller.abort();
  request.signal?.addEventListener("abort", abortFromCaller, { once: true });

  try {
    response = await postJsonWithDesktopFallback(endpoint, {
      headers,
      body: JSON.stringify({
        model: request.model,
        system: request.systemPrompt,
        max_tokens: request.maxTokens ?? 1200,
        ...(/^claude-(?:opus|sonnet|haiku|mythos|fable)-5/.test(request.model)
          ? {} : { temperature: request.temperature ?? 0.4 }),
        messages: request.messages
          .filter((message) => message.role !== "system")
          .map((message) => ({
            role: message.role === "assistant" ? "assistant" : "user",
            content: message.content,
          })),
      }),
      signal: controller.signal,
      timeoutMs: request.timeoutMs ?? 45000,
    });
  } catch (error) {
    clearTimeout(timeoutId);
    request.signal?.removeEventListener("abort", abortFromCaller);
    if (request.signal?.aborted) {
      throw new Error("请求已取消。");
    }
    if (error instanceof Error && error.name === "AbortError") throw new Error("AI 生成超时。请在设置中延长服务超时时间，或减少本次内容后重试。");
    throw new Error(describeProviderNetworkError(error));
  }

  clearTimeout(timeoutId);
  request.signal?.removeEventListener("abort", abortFromCaller);

  if (!response.ok) {
    throw new Error(describeProviderHttpError(response.status, await response.text(), request));
  }

  const data = await response.json();
  if (data?.stop_reason === "max_tokens") throw new Error(INCOMPLETE_AI_RESPONSE);
  const text = Array.isArray(data?.content)
    ? data.content.filter((part: { text?: unknown }) => typeof part?.text === "string").map((part: { text: string }) => part.text).join("") : "";

  if (!text) {
    throw new Error("Claude 没有返回可读取的内容。");
  }

  return {
    text,
    provider: request.provider,
    model: request.model,
    debug,
  };
}
