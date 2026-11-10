import { beforeEach, describe, expect, it, vi } from "vitest";
import { askReaderAssistant } from "@/src/lib/readerAssistant";
import { createDefaultWorkspaceState, exportWorkspaceState, importWorkspaceState } from "@/src/lib/workspace/core";
import { resolveTaskRuntimeConfig } from "@/src/lib/llm/config";
import { routeLlmChat } from "@/src/lib/llm/router";
import type { SourceMaterial } from "@/src/lib/types";

vi.mock("@/src/lib/llm/config", () => ({ resolveTaskRuntimeConfig: vi.fn() }));
vi.mock("@/src/lib/llm/router", () => ({ routeLlmChat: vi.fn() }));
const source: SourceMaterial = { id: "source", goalId: "", title: "Reading", sourceType: "text", language: "en", originalContent: "Read and reflect.", cleanedContent: "Read and reflect.", metadata: {}, createdAt: "2026-01-01", updatedAt: "2026-01-01" };
function setup() {
  const workspace = createDefaultWorkspaceState();
  workspace.aiPrivacySettings = { ...workspace.aiPrivacySettings, allowRemoteAi: true, onlyUseLocalModels: false, allowFullMaterialToRemote: false };
  return { workspace, source, note: "My own reflection", selection: "reflect", history: [], question: "Why?", allowRemoteMaterial: true, confirmSend: vi.fn(() => true) };
}
describe("reader discussion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const workspace = createDefaultWorkspaceState();
    vi.mocked(resolveTaskRuntimeConfig).mockResolvedValue({ ok: true, provider: { ...workspace.aiProviders[0], isRemote: true, isLocal: false }, model: workspace.aiModels[0], request: {} as never, modelLabel: "configured exact model" });
    vi.mocked(routeLlmChat).mockResolvedValue({ text: "Grounded feedback" } as never);
  });
  it("sends the material, current unsaved note, selection and recent conversation to the selected model", async () => {
    const input = setup();
    input.workspace.readerMessages = [ { id: "u", sourceMaterialId: source.id, role: "user", text: "Previous question", createdAt: "2026-01-01" }, { id: "a", sourceMaterialId: source.id, role: "assistant", text: "Previous reply", createdAt: "2026-01-01" } ];
    const model = input.workspace.aiModels[1];
    const result = await askReaderAssistant({ ...input, history: input.workspace.readerMessages, modelId: model.id });
    expect(result.text).toBe("Grounded feedback");
    expect(resolveTaskRuntimeConfig).toHaveBeenCalledWith(expect.objectContaining({ aiTaskRouting: expect.objectContaining({ languageAnalysis: { providerId: model.providerId, modelId: model.id } }) }));
    const request = vi.mocked(routeLlmChat).mock.calls[0][0];
    expect(request.messages.slice(0, 2)).toEqual([ { role: "user", content: "Previous question" }, { role: "assistant", content: "Previous reply" } ]);
    expect(JSON.parse(request.messages.at(-1)!.content)).toMatchObject({ note: input.note, selection: input.selection, material: { text: source.cleanedContent } });
    expect(input.workspace.aiPrivacySettings.allowFullMaterialToRemote).toBe(false);
  });
  it("blocks material sending until allowed and makes no request", async () => {
    await expect(askReaderAssistant({ ...setup(), allowRemoteMaterial: false })).rejects.toThrow("不允许将完整材料");
    expect(routeLlmChat).not.toHaveBeenCalled();
  });
  it.each(["off", "local_only"])("a request allowance never bypasses global %s mode", async mode => {
    const input = setup();
    input.workspace.aiPrivacySettings.allowRemoteAi = mode !== "off";
    input.workspace.aiPrivacySettings.onlyUseLocalModels = mode === "local_only";
    await expect(askReaderAssistant(input)).rejects.toThrow(); expect(routeLlmChat).not.toHaveBeenCalled();
  });
  it("does not send after cancellation or an abort", async () => {
    await expect(askReaderAssistant({ ...setup(), confirmSend: () => false })).rejects.toThrow("取消");
    const controller = new AbortController(); controller.abort();
    await expect(askReaderAssistant({ ...setup(), signal: controller.signal })).rejects.toThrow("取消");
    expect(routeLlmChat).not.toHaveBeenCalled();
  });
  it("bounds the article and tells the model when it received only an excerpt", async () => {
    await askReaderAssistant({ ...setup(), source: { ...source, cleanedContent: "a".repeat(18000) } });
    const data = JSON.parse(vi.mocked(routeLlmChat).mock.calls[0][0].messages.at(-1)!.content);
    expect(data.material.text).toHaveLength(12000); expect(data.material.truncated).toBe(true);
  });
  it("rejects empty responses rather than showing a fake answer", async () => {
    vi.mocked(routeLlmChat).mockResolvedValueOnce({ text: " " } as never);
    await expect(askReaderAssistant(setup())).rejects.toThrow("没有返回");
  });
  it("keeps conversations in workspace export and restores old workspaces without discarding notes", () => {
    const input = setup(); input.workspace.readerMessages = [{ id: "a", sourceMaterialId: source.id, role: "assistant", text: "Saved reply", createdAt: "2026-01-01" }];
    const restored = importWorkspaceState(JSON.stringify(exportWorkspaceState(input.workspace)));
    expect(restored.success && restored.workspace.readerMessages).toEqual(input.workspace.readerMessages);
    const legacy = { ...input.workspace } as Partial<typeof input.workspace>; delete legacy.readerMessages;
    const old = importWorkspaceState(JSON.stringify(legacy));
    expect(old.success && old.workspace.readerMessages).toEqual([]);
  });
});
