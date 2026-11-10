import { assertAllowedDesktopNetworkUrl } from "@/src/lib/security/url";
import { MAX_IMAGE_RESPONSE_BYTES, postJsonWithDesktopFallback } from "@/src/lib/llm/desktopTransport";

export type OpenAiImagesOperation = "generation" | "edit";
export type OpenAiImagesOutputFormat = "png" | "jpeg" | "webp";
export type OpenAiImagesQuality = "auto" | "low" | "medium" | "high";
export type OpenAiImagesModeration = "auto" | "low";
export type OpenAiImagesBackground = "auto" | "opaque";

export type OpenAiImagesResult = {
  kind: "base64" | "url";
  value: string;
  revisedPrompt?: string;
};

export type OpenAiImagesResponse = {
  images: OpenAiImagesResult[];
  endpoint: string;
  modelId: string;
};

export const OPENAI_IMAGES_NATIVE_BASE_URL = "https://api.openai.com/v1";
export const DRAGTOKEN_IMAGES_BASE_URL = "https://draw.dragtokens.com/v1";
export const DRAGTOKEN_IMAGES_MODEL_ID = "gpt-image-2";

export const OPENAI_IMAGE_SIZE_OPTIONS = [
  "1254x1254",
  "1448x1086",
  "1086x1448",
  "1536x1024",
  "1024x1536",
  "1672x941",
  "941x1672",
  "821x1915",
  "1915x821",
] as const;

export type OpenAiImageSize = (typeof OPENAI_IMAGE_SIZE_OPTIONS)[number];

export type GenerateOpenAiImageInput = {
  baseUrl: string;
  apiKey: string;
  modelId: string;
  prompt: string;
  size?: OpenAiImageSize | string;
  outputFormat?: OpenAiImagesOutputFormat;
  quality?: OpenAiImagesQuality;
  outputCompression?: number;
  moderation?: OpenAiImagesModeration;
  n?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
};

export type EditOpenAiImageFile = {
  blob: Blob;
  fileName: string;
};

export type EditOpenAiImageInput = Omit<GenerateOpenAiImageInput, "moderation" | "fetchImpl"> & {
  images: EditOpenAiImageFile[];
  background?: OpenAiImagesBackground;
  fetchImpl?: typeof fetch;
};

export function buildOpenAiImagesEndpoint(
  baseUrl: string,
  operation: OpenAiImagesOperation,
) {
  const allowedUrl = assertAllowedDesktopNetworkUrl(baseUrl, "图片 API 地址");
  const trimmed = allowedUrl.toString().replace(/\/$/, "");
  const endpointPath =
    operation === "generation" ? "/images/generations" : "/images/edits";

  if (trimmed.endsWith(endpointPath)) return trimmed;

  const otherEndpoint =
    operation === "generation" ? "/images/edits" : "/images/generations";

  if (trimmed.endsWith(otherEndpoint)) {
    return `${trimmed.slice(0, -otherEndpoint.length)}${endpointPath}`;
  }

  if (trimmed.endsWith("/v1") || trimmed.match(/\/v\d+$/)) {
    return `${trimmed}${endpointPath}`;
  }

  return `${trimmed}/v1${endpointPath}`;
}

export function buildOpenAiImagesGenerationBody({
  modelId,
  prompt,
  size = "1536x1024",
  outputFormat = "png",
  quality = "auto",
  outputCompression,
  moderation = "auto",
  n = 1,
}: Pick<
  GenerateOpenAiImageInput,
  | "modelId"
  | "prompt"
  | "size"
  | "outputFormat"
  | "quality"
  | "outputCompression"
  | "moderation"
  | "n"
>) {
  const body: Record<string, string | number> = {
    model: normalizeModelId(modelId),
    prompt: prompt.trim(),
    n,
    size,
    output_format: outputFormat,
    quality,
    moderation,
  };

  if (typeof outputCompression === "number") {
    body.output_compression = Math.max(0, Math.min(100, outputCompression));
  }

  return body;
}

export function buildOpenAiImagesEditFormData({
  modelId,
  prompt,
  images,
  size = "1536x1024",
  outputFormat = "png",
  quality = "auto",
  outputCompression,
  background = "auto",
  n = 1,
}: Pick<
  EditOpenAiImageInput,
  | "modelId"
  | "prompt"
  | "images"
  | "size"
  | "outputFormat"
  | "quality"
  | "outputCompression"
  | "background"
  | "n"
>) {
  const formData = new FormData();

  formData.set("model", normalizeModelId(modelId));
  formData.set("prompt", prompt.trim());
  formData.set("n", String(n));
  formData.set("size", size);
  formData.set("output_format", outputFormat);
  formData.set("quality", quality);
  formData.set("background", background);

  if (typeof outputCompression === "number") {
    formData.set("output_compression", String(Math.max(0, Math.min(100, outputCompression))));
  }

  for (const image of images) {
    formData.append("image", image.blob, image.fileName);
  }

  return formData;
}

