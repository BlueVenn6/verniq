import { callOpenAICompatible } from "@/src/lib/llm/providers/openaiCompatible";
import { getDefaultBaseUrl, type LlmAdapter } from "@/src/lib/llm/types";

export const openAIAdapter: LlmAdapter = {
  chat: (request) =>
    callOpenAICompatible({
      ...request,
      baseUrl: request.baseUrl || getDefaultBaseUrl("openai"),
      requestType: request.requestType ?? "chat",
    }),
  test: (request) =>
    callOpenAICompatible({
      ...request,
      baseUrl: request.baseUrl || getDefaultBaseUrl("openai"),
      messages: [{ role: "user", content: "请回复：连接正常" }],
      maxTokens: 60,
      requestType: request.requestType ?? "test",
    }),
};
