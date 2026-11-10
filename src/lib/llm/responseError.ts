import type { LlmRequest } from "./types";

export function describeProviderNetworkError(error: unknown) {
  if (String(error).includes("AI 服务响应过大，已停止读取。")) {
    return "AI 服务响应过大，已停止读取。请减少输出或检查服务地址后重试。";
  }
  if (error instanceof Error && /^(?:Failed to fetch|fetch failed|Load failed|NetworkError when attempting to fetch resource\.?)$/i.test(error.message)) {
    return "无法连接 AI 服务。请检查网络、服务地址或中转服务状态后重试。";
  }
  return error instanceof Error ? `接口地址不可达：${error.message}` : "接口地址不可达。";
}

export function describeProviderHttpError(status: number, body: string, request: LlmRequest) {
  let detail = body.trim();
  try {
    const data = JSON.parse(detail);
    detail = typeof data?.error?.message === "string" ? data.error.message : typeof data?.message === "string" ? data.message : "";
  } catch {
    if (detail.startsWith("<")) detail = "";
  }
  for (const secret of [request.apiKey, ...(request.extraHeaders ?? []).map(header => header.value)]) {
    if (secret) detail = detail.split(secret).join("[redacted]");
  }
  detail = detail.replace(/\s+/g, " ").slice(0, 320);
  const guidance = status === 401 || status === 403 ? "请检查 API 密钥、权限和服务地址。"
    : status === 429 ? "请求受限或额度不足，请检查服务额度后重试。"
    : status >= 500 ? "AI 服务暂时不可用，请稍后重试。" : "请检查模型 ID 和请求配置。";
  return `AI 服务返回 HTTP ${status}。${guidance}${detail ? ` ${detail}` : ""}`;
}

export const INCOMPLETE_AI_RESPONSE = "AI 回复达到输出长度上限，未覆盖当前内容。请减少材料，或在设置中提高输出长度后重试。";