export async function generateOpenAiImage(
  input: GenerateOpenAiImageInput,
): Promise<OpenAiImagesResponse> {
  const endpoint = buildOpenAiImagesEndpoint(input.baseUrl, "generation");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), input.timeoutMs ?? 120000);
  const abortFromCaller = () => controller.abort();
  input.signal?.addEventListener("abort", abortFromCaller, { once: true });

  try {
    const response = input.fetchImpl
      ? await input.fetchImpl(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${input.apiKey}`,
          },
          body: JSON.stringify(buildOpenAiImagesGenerationBody(input)),
          signal: controller.signal,
        })
      : await postJsonWithDesktopFallback(endpoint, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${input.apiKey}`,
          },
          body: JSON.stringify(buildOpenAiImagesGenerationBody(input)),
          signal: controller.signal,
          timeoutMs: input.timeoutMs ?? 120000,
          maxResponseBytes: MAX_IMAGE_RESPONSE_BYTES,
        });

    if (!response.ok) {
      throw new Error(await readImageApiError(response, "图片生成接口返回异常"));
    }

    return {
      images: parseOpenAiImagesResponse(await response.json()),
      endpoint,
      modelId: normalizeModelId(input.modelId),
    };
  } catch (error) {
    throw toReadableImageError(error, "图片生成");
  } finally {
    clearTimeout(timeoutId);
    input.signal?.removeEventListener("abort", abortFromCaller);
  }
}

export async function editOpenAiImage(
  input: EditOpenAiImageInput,
): Promise<OpenAiImagesResponse> {
  const endpoint = buildOpenAiImagesEndpoint(input.baseUrl, "edit");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), input.timeoutMs ?? 120000);
  const abortFromCaller = () => controller.abort();
  input.signal?.addEventListener("abort", abortFromCaller, { once: true });

  try {
    const fetcher = input.fetchImpl ?? fetch;
    const response = await fetcher(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
      },
      body: buildOpenAiImagesEditFormData(input),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(await readImageApiError(response, "图片编辑接口返回异常"));
    }

    return {
      images: parseOpenAiImagesResponse(await response.json()),
      endpoint,
      modelId: normalizeModelId(input.modelId),
    };
  } catch (error) {
    throw toReadableImageError(error, "图片编辑");
  } finally {
    clearTimeout(timeoutId);
    input.signal?.removeEventListener("abort", abortFromCaller);
  }
}

function normalizeModelId(modelId: string) {
  const value = modelId.trim();

  if (!value) {
    throw new Error("请先填写图片模型 ID。");
  }

  return value;
}

function parseOpenAiImagesResponse(data: unknown): OpenAiImagesResult[] {
  const items = Array.isArray((data as { data?: unknown[] })?.data)
    ? (data as { data: unknown[] }).data
    : [];

  const images: OpenAiImagesResult[] = [];

  for (const item of items) {
    const value = item as {
      b64_json?: unknown;
      url?: unknown;
      revised_prompt?: unknown;
    };
    const revisedPrompt =
      typeof value.revised_prompt === "string" ? value.revised_prompt : undefined;

    if (typeof value.b64_json === "string" && value.b64_json.trim()) {
      images.push({ kind: "base64", value: value.b64_json, revisedPrompt });
      continue;
    }

    if (typeof value.url === "string" && value.url.trim()) {
      images.push({ kind: "url", value: value.url, revisedPrompt });
    }
  }

  if (!images.length) {
    throw new Error("图片接口没有返回可读取的图片。");
  }

  return images;
}

async function readImageApiError(response: Response, fallback: string) {
  const text = await response.text();

  if (!text) return `${fallback}：${response.status}`;

  try {
    const data = JSON.parse(text) as { error?: { message?: string }; message?: string };
    return data.error?.message || data.message || `${fallback}：${response.status}`;
  } catch {
    return text.length > 300 ? `${text.slice(0, 300)}…` : text;
  }
}

function toReadableImageError(error: unknown, operationName: string) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return new Error(`${operationName}请求超时，请检查服务地址或网络。`);
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error(`${operationName}请求失败，请检查服务地址、API 密钥和模型 ID。`);
}
