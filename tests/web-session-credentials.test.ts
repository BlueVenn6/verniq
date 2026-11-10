import { beforeEach, expect, it, vi } from "vitest";

vi.mock("@/src/lib/workspace/desktopStorage", () => ({ isTauriDesktop: () => false }));
const session = new Map<string, string>();
beforeEach(() => {
  vi.resetModules(); session.clear();
  vi.stubGlobal("window", { sessionStorage: { setItem: (key: string, value: string) => session.set(key, value), getItem: (key: string) => session.get(key) ?? null, removeItem: (key: string) => session.delete(key) } });
});
it("keeps a web credential across module reloads without exporting it to workspace or localStorage", async () => {
  const first = await import("@/src/lib/secrets/secretStore");
  await first.saveCredentialSecret("test-reference", "isolated-test-secret");
  vi.resetModules();
  const reloaded = await import("@/src/lib/secrets/secretStore");
  expect(await reloaded.readCredentialSecret("test-reference")).toBe("isolated-test-secret");
  await reloaded.deleteCredentialSecret("test-reference");
  vi.resetModules();
  expect(await (await import("@/src/lib/secrets/secretStore")).readCredentialSecret("test-reference")).toBeNull();
});
it("reports a storage failure instead of claiming the key was saved", async () => {
  vi.stubGlobal("window", { sessionStorage: { setItem: () => { throw new Error("blocked"); } } });
  const secrets = await import("@/src/lib/secrets/secretStore");
  await expect(secrets.saveCredentialSecret("test-reference", "isolated-test-secret")).rejects.toThrow("无法保存会话密钥");
});
