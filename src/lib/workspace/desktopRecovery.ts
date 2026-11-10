import type { WorkspaceState } from "@/src/lib/types";
import { exportWorkspaceState, validateWorkspaceState } from "./core";

const prefix = "my-life-map:workspace:recovery:";
const resolvedPrefix = "my-life-map:workspace:recovery-resolved:";
let windowId = "";

export type DesktopRecovery = { filePath: string; workspace: WorkspaceState; updatedAt: string; storageKey?: string; token?: string };

export function saveDesktopRecovery(filePath: string, workspace: WorkspaceState, updatedAt: string) {
  if (!windowId) windowId = crypto.randomUUID();
  const key = `${prefix}${windowId}`;
  const token = crypto.randomUUID();
  // The recovery copy lives in browser storage, so it follows the same
  // credential policy as a file on disk: references only, never plaintext keys.
  const snapshot = exportWorkspaceState(workspace).workspace;
  window.localStorage.setItem(key, JSON.stringify({ filePath, workspace: snapshot, updatedAt, token }));
  return { key, token };
}

export function clearDesktopRecovery({ key, token }: { key: string; token: string }) {
  const raw = window.localStorage.getItem(key);
  if (raw && (JSON.parse(raw) as DesktopRecovery).token === token) window.localStorage.removeItem(key);
}

export function readDesktopRecovery(filePath: string): DesktopRecovery | null {
  const entries: DesktopRecovery[] = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key?.startsWith(prefix)) continue;
    try {
      const resolvedAt = window.localStorage.getItem(`${resolvedPrefix}${key}`) ?? "";
      const value = JSON.parse(window.localStorage.getItem(key) ?? "null") as DesktopRecovery | null;
      if (!value || value.filePath !== filePath || typeof value.updatedAt !== "string" || value.updatedAt <= resolvedAt) continue;
      const validation = validateWorkspaceState(value.workspace);
      if (validation.valid) entries.push({ ...value, storageKey: key, workspace: validation.workspace });
    } catch { /* Retain damaged recovery data for manual inspection. */ }
  }
  return entries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
}

// Keep the recovery bytes, but do not restore them again after the user has
// explicitly opened the disk version or saved the recovery under a new name.
export function resolveDesktopRecovery(filePath: string, restoredKey?: string) {
  for (const key of new Set([windowId ? `${prefix}${windowId}` : "", restoredKey])) {
    if (!key) continue;
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;
    const snapshot = JSON.parse(raw) as DesktopRecovery;
    if (snapshot.filePath === filePath) window.localStorage.setItem(`${resolvedPrefix}${key}`, snapshot.updatedAt);
  }
}
