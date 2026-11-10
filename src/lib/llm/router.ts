import { anthropicAdapter } from "@/src/lib/llm/providers/anthropic";
import { geminiAdapter } from "@/src/lib/llm/providers/gemini";
import { openAIAdapter } from "@/src/lib/llm/providers/openai";
import { openAICompatibleAdapter } from "@/src/lib/llm/providers/openaiCompatible";
import type { LlmAdapter, LlmProvider, LlmRequest } from "@/src/lib/llm/types";

const adapters: Record<LlmProvider, LlmAdapter> = {
  gemini: geminiAdapter,
  openai: openAIAdapter,
  claude: anthropicAdapter,
  minimax: openAICompatibleAdapter,
  kimi: openAICompatibleAdapter,
  qwen: openAICompatibleAdapter,
  "openai-compatible": openAICompatibleAdapter,
  local: openAICompatibleAdapter,
};

export function resolveLlmAdapter(provider: LlmProvider) {
  return adapters[provider];
}

export async function routeLlmChat(request: LlmRequest) {
  return resolveLlmAdapter(request.provider).chat(request);
}

export async function routeLlmTest(request: LlmRequest) {
  return resolveLlmAdapter(request.provider).test(request);
}
