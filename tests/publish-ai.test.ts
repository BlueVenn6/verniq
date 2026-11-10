import { beforeEach, expect, it, vi } from "vitest";
import { composePublishDraft } from "@/src/lib/publish/publishAi";
import { createDefaultWorkspaceState } from "@/src/lib/workspace/core";
import { resolveTaskRuntimeConfig } from "@/src/lib/llm/config";
import { routeLlmChat } from "@/src/lib/llm/router";
vi.mock("@/src/lib/llm/config", () => ({ resolveTaskRuntimeConfig: vi.fn() }));
vi.mock("@/src/lib/llm/router", () => ({ routeLlmChat: vi.fn() }));
const workspace = createDefaultWorkspaceState();
const input = { workspace, sources: [{ id: "first", kind: "material" as const, label: "Material", title: "Source one", summary: "", content: "First complete source." }, { id: "second", kind: "material" as const, label: "Material", title: "Source two", summary: "", content: "Second complete source." }], topic: "Learning", reflection: "My own view", instruction: "Compare both sources", outputLanguage: "en", allowRemoteSources: true, confirmSend: vi.fn(() => true) };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(resolveTaskRuntimeConfig).mockResolvedValue({ ok: true, provider: { ...workspace.aiProviders[0], isLocal: false, isRemote: true }, model: workspace.aiModels[0], request: { provider: "openai", model: "Exact/Writer", messages: [] }, modelLabel: "Writer" });
  vi.mocked(routeLlmChat).mockResolvedValue({ text: "# New synthesis\n\nFirst idea [S1], second idea [S2].", provider: "openai", model: "Exact/Writer" });
});
it("sends selected source texts, reflection and revision context; appends the exact source index", async () => {
  const result = await composePublishDraft({ ...input, modelId: workspace.aiModels[0].id, currentDraft: "USER EDIT TO PRESERVE" });
  const request = vi.mocked(routeLlmChat).mock.calls[0][0];
  const content = JSON.parse(request.messages[0].content);
  expect(content.sources.map((source: { citation: string }) => source.citation)).toEqual(["S1", "S2"]);
  expect(content.currentDraft).toBe("USER EDIT TO PRESERVE"); expect(content.reflection).toBe("My own view");
  expect(result.markdown).toContain("[S1] Source one"); expect(result.markdown).toContain("[S2] Source two");
  expect(resolveTaskRuntimeConfig).toHaveBeenCalledWith(expect.objectContaining({ aiTaskRouting: expect.objectContaining({ publishPackage: { providerId: workspace.aiModels[0].providerId, modelId: workspace.aiModels[0].id } }) }));
  expect(input.confirmSend).toHaveBeenCalledOnce();
});
it("requires explicit source sharing consent and preserves local-only mode", async () => {
  await expect(composePublishDraft({ ...input, allowRemoteSources: false })).rejects.toThrow("不允许");
  await expect(composePublishDraft({ ...input, workspace: { ...workspace, aiPrivacySettings: { ...workspace.aiPrivacySettings, onlyUseLocalModels: true } } })).rejects.toThrow("本地");
  expect(routeLlmChat).not.toHaveBeenCalled();
});
it("does not send when confirmation is declined or context would be truncated", async () => {
  await expect(composePublishDraft({ ...input, confirmSend: () => false })).rejects.toThrow("取消");
  await expect(composePublishDraft({ ...input, sources: [{ ...input.sources[0], content: "x".repeat(61000) }] })).rejects.toThrow("不会自动截断");
  expect(routeLlmChat).not.toHaveBeenCalled();
});
it("rejects unknown and missing citations and ignores a cancelled response", async () => {
  vi.mocked(routeLlmChat).mockResolvedValueOnce({ text: "Invented [S99]" } as never);
  await expect(composePublishDraft(input)).rejects.toThrow("不存在");
  vi.mocked(routeLlmChat).mockResolvedValueOnce({ text: "No sources" } as never);
  await expect(composePublishDraft(input)).rejects.toThrow("没有标注");
  const controller = new AbortController();
  vi.mocked(routeLlmChat).mockImplementationOnce(async () => { controller.abort(); return { text: "Cancelled [S1]" } as never; });
  await expect(composePublishDraft({ ...input, signal: controller.signal })).rejects.toThrow("取消");
});
