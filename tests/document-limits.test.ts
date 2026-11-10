import { afterEach, expect, it, vi } from "vitest";
import { ingestUploadedFile } from "@/src/lib/ingest";
import { translateUiText } from "@/src/lib/copy/en";

const pdf = vi.hoisted(() => ({ numPages: 301, getPage: vi.fn(), destroy: vi.fn() }));
vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({ GlobalWorkerOptions: {}, getDocument: () => ({ promise: Promise.resolve(pdf) }) }));
vi.mock("mammoth", () => ({ extractRawText: async () => ({ value: "document ".repeat(30000) + "END OF FILE" }) }));
afterEach(() => vi.unstubAllGlobals());

it.each(["txt", "html", "docx"])("does not silently import a truncated or oversized %s document", async ext => {
  const result = await ingestUploadedFile(new File(["read ".repeat(51000) + "END OF FILE"], `large.${ext}`));
  expect(result.ingestStatus).toBe("failed");
  expect(result.extractedText).toBe("");
  expect(result.ingestError).toContain("250,000");
  expect(translateUiText(result.ingestError)).not.toMatch(/[\u3400-\u9fff]/);
});
it("rejects a PDF above the page limit before reading a misleading partial document, and frees its worker", async () => {
  vi.stubGlobal("window", { location: { href: "http://localhost/" } });
  const result = await ingestUploadedFile(new File(["pdf"], "large.pdf"));
  expect(result.ingestStatus).toBe("failed");
  expect(result.ingestError).toContain("300");
  expect(pdf.getPage).not.toHaveBeenCalled();
  expect(pdf.destroy).toHaveBeenCalled();
});
