import { getEffectiveProviderBaseUrl, resolveProviderCredential } from "@/src/lib/llm/config";
import { assertAllowedDesktopNetworkUrl } from "@/src/lib/security/url";
import { postJsonWithDesktopFallback } from "@/src/lib/llm/desktopTransport";
import type { AiProviderConfig } from "@/src/lib/types";
import { buildOpenAiCompatibleEndpoint } from "@/src/lib/llm/providers/openaiCompatible";
import { buildGeminiGenerateContentEndpoint } from "@/src/lib/llm/providers/gemini";

export type ListedModel = { id: string; name: string };

export function parseModelCatalog(data: unknown): { models: ListedModel[]; partial: boolean } {
  const record = data as { data?: unknown[]; models?: unknown[]; has_more?: boolean; nextPageToken?: string };
  const entries = record?.data ?? record?.models;
  if (!Array.isArray(entries)) throw new Error("The provider did not return a model list. Enter an exact model ID manually.");
  const models = entries.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const entry = value as { id?: unknown; name?: unknown; displayName?: unknown };
    const raw = typeof entry.id === "string" ? entry.id : typeof entry.name === "string" ? entry.name : "";
    const id = raw.replace(/^models\//, "");
    return id ? [{ id, name: typeof entry.displayName === "string" ? entry.displayName : id }] : [];
  });
  return { models: [...new Map(models.map((model) => [model.id, model])).values()], partial: Boolean(record.has_more || record.nextPageToken) };
}

export function buildModelCatalogEndpoint(provider: AiProviderConfig) {
  const baseUrl = getEffectiveProviderBaseUrl(provider);
  const base = assertAllowedDesktopNetworkUrl(provider.adapterProtocol === "gemini_native"
    ? buildGeminiGenerateContentEndpoint(baseUrl, "catalog-probe", provider.customEndpointPath)
    : provider.adapterProtocol === "openai_images" ? baseUrl
    : buildOpenAiCompatibleEndpoint(baseUrl, provider.customEndpointPath || (provider.adapterProtocol === "anthropic_messages" ? "/messages" : undefined)), "AI 接口地址");
  base.pathname = base.pathname.replace(/\/(?:chat\/completions|responses|messages|models\/[^/]+:generateContent)\/?$/, "").replace(/\/$/, "") + "/models";
  base.search = "";
  base.hash = "";
  return base.toString();
}

export async function listProviderModels(provider: AiProviderConfig) {
  const endpoint = buildModelCatalogEndpoint(provider);
  const headers: Record<string, string> = { Accept: "application/json" };
  for (const header of provider.extraHeaders ?? []) if (header.enabled !== false && header.name.trim()) headers[header.name.trim()] = header.value;
  const secret = await resolveProviderCredential(provider);
  if (secret.error) throw new Error(secret.error);
  const apiKey = secret.key?.trim();
  if (provider.authMode !== "none" && !apiKey) throw new Error("Save the API key first / 请先保存 API 密钥。");
  if (apiKey && provider.authMode !== "none") {
    if (provider.authMode === "header") headers[provider.authHeaderName || "x-api-key"] = apiKey;
    else if (provider.authMode === "bearer") headers.Authorization = `Bearer ${apiKey}`;
    else if (provider.adapterProtocol === "gemini_native") headers["x-goog-api-key"] = apiKey;
    else if (provider.adapterProtocol === "anthropic_messages") {
      headers["x-api-key"] = apiKey;
      headers["anthropic-version"] = "2023-06-01";
    } else headers.Authorization = `Bearer ${apiKey}`;
  }
  if (provider.adapterProtocol === "anthropic_messages") headers["anthropic-version"] = "2023-06-01";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), provider.timeoutMs ?? 30000);
  try {
    const response = await postJsonWithDesktopFallback(endpoint, { method: "GET", headers, signal: controller.signal, timeoutMs: provider.timeoutMs ?? 30000 });
    if (!response.ok) throw new Error(`Model listing failed (HTTP ${response.status}). You can still enter the model ID manually / 可手动填写模型 ID。`);
    return { ...parseModelCatalog(await response.json()), checkedAt: new Date().toISOString() };
  } finally { clearTimeout(timeout); }
}
