import { isTauriDesktop } from "@/src/lib/workspace/desktopStorage";

type DesktopHttpHeader = {
  name: string;
  value: string;
};

type DesktopHttpResponse = {
  status: number;
  body: string;
  headers: DesktopHttpHeader[];
};

type DesktopJsonRequest = {
  headers: Record<string, string>;
  body?: string;
  method?: "GET" | "POST";
  signal?: AbortSignal;
  timeoutMs?: number;
  maxResponseBytes?: number;
};

const DEFAULT_MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
export const MAX_IMAGE_RESPONSE_BYTES = 64 * 1024 * 1024;
const RESPONSE_TOO_LARGE = "AI 服务响应过大，已停止读取。请减少输出或检查服务地址后重试。";

export async function postJsonWithDesktopFallback(
  url: string,
  request: DesktopJsonRequest,
) {
  const maxResponseBytes = Math.min(MAX_IMAGE_RESPONSE_BYTES, Math.max(1, request.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES));
  if (request.signal?.aborted) {
    throw new DOMException("The operation was aborted.", "AbortError");
  }
  if (!isTauriDesktop()) {
    const response = await abortable(fetch(url, {
      method: request.method ?? "POST",
      headers: request.headers,
      body: request.body,
      signal: request.signal,
    }), request.signal);
    // Fetch resolves at headers. Keep the provider's timeout and cancellation
    // active until the complete body is available, including error responses.
    if (!response.body) return response;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    let complete = false;
    try {
      if (Number(response.headers.get("content-length")) > maxResponseBytes) throw new Error(RESPONSE_TOO_LARGE);
      while (true) {
        const { done, value } = await abortable(reader.read(), request.signal);
        if (done) { complete = true; break; }
        length += value.byteLength;
        if (length > maxResponseBytes) throw new Error(RESPONSE_TOO_LARGE);
        chunks.push(value);
      }
    } finally {
      // Also cancel after size/stream errors, without waiting for an upstream
      // cancel implementation that could itself stall.
      if (!complete) void reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
    const body = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
    return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
  }

  if (request.signal?.aborted) {
    throw new DOMException("The operation was aborted.", "AbortError");
  }

  const { invoke } = await import("@tauri-apps/api/core");
  const response = await abortable(invoke<DesktopHttpResponse>("desktop_http_post_json", {
    request: {
      url,
      method: request.method ?? "POST",
      headers: Object.entries(request.headers).map(([name, value]) => ({
        name,
        value,
      })),
      body: request.body,
      timeoutMs: request.timeoutMs,
      maxResponseBytes,
    },
  }), request.signal);

  return new Response([204, 205, 304].includes(response.status) ? null : response.body, {
    status: response.status,
    headers: response.headers.reduce<Record<string, string>>((result, header) => {
      result[header.name] = header.value;
      return result;
    }, {}),
  });
}

// Native HTTP has its own deadline. This also stops waiting in the UI when the
// caller cancels; it does not claim to cancel a request already sent by native HTTP.
function abortable<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return operation;
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new DOMException("The operation was aborted.", "AbortError"));
    const cleanup = () => signal.removeEventListener("abort", abort);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    operation.then(resolve, reject).finally(cleanup);
  });
}
