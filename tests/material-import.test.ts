import { afterEach, describe, expect, it, vi } from "vitest";
import { detectMaterialLanguage } from "@/src/lib/materialLanguage";
import { describeDocumentReadError, ingestUploadedFile, ingestUrl } from "@/src/lib/ingest";
import { translateUiText } from "@/src/lib/copy/en";

describe("material import guidance", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
  it("explains an unreachable URL without leaking transport details or inventing content", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const result = await ingestUrl("https://example.com/article");
    expect(result.ingestStatus).not.toBe("ingested");
    expect(result.extractedText).toBe("");
    expect(result.ingestError).toContain("粘贴正文");
    expect(result.ingestError).not.toContain("Failed to fetch");
    expect(translateUiText(result.ingestError!)).not.toMatch(/[\u3400-\u9fff]/);
  });
  it("aborts a stalled URL body read and gives a translated timeout instead of hanging", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn(async (_url, options) => {
      signal = options.signal;
      return { ok: true, text: () => new Promise((_resolve, reject) => signal!.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true })) };
    }));
    const pending = ingestUrl("https://example.com/article");
    await vi.advanceTimersByTimeAsync(30001);
    const result = await pending;
    expect(signal?.aborted).toBe(true);
    expect(result.ingestError).toContain("超时");
    expect(result.extractedText).toBe("");
    expect(translateUiText(result.ingestError!)).not.toMatch(/[\u3400-\u9fff]/);
  });
  it("keeps valid URL text intact and explains HTTP failures without importing an empty document", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response("Readable web article.", { headers: { "Content-Type": "text/plain" } }))
      .mockResolvedValueOnce(new Response("private diagnostic", { status: 403 })));
    expect(await ingestUrl("https://example.com/article")).toMatchObject({ ingestStatus: "ingested", extractedText: "Readable web article." });
    const failed = await ingestUrl("https://example.com/denied");
    expect(failed.ingestError).toContain("HTTP 403");
    expect(failed.ingestError).toContain("粘贴正文");
    expect(failed.extractedText).toBe("");
    expect(translateUiText(failed.ingestError!)).not.toMatch(/[\u3400-\u9fff]/);
  });
  it("detects Chinese and English independently of the current study mode", () => {
    expect(detectMaterialLanguage("中文阅读材料。我们每天阅读并记录自己的思考。")).toBe("zh");
    expect(detectMaterialLanguage("We read English material and reflect on it every day.")).toBe("en");
    expect(detectMaterialLanguage("中文语法说明 English grammar explanation")).toBeNull();
    expect(detectMaterialLanguage("12345 a")).toBeNull();
    expect(detectMaterialLanguage("日本語を勉強しています。")).toBeNull();
  });
  it("reads the advertised .markdown extension and rejects a renamed unsupported binary", async () => {
    const markdown = await ingestUploadedFile(new File(["# Reading\n\nText to read."], "reading.markdown"));
    expect(markdown.ingestStatus).toBe("ingested");
    expect(markdown.sourceAssetType).toBe("markdown");
    expect(markdown.extractedText).toContain("Text to read.");
    const binary = await ingestUploadedFile(new File([new Uint8Array([0, 255, 0, 128])], "image.exe"));
    expect(binary.ingestStatus).toBe("failed");
    expect(binary.extractedText).toBe("");
    expect(binary.ingestError).toContain("暂不支持此文件格式");
  });
  it("makes historical parser failures readable and never displays an internal asset URL", () => {
    const error = describeDocumentReadError('Setting up fake worker failed: "Failed to fetch dynamically imported module: http://127.0.0.1:3110/_next/static/media/pdf.worker.min.mjs"');
    expect(error).toContain("PDF 读取组件未能加载");
    expect(error).not.toMatch(/http|worker/);
    expect(translateUiText(error)).not.toMatch(/[\u3400-\u9fff]/);
    const protectedError = new Error("Password needed"); protectedError.name = "PasswordException";
    expect(describeDocumentReadError(protectedError)).toContain("密码保护");
  });
});
