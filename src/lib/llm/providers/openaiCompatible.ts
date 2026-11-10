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

export async function callOpenAICompatible(
  request: LlmRequest,
): Promise<LlmResponse> {
  const baseUrl = request.baseUrl || getDefaultBaseUrl(request.provider);

  if (!baseUrl) {
    throw new Error("请先填写接口地址。");
  }

  if (request.images?.length && !supportsImage(request.provider)) {
    throw new Error("当前模型暂时不支持图片分析，请换成支持图片的模型。");
  }

  const endpoint = buildOpenAiCompatibleEndpoint(baseUrl, request.customEndpointPath);
  if (request.signal?.aborted) throw new Error("请求已取消。");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), request.timeoutMs ?? 45000);
  const abortFromCaller = () => controller.abort();
  request.signal?.addEventListener("abort", abortFromCaller, { once: true });

  const debug = createDebugInfo(request, baseUrl, endpoint);
  logRequest(debug, request.apiKey);

  let response: Response;
  try {
    const authHeaders: Record<string, string> = {};

    if (request.authMode === "header" && request.authHeaderName && request.apiKey) {
      authHeaders[request.authHeaderName] = request.apiKey;
    } else if (request.authMode === "bearer" && request.apiKey) {
      authHeaders.Authorization = `Bearer ${request.apiKey}`;
    }

    response = await postJsonWithDesktopFallback(endpoint, {
      headers: {
        "Content-Type": "application/json",
        ...buildExtraHeaders(request.extraHeaders),
        ...authHeaders,
      },
      body: JSON.stringify({
        model: request.model,
        messages: buildMessages(request),
        ...buildChatGenerationParameters(request),
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
    throw toReadableError(error);
  }

  clearTimeout(timeoutId);
  request.signal?.removeEventListener("abort", abortFromCaller);

  if (!response.ok) {
    throw new Error(describeProviderHttpError(response.status, await response.text(), request));
  }

  const data = await response.json();
  if (data?.choices?.[0]?.finish_reason === "length") throw new Error(INCOMPLETE_AI_RESPONSE);
  const text = data?.choices?.[0]?.message?.content;

  if (typeof text !== "string" || !text.trim()) {
    throw new Error("模型没有返回可读取的内容。");
  }

  return {
    text,
    provider: request.provider,
    model: request.model,
    debug,
  };
}

export function buildChatGenerationParameters(request: Pick<LlmRequest, "model" | "temperature" | "maxTokens" | "requestType">) {
  // Modern OpenAI models use completion tokens (including reasoning). Do not send
  // sampling overrides to reasoning models, or silently retry on another model.
  const reasoningModel = /^(?:gpt-(?:[5-9]|\d{2,})(?:[.-]|$)|o[1-9](?:[.-]|$))/.test(request.model);
  if (reasoningModel) {
    return { max_completion_tokens: request.requestType === "test" ? Math.max(request.maxTokens ?? 1200, 1024) : request.maxTokens ?? 2400 };
  }
  return { temperature: request.temperature ?? 0.4, max_tokens: request.maxTokens ?? 1200 };
}

export function buildOpenAiCompatibleEndpoint(baseUrl: string, customEndpointPath?: string) {
  const allowedUrl = assertAllowedDesktopNetworkUrl(baseUrl, "AI 接口地址");
  const trimmed = allowedUrl.toString().replace(/\/$/, "");
  const endpointPath = customEndpointPath?.trim();

  if (endpointPath) {
    if (!endpointPath.startsWith("/") || endpointPath.startsWith("//") || endpointPath.includes("\\")) {
      throw new Error("自定义 endpoint 必须是以 / 开头的相对路径。");
    }

    return joinProviderEndpoint(allowedUrl, endpointPath);
  }

  if (trimmed.endsWith("/chat/completions")) {
    return trimmed;
  }

  if (trimmed.endsWith("/v1")) {
    return `${trimmed}/chat/completions`;
  }

  if (trimmed.match(/\/v\d+$/)) {
    return `${trimmed}/chat/completions`;
  }

  return `${trimmed}/v1/chat/completions`;
}

export function joinProviderEndpoint(baseUrl: URL, endpointPath: string) {
  if (!endpointPath.startsWith("/") || endpointPath.startsWith("//") || endpointPath.includes("\\")) {
    throw new Error("自定义 endpoint 必须是以 / 开头的相对路径。");
  }
  // Accept a base URL or a pasted full API URL without duplicating its version
  // or gateway prefix. Keep nonstandard gateway paths intact.
  const baseParts = baseUrl.pathname.replace(/\/(?:chat\/completions|responses|messages|models\/[^/]+:generateContent)\/?$/, "").split("/").filter(Boolean);
  const relative = new URL(endpointPath, baseUrl.origin);
  const endpointParts = relative.pathname.split("/").filter(Boolean);
  let overlap = Math.min(baseParts.length, endpointParts.length);
  while (overlap && baseParts.slice(-overlap).join("/") !== endpointParts.slice(0, overlap).join("/")) overlap -= 1;
  const resolved = new URL(baseUrl);
  resolved.pathname = "/" + [...baseParts, ...endpointParts.slice(overlap)].join("/");
  if (relative.search) resolved.search = relative.search;
  resolved.hash = "";
  return resolved.toString();
}

function buildExtraHeaders(headers: LlmRequest["extraHeaders"]) {
  const result: Record<string, string> = {};

  for (const header of headers ?? []) {
    const name = header.name.trim();

    if (!name || !header.value) continue;

    const normalizedName = name.toLowerCase();

    if (normalizedName === "authorization" || normalizedName === "content-type") {
      throw new Error("额外 Header 不能覆盖 Authorization 或 Content-Type。");
    }

    result[name] = header.value;
  }

  return result;
}

function supportsImage(provider: LlmRequest["provider"]) {
  return ["openai", "openai-compatible", "local"].includes(provider);
}

function toReadableError(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return new Error("AI 生成超时。请在设置中延长服务超时时间，或减少本次内容后重试。");
  }

  return new Error(describeProviderNetworkError(error));
}

function createDebugInfo(
  request: LlmRequest,
  baseUrl: string,
  endpoint: string,
): LlmDebugInfo {
  return {
    provider: request.provider,
    model: request.model,
    baseUrl,
    endpoint,
    requestType:
      request.requestType ??
      (request.images?.length ? "多模态" : "chat"),
    configSource: request.configSource,
    configName: request.configName,
  };
}

function logRequest(debug: LlmDebugInfo, apiKey?: string) {
  if (process.env.NODE_ENV !== "development") return;

  console.log("[llm]", {
    provider: debug.provider,
    model: debug.model,
    baseUrl: debug.baseUrl,
    endpoint: debug.endpoint,
    requestType: debug.requestType,
    configSource: debug.configSource,
    configName: debug.configName,
    apiKey: maskApiKey(apiKey),
  });
}

export const openAICompatibleAdapter: LlmAdapter = {
  chat: callOpenAICompatible,
  test: async (request) =>
    callOpenAICompatible({
      ...request,
      messages: [{ role: "user", content: "请回复：连接正常" }],
      maxTokens: 60,
      requestType: request.requestType ?? "test",
    }),
};

function buildMessages(request: LlmRequest) {
  const messages = request.systemPrompt
    ? [{ role: "system" as const, content: request.systemPrompt }, ...request.messages]
    : request.messages;

  if (!request.images?.length) {
    return messages;
  }

  return messages.map((message, index) => {
    if (message.role !== "user" || index !== messages.length - 1) {
      return message;
    }

    return {
      role: message.role,
      content: [
        { type: "text", text: message.content },
        ...request.images!.map((image) => ({
          type: "image_url",
          image_url: {
            url: `data:${image.mimeType};base64,${image.data}`,
          },
        })),
      ],
    };
  });
}
