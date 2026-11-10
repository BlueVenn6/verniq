import {
  createDefaultWorkspaceState,
  importWorkspaceState,
  validateWorkspaceState,
} from "@/src/lib/workspace/core";
import {
  isTauriDesktop,
  readWorkspaceFileFromSession,
  readWorkspaceFileSession,
  saveWorkspaceFile,
  type WorkspaceFileSession,
} from "@/src/lib/workspace/desktopStorage";
import {
  workspaceStorageKeys,
  writeLocalObject,
} from "@/src/lib/workspace/storage";
import type { WorkspaceState } from "@/src/lib/types";

export type WorkspaceStorageKind = "browser" | "desktop";

export type WorkspaceStorageStatus = {
  kind: WorkspaceStorageKind;
  isDesktop: boolean;
  hasOpenedWorkspaceFile: boolean;
  workspaceFilePath?: string;
  isUsingFallbackStorage: boolean;
  warning?: string;
};

export type WorkspaceStorageAdapter = {
  kind: WorkspaceStorageKind;
  canPersistToFile: boolean;
  loadWorkspace(): Promise<WorkspaceState | null>;
  saveWorkspace(state: WorkspaceState): Promise<void>;
  getStorageStatus(): Promise<WorkspaceStorageStatus>;
};

const DESKTOP_FALLBACK_WARNING =
  "当前正在使用临时工作区。请创建或打开工作区文件，以便稳定保存到本机。";
const WEB_STORAGE_WARNING =
  "Web mode uses browser storage. For reliable local-first storage, use the desktop app.";
let browserBaseline: string | null | undefined;

// Explicit restore is the only operation allowed to replace an invalid primary.
// Keep the previous bytes before the single atomic primary-key replacement.
export async function restoreBrowserWorkspace(json: string, expectedRaw: string | null) {
  const parsed = importWorkspaceState(json);
  if (!parsed.success) throw new Error(parsed.errors.join("；"));
  if (!navigator.locks) throw new Error("当前浏览器不支持跨窗口安全保存。请使用新版浏览器或桌面版，当前修改可下载为恢复副本。");
  return navigator.locks.request("verniq-workspace-write", () => {
    if (window.localStorage.getItem(workspaceStorageKeys.workspaceState) !== expectedRaw) {
      throw new Error("浏览器工作区已变化，已暂停自动保存。请先下载恢复副本，再加载已保存版本。");
    }
    const updatedAt = new Date().toISOString();
    const backupKey = expectedRaw === null ? undefined : `my-life-map:workspace:before-restore:${crypto.randomUUID()}`;
    if (backupKey) window.localStorage.setItem(backupKey, JSON.stringify({ primaryRaw: expectedRaw, createdAt: updatedAt }));
    saveWorkspaceToLocalStorage(parsed.workspace);
    browserBaseline = window.localStorage.getItem(workspaceStorageKeys.workspaceState);
    let statusWarning = "";
    try { writeLocalObject(workspaceStorageKeys.workspaceUpdatedAt, updatedAt); }
    catch { statusWarning = "内容已保存，但保存状态缓存未能更新。请导出备份。"; }
    return { workspace: parsed.workspace, backupKey, updatedAt, statusWarning };
  });
}

export function createWorkspaceStorageAdapter(): WorkspaceStorageAdapter {
  return isTauriDesktop() ? createDesktopWorkspaceFileAdapter() : createBrowserLocalStorageAdapter();
}

export function createBrowserLocalStorageAdapter(): WorkspaceStorageAdapter {
  return {
    kind: "browser",
    canPersistToFile: false,
    async loadWorkspace() {
      const workspace = loadWorkspaceFromLocalStorage();
      browserBaseline = window.localStorage.getItem(workspaceStorageKeys.workspaceState);
      return workspace;
    },
    async saveWorkspace(state) {
      const save = () => {
        if (browserBaseline === undefined || window.localStorage.getItem(workspaceStorageKeys.workspaceState) !== browserBaseline) {
          const error = new Error("浏览器工作区已变化，已暂停自动保存。请先下载恢复副本，再加载已保存版本。");
          error.name = "WorkspaceConflictError";
          throw error;
        }
        saveWorkspaceToLocalStorage(state);
        browserBaseline = window.localStorage.getItem(workspaceStorageKeys.workspaceState);
      };
      if (typeof navigator !== "undefined" && navigator.locks) {
        await navigator.locks.request("verniq-workspace-write", save);
      } else {
        throw new Error("当前浏览器不支持跨窗口安全保存。请使用新版浏览器或桌面版，当前修改可下载为恢复副本。");
      }
    },
    async getStorageStatus() {
      return {
        kind: "browser",
        isDesktop: false,
        hasOpenedWorkspaceFile: false,
        isUsingFallbackStorage: true,
        warning: WEB_STORAGE_WARNING,
      };
    },
  };
}

