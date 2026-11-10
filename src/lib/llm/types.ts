export type LlmProvider =
  | "gemini"
  | "openai"
  | "claude"
  | "minimax"
  | "kimi"
  | "qwen"
  | "openai-compatible"
  | "local";

export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LlmRequest = {
  provider: LlmProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  customEndpointPath?: string;
  authMode?: "bearer" | "header" | "google_api_key" | "anthropic_api_key" | "none";
  authHeaderName?: string;
  extraHeaders?: Array<{
    name: string;
    value: string;
  }>;
  timeoutMs?: number;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  messages: LlmMessage[];
  mode?: string;
  tool?: string;
  area?: string;
  images?: Array<{
    mimeType: string;
    data: string;
  }>;
  signal?: AbortSignal;
  requestType?: "chat" | "test" | "reference" | "image-test" | "image-text-extraction";
  configSource?: "current-form" | "saved-config" | "active-config";
  configName?: string;
  credentialWarning?: string;
};

export type LlmDebugInfo = {
  provider: LlmProvider;
  model: string;
  baseUrl?: string;
  endpoint?: string;
  requestType?: string;
  configSource?: string;
  configName?: string;
};

export type LlmResponse = {
  text: string;
  provider: LlmProvider;
  model: string;
  debug?: LlmDebugInfo;
};

export type LlmAdapter = {
  chat: (request: LlmRequest) => Promise<LlmResponse>;
  test: (request: LlmRequest) => Promise<LlmResponse>;
};

export function maskApiKey(apiKey?: string) {
  if (!apiKey) return "";
  if (apiKey.length <= 8) return "***";
  return `${apiKey.slice(0, 3)}***${apiKey.slice(-3)}`;
}

export function getDefaultBaseUrl(provider: LlmProvider) {
  const defaults: Record<LlmProvider, string> = {
    gemini: "https://generativelanguage.googleapis.com/v1beta",
    openai: "https://api.openai.com/v1",
    claude: "https://api.anthropic.com/v1",
    minimax: "https://api.minimax.chat/v1",
    kimi: "https://api.moonshot.cn/v1",
    qwen: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "openai-compatible": "",
    local: "http://localhost:1234/v1",
  };

  return defaults[provider];
}

export function getDefaultModel(provider: LlmProvider) {
  const defaults: Record<LlmProvider, string> = {
    gemini: "gemini-3.1-pro",
    openai: "gpt-5.6-terra",
    claude: "claude-sonnet-5-5",
    minimax: "MiniMax-M2.7",
    kimi: "kimi-k2.6",
    qwen: "qwen-max-latest",
    "openai-compatible": "gpt-5.6-sol",
    local: "qwen3:8b",
  };

  return defaults[provider];
}
