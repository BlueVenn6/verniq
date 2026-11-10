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
import { joinProviderEndpoint } from "@/src/lib/llm/providers/openaiCompatible";

export const geminiAdapter: LlmAdapter = {
  chat: callGemini,
  test: async (request) =>
    callGemini({
      ...request,
      messages: [{ role: "user", content: "请回复：连接正常" }],
      maxTokens: 60,
    }),
};

async function callGemini(request: LlmRequest): Promise<LlmResponse> {
  if (!request.apiKey) {
    throw new Error("请先填写 Gemini API 密钥。");
  }

  const baseUrl = request.baseUrl || getDefaultBaseUrl("gemini");
  const url = buildGeminiGenerateContentEndpoint(
    baseUrl,
    request.model,
    request.customEndpointPath,
  );
  const debug: LlmDebugInfo = {
    provider: request.provider,
    model: request.model,
    baseUrl,
    endpoint: url,
    requestType: request.requestType ?? (request.images?.length ? "多模态" : "chat"),
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
  const prompt = [
    request.systemPrompt ? `要求：${request.systemPrompt}` : "",
    ...request.messages.map((message) => `${message.role}：${message.content}`),
  ]
    .filter(Boolean)
    .join("\n\n");

  const parts: Array<Record<string, unknown>> = [{ text: prompt }];

  for (const image of request.images ?? []) {
    parts.push({
      inlineData: {
        mimeType: image.mimeType,
        data: image.data,
      },
    });
  }

  let response: Response;
  if (request.signal?.aborted) throw new Error("请求已取消。");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), request.timeoutMs ?? 45000);
  const abortFromCaller = () => controller.abort();
  request.signal?.addEventListener("abort", abortFromCaller, { once: true });

  try {
    response = await postJsonWithDesktopFallback(url, {
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": request.apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: request.temperature ?? 0.4,
          maxOutputTokens: request.maxTokens ?? 1200,
        },
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
  if (data?.candidates?.[0]?.finishReason === "MAX_TOKENS") throw new Error(INCOMPLETE_AI_RESPONSE);
  const partsReturned = data?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(partsReturned)
    ? partsReturned.filter((part: { text?: unknown }) => typeof part?.text === "string").map((part: { text: string }) => part.text).join("") : "";

  if (!text) {
    throw new Error("Gemini 没有返回可读取的内容。");
  }

  return {
    text,
    provider: request.provider,
    model: request.model,
    debug,
  };
}

export function buildGeminiGenerateContentEndpoint(
  baseUrl: string,
  model: string,
  endpointTemplate = "/models/{modelId}:generateContent",
) {
  const allowedUrl = assertAllowedDesktopNetworkUrl(baseUrl, "AI 接口地址");
  const path = endpointTemplate.trim() || "/models/{modelId}:generateContent";

  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    throw new Error("Gemini endpoint 必须是以 / 开头的相对路径。");
  }

  const resolvedPath = path.replace("{modelId}", encodeURIComponent(model));
  return joinProviderEndpoint(allowedUrl, resolvedPath);
}
