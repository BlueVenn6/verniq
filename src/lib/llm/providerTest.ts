import { buildProviderTestRequest } from "@/src/lib/llm/config";
import { routeLlmChat, routeLlmTest } from "@/src/lib/llm/router";
import { buildGeminiGenerateContentEndpoint } from "@/src/lib/llm/providers/gemini";
import { buildOpenAiCompatibleEndpoint } from "@/src/lib/llm/providers/openaiCompatible";
import { getDefaultBaseUrl, type LlmRequest } from "@/src/lib/llm/types";
import type { AiConnectionTestResult, AiModelConfig, AiProviderConfig } from "@/src/lib/types";

export const VERNIQ_TEST_IMAGE_BASE64 =
  "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";

export async function testAiProviderConnection(
  provider: AiProviderConfig,
  models: AiModelConfig[],
  modelId?: string,
  capability: "text" | "image" = "text",
): Promise<AiConnectionTestResult> {
  const runtime = await buildProviderTestRequest(provider, models, modelId, capability);

  if (!runtime.ok) {
    return {
      success: false,
      message: runtime.error,
      providerId: provider.id,
    };
  }

  const checkedAt = new Date().toISOString();
  const requestUrl = getProviderRequestUrl(runtime.request);

  try {
    if (capability === "image") {
      const result = await routeLlmChat({
        ...runtime.request,
        messages: [
          {
            role: "user",
            content:
              "Read the test image and reply with only the exact visible text. Do not add punctuation.",
          },
        ],
        images: [{ mimeType: "image/png", data: VERNIQ_TEST_IMAGE_BASE64 }],
      });

      if (!result.text.toUpperCase().includes("VERNIQ")) {
        throw new Error("图片输入返回为空或未识别测试文本。");
      }
    } else {
      await routeLlmTest(runtime.request);
    }
    const credentialMessage =
      runtime.provider.authMode === "none" || !runtime.request.apiKey
        ? "无需密钥"
        : "密钥有效";

    return {
      success: true,
      message: [
        capability === "image"
          ? `服务可访问，${credentialMessage}，图片能力可用。已验证：${runtime.modelLabel}。`
          : `连接测试通过：${runtime.modelLabel}。已收到测试回复；文章提取和综合创作需在对应页面执行。`,
        runtime.request.credentialWarning,
      ].filter(Boolean).join(" "),
      providerId: provider.id,
      modelId: runtime.model.id,
      capability,
      protocol: provider.adapterProtocol,
      requestUrl,
      checkedAt,
    };
  } catch (error) {
    return {
      success: false,
      message: formatConnectionTestError(error, runtime.request.model),
      providerId: provider.id,
      modelId: runtime.ok ? runtime.model.id : modelId,
      capability,
      protocol: provider.adapterProtocol,
      requestUrl,
      checkedAt,
    };
  }
}

export function getProviderRequestUrl(request: LlmRequest) {
  const baseUrl = request.baseUrl || getDefaultBaseUrl(request.provider);

  if (request.provider === "gemini") {
    return buildGeminiGenerateContentEndpoint(
      baseUrl,
      request.model,
      request.customEndpointPath,
    );
  }

  if (request.provider === "claude") {
    return buildOpenAiCompatibleEndpoint(baseUrl, request.customEndpointPath || "/messages");
  }

  return buildOpenAiCompatibleEndpoint(baseUrl, request.customEndpointPath);
}

function formatConnectionTestError(error: unknown, modelId: string) {
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  const message = rawMessage.toLowerCase();

  if (message.includes("abort") || message.includes("timeout") || message.includes("超时")) {
    return "请求超时，请检查服务地址是否可达。";
  }

  if (
    message.includes("401") ||
    message.includes("403") ||
    message.includes("unauthorized") ||
    message.includes("forbidden") ||
    message.includes("invalid api key") ||
    message.includes("incorrect api key") ||
    message.includes("api key")
  ) {
    return "服务可访问，但 API 密钥无效或没有权限。";
  }

  if (
    message.includes("404") ||
    message.includes("model_not_found") ||
    message.includes("model not found") ||
    message.includes("does not exist") ||
    message.includes("not found")
  ) {
    return `服务可访问，但未找到模型 ${modelId}。`;
  }

  if (
    message.includes("invalid content type") ||
    message.includes("content must be a string") ||
    message.includes("image_url is not allowed")
  ) {
    return "服务可访问，但当前 endpoint 不支持多模态图片消息。";
  }

  if (
    message.includes("image") ||
    message.includes("vision") ||
    message.includes("multimodal") ||
    message.includes("unsupported content") ||
    message.includes("unsupported image") ||
    message.includes("图片") ||
    message.includes("多模态")
  ) {
    return "服务可访问，但当前模型或接口不支持图片输入。";
  }

  if (
    message.includes("choices") ||
    message.includes("json") ||
    message.includes("format") ||
    message.includes("可读取")
  ) {
    return "服务可访问，但返回格式不符合当前协议。";
  }

  if (
    message.includes("fetch") ||
    message.includes("network") ||
    message.includes("failed to fetch") ||
    message.includes("接口地址不可达") ||
    message.includes("无法访问")
  ) {
    return "服务地址无法访问，请检查服务地址、网络或本地服务状态。";
  }

  return "验证连接失败，请检查服务地址、API 密钥和模型 ID。";
}