export function createDesktopWorkspaceFileAdapter(
  getSession: () => WorkspaceFileSession = readWorkspaceFileSession,
  onSaved?: (session: WorkspaceFileSession) => void,
): WorkspaceStorageAdapter {
  let recoveryWarning: string | undefined;
  const temporaryStorage = createBrowserLocalStorageAdapter();
  return {
    kind: "desktop",
    canPersistToFile: true,
    async loadWorkspace() {
      const session = getSession();

      if (session.storageMode === "desktop-file" && session.filePath) {
        const result = await readWorkspaceFileFromSession(session);

        if (result) onSaved?.(result.metadata);
        return result?.workspace ?? null;
      }

      return temporaryStorage.loadWorkspace();
    },
    async saveWorkspace(state) {
      const boundSession = getSession();
      const windowSession = readWorkspaceFileSession();
      // Other hooks in this window may have completed a queued save. Use the
      // per-window baseline, never a different window's localStorage baseline.
      const session = windowSession.filePath === boundSession.filePath
        ? windowSession : boundSession;

      if (session.storageMode === "desktop-file" && session.filePath) {
        const nextSession = await saveWorkspaceFile(state, session, {
          backup: true,
        });

        if (nextSession) {
          onSaved?.(nextSession);
          try {
            saveWorkspaceToLocalStorage(state);
            recoveryWarning = undefined;
          } catch {
            recoveryWarning = "本机文件已保存，但恢复缓存不可用。请保留工作区文件。";
          }
        }

        return;
      }

      await temporaryStorage.saveWorkspace(state);
    },
    async getStorageStatus() {
      const session = getSession();
      const hasOpenedWorkspaceFile = session.storageMode === "desktop-file" && Boolean(session.filePath);

      return {
        kind: "desktop",
        isDesktop: true,
        hasOpenedWorkspaceFile,
        workspaceFilePath: session.filePath,
        isUsingFallbackStorage: !hasOpenedWorkspaceFile,
        warning: hasOpenedWorkspaceFile ? recoveryWarning : DESKTOP_FALLBACK_WARNING,
      };
    },
  };
}

export function loadWorkspaceFromLocalStorage() {
  const raw = typeof window === "undefined" ? null : window.localStorage.getItem(workspaceStorageKeys.workspaceState);
  let storedWorkspace: unknown = null;
  if (raw !== null) {
    try {
      storedWorkspace = JSON.parse(raw);
    } catch {
      throw new Error("本地工作区数据不是有效的 JSON。");
    }
  }
  const validatedWorkspace = raw !== null ? validateWorkspaceState(storedWorkspace) : null;
  if (validatedWorkspace && !validatedWorkspace.valid) {
    throw new Error(`本地工作区数据校验失败：${validatedWorkspace.errors.join("；")}`);
  }
  const baseWorkspace =
    validatedWorkspace && validatedWorkspace.valid
      ? validatedWorkspace.workspace
      : createDefaultWorkspaceState();
  // Once present, the validated primary document is authoritative. Merging a
  // stale mirror here can undo edits and resurrect records removed by the user.
  if (raw !== null || typeof window === "undefined") return baseWorkspace;
  const legacyRaw = window.localStorage.getItem(workspaceStorageKeys.contentPipelineItems);
  if (legacyRaw === null) return baseWorkspace;
  let legacy: unknown;
  try {
    legacy = JSON.parse(legacyRaw);
  } catch {
    throw new Error("旧版材料缓存不是有效的 JSON，请先导出恢复副本。");
  }
  const validation = validateWorkspaceState({ contentPipelineItems: legacy });
  if (!validation.valid) throw new Error(`旧版材料缓存校验失败：${validation.errors.join("；")}`);
  return validation.workspace;
}

export function saveWorkspaceToLocalStorage(state: WorkspaceState) {
  // A single localStorage entry is the commit. A second write can fail after
  // this succeeds, producing a false failure and an incorrect conflict hash.
  writeLocalObject(workspaceStorageKeys.workspaceState, state);
}
