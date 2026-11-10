export type DesktopNetworkUrlPurpose =
  | "AI 接口地址"
  | "图片 API 地址"
  | "内容链接"
  | "自动化 Webhook 地址"
  | "词典服务";

export type DesktopNetworkUrlValidation =
  | {
      ok: true;
      url: URL;
    }
  | {
      ok: false;
      message: string;
    };

const LOCAL_HTTP_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function validateDesktopNetworkUrl(
  value: string,
  purpose: DesktopNetworkUrlPurpose,
): DesktopNetworkUrlValidation {
  const trimmed = value.trim();

  if (!trimmed) {
    return {
      ok: false,
      message: `${purpose}不能为空。`,
    };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return {
      ok: false,
      message: `${purpose}不是有效 URL。`,
    };
  }

  if (url.protocol === "https:") {
    return { ok: true, url };
  }

  if (url.protocol === "http:" && isLocalHttpUrl(url)) {
    return { ok: true, url };
  }

  if (url.protocol === "http:") {
    return {
      ok: false,
      message: `${purpose}只允许 HTTPS；HTTP 只允许 localhost、127.0.0.1 或 ::1。`,
    };
  }

  return {
    ok: false,
    message: `${purpose}只支持 HTTPS，或本机回环地址的 HTTP。`,
  };
}

export function assertAllowedDesktopNetworkUrl(
  value: string,
  purpose: DesktopNetworkUrlPurpose,
) {
  const result = validateDesktopNetworkUrl(value, purpose);

  if (!result.ok) {
    throw new Error(result.message);
  }

  return result.url;
}

export function isLocalHttpUrl(url: URL) {
  return url.protocol === "http:" && LOCAL_HTTP_HOSTS.has(url.hostname);
}
