import {
  exportWorkspaceState,
  validateWorkspaceState,
  WORKSPACE_APP_NAME,
  WORKSPACE_SCHEMA_VERSION,
} from "@/src/lib/workspace/core";
import type {
  WorkspaceFile,
  WorkspaceFileMetadata,
  WorkspaceState,
} from "@/src/lib/types";

export const workspaceFileStorageKeys = {
  metadata: "my-life-map:workspace:file:metadata",
  activePath: "my-life-map:workspace:file:active-path",
  windowSession: "my-life-map:workspace:file:window-session",
} as const;

export type WorkspaceFileSession = WorkspaceFileMetadata & {
  storageMode: "browser-cache" | "desktop-file";
  lastOpenedAt?: string;
  contentHash?: string;
};

export type WorkspaceFileReadResult = {
  workspace: WorkspaceState;
  metadata: WorkspaceFileSession;
  json: string;
};


const JSON_FILTER = {
  name: "Workspace JSON",
  extensions: ["json"],
};

export function isTauriDesktop() {
  return (
    typeof window !== "undefined" &&
    "__TAURI_INTERNALS__" in window
  );
}

export function createWorkspaceFile(
  workspace: WorkspaceState,
  metadata: WorkspaceFileMetadata = {},
): WorkspaceFile {
  const exportedAt = new Date().toISOString();
  // This function writes to disk, so it must apply the same credential policy
  // as a portable export: keep the opaque reference, never the legacy plaintext
  // key or custom auth header values. The live key stays in memory or the OS
  // credential store and is re-read when a request is built.
  const persisted = exportWorkspaceState(workspace).workspace;

  return {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    appName: WORKSPACE_APP_NAME,
    exportedAt,
    workspace: persisted,
    metadata: {
      ...metadata,
      lastSavedAt: metadata.lastSavedAt ?? exportedAt,
      backupCount: metadata.backupCount ?? 0,
    },
  };
}

export function serializeWorkspaceFile(
  workspace: WorkspaceState,
  metadata: WorkspaceFileMetadata = {},
) {
  return JSON.stringify(createWorkspaceFile(workspace, metadata), null, 2);
}

export function serializeWorkspaceExport(workspace: WorkspaceState) {
  return serializeWorkspaceFile(exportWorkspaceState(workspace).workspace);
}

export function parseWorkspaceFile(json: string): WorkspaceFileReadResult {
  const parsed = JSON.parse(json) as unknown;
  const candidate = isPlainObject(parsed) && "workspace" in parsed ? parsed : { workspace: parsed };
  const workspaceCandidate = (candidate as { workspace?: unknown }).workspace;
  const validation = validateWorkspaceState(workspaceCandidate);

  if (!validation.valid) {
    throw new Error(validation.errors.join("；"));
  }

  const metadataCandidate =
    isPlainObject(candidate) && isPlainObject(candidate.metadata)
      ? candidate.metadata
      : {};
  const filePath =
    typeof metadataCandidate.filePath === "string" ? metadataCandidate.filePath : undefined;
  const lastSavedAt =
    typeof metadataCandidate.lastSavedAt === "string"
      ? metadataCandidate.lastSavedAt
      : undefined;
  const backupCount =
    typeof metadataCandidate.backupCount === "number"
      ? metadataCandidate.backupCount
      : 0;

  return {
    workspace: validation.workspace,
    metadata: {
      storageMode: "desktop-file",
      filePath,
      lastSavedAt,
      backupCount,
    },
    json,
  };
}

export function readWorkspaceFileSession(): WorkspaceFileSession {
  if (typeof window === "undefined") {
    return { storageMode: "browser-cache", backupCount: 0 };
  }

  try {
    const value = window.sessionStorage.getItem(workspaceFileStorageKeys.windowSession)
      ?? window.localStorage.getItem(workspaceFileStorageKeys.metadata);
    const parsed = value ? (JSON.parse(value) as Partial<WorkspaceFileSession>) : null;

    if (!parsed) {
      return { storageMode: "browser-cache", backupCount: 0 };
    }

    const filePath = typeof parsed.filePath === "string" ? parsed.filePath : undefined;
    // Persisted Tauri file scope allows recovery after a desktop restart;
    // sessionStorage is only a per-window marker and must not block recovery.
    const hasActiveDesktopScope = parsed.storageMode === "desktop-file" && Boolean(filePath);

    return {
      storageMode: hasActiveDesktopScope ? "desktop-file" : "browser-cache",
      filePath,
      lastSavedAt:
        typeof parsed.lastSavedAt === "string" ? parsed.lastSavedAt : undefined,
      lastOpenedAt:
        typeof parsed.lastOpenedAt === "string" ? parsed.lastOpenedAt : undefined,
      backupCount: typeof parsed.backupCount === "number" ? parsed.backupCount : 0,
      contentHash: typeof parsed.contentHash === "string" ? parsed.contentHash : undefined,
    };
  } catch {
    return { storageMode: "browser-cache", backupCount: 0 };
  }
}

export function writeWorkspaceFileSession(session: WorkspaceFileSession) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    workspaceFileStorageKeys.metadata,
    JSON.stringify(session),
  );
  window.sessionStorage.setItem(workspaceFileStorageKeys.windowSession, JSON.stringify(session));

  if (session.storageMode === "desktop-file" && session.filePath) {
    window.sessionStorage.setItem(workspaceFileStorageKeys.activePath, session.filePath);
  } else {
    window.sessionStorage.removeItem(workspaceFileStorageKeys.activePath);
  }
}

export async function openWorkspaceFile(): Promise<WorkspaceFileReadResult | null> {
  assertTauriDesktop();

  const { open } = await import("@tauri-apps/plugin-dialog");
  const { readTextFile } = await import("@tauri-apps/plugin-fs");
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [JSON_FILTER],
  });

  if (!selected || Array.isArray(selected)) {
    return null;
  }

  const json = await readTextFile(selected);
  const result = parseWorkspaceFile(json);
  const metadata: WorkspaceFileSession = {
    ...result.metadata,
    storageMode: "desktop-file",
    filePath: selected,
    contentHash: await hashWorkspaceFile(json),
    lastOpenedAt: new Date().toISOString(),
  };

  return {
    ...result,
    metadata,
  };
}

export async function readWorkspaceFileFromSession(
  session: WorkspaceFileSession,
): Promise<WorkspaceFileReadResult | null> {
  assertTauriDesktop();

  if (session.storageMode !== "desktop-file" || !session.filePath) {
    return null;
  }

  const { readTextFile } = await import("@tauri-apps/plugin-fs");
  const json = await readTextFile(session.filePath);
  const result = parseWorkspaceFile(json);

  return {
    ...result,
    metadata: {
      ...result.metadata,
      storageMode: "desktop-file",
      filePath: session.filePath,
      contentHash: await hashWorkspaceFile(json),
      lastOpenedAt: new Date().toISOString(),
    },
  };
}

export async function saveWorkspaceFile(
  workspace: WorkspaceState,
  session: WorkspaceFileSession,
  options: { saveAs?: boolean; backup?: boolean } = {},
): Promise<WorkspaceFileSession | null> {
  assertTauriDesktop();

  const filePath =
    options.saveAs || !session.filePath
      ? await chooseWorkspaceSavePath()
      : session.filePath;

  if (!filePath) {
    return null;
  }

  return writeWorkspaceFileToPath(workspace, filePath, session, {
    backup: options.backup ?? true,
  });
}

export async function exportWorkspaceFile(
  workspace: WorkspaceState,
  session: WorkspaceFileSession,
): Promise<WorkspaceFileSession | null> {
  assertTauriDesktop();

  const filePath = await chooseWorkspaceSavePath("my-life-map-workspace-export.json");

  if (!filePath) {
    return null;
  }

  if (sameWorkspacePath(session.filePath, filePath) && session.storageMode === "desktop-file") {
    throw new Error("导出副本请选择不同的文件名。更新当前文件请使用保存。");
  }

  await writeTextFileAtomically(
    filePath,
    serializeWorkspaceExport(workspace),
  );

  return session;
}

export async function importWorkspaceFile(): Promise<WorkspaceFileReadResult | null> {
  assertTauriDesktop();

  const { open } = await import("@tauri-apps/plugin-dialog");
  const { readTextFile } = await import("@tauri-apps/plugin-fs");
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [JSON_FILTER],
  });

  if (!selected || Array.isArray(selected)) {
    return null;
  }

  const json = await readTextFile(selected);
  const result = parseWorkspaceFile(json);

  return {
    ...result,
    metadata: {
      ...result.metadata,
      storageMode: "browser-cache",
      lastOpenedAt: new Date().toISOString(),
    },
  };
}

async function chooseWorkspaceSavePath(defaultPath = "workspace.json") {
  const { save } = await import("@tauri-apps/plugin-dialog");

  return save({
    defaultPath,
    filters: [JSON_FILTER],
  });
}

async function writeWorkspaceFileToPath(
  workspace: WorkspaceState,
  filePath: string,
  session: WorkspaceFileSession,
  options: { backup: boolean },
): Promise<WorkspaceFileSession> {
  if (sameWorkspacePath(session.filePath, filePath) && !session.contentHash) {
    throw new Error("请重新打开工作区文件以建立冲突检查，然后再保存。");
  }
  const lastSavedAt = new Date().toISOString();
  const result = await writeTextFileAtomically(
    filePath,
    serializeWorkspaceFile(workspace, {
      filePath,
      lastSavedAt,
      backupCount: session.backupCount ?? 0,
    }),
    sameWorkspacePath(session.filePath, filePath) ? session.contentHash : undefined,
    options.backup,
  );

  return {
    storageMode: "desktop-file",
    filePath,
    lastSavedAt,
    backupCount: result.backupCount,
    contentHash: result.contentHash,
  };
}

async function writeTextFileAtomically(
  filePath: string,
  json: string,
  expectedHash?: string,
  backup = false,
) {
  const { invoke } = await import("@tauri-apps/api/core");
  try {
    return await invoke<{ contentHash: string; backupCount: number }>("workspace_write_atomic", {
      filePath, json, expectedHash: expectedHash ?? null, backup,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const code = reason.match(/^WORKSPACE_([A-Z]+):/)?.[1];
    const messages: Record<string, string> = {
      CONFLICT: "工作区文件已被其他窗口或程序修改。请重新打开，或将恢复副本另存为新文件。",
      BUSY: "其他窗口正在保存此工作区，请稍后重试。",
      SCOPE: "工作区文件访问权限不可用，请重新打开文件。",
      BACKUP: "无法创建备份，原工作区文件已保留。",
      REPLACE: "无法替换工作区文件，原文件已保留。",
      WRITE: "无法写入临时文件，原工作区文件已保留。",
    };
    throw new Error(code && messages[code] ? messages[code] : reason);
  }
}

async function hashWorkspaceFile(json: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(json));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function sameWorkspacePath(left: string | undefined, right: string) {
  const normalize = (value: string) => {
    const path = value.replaceAll("\\", "/");
    return /^[a-z]:\//i.test(path) || path.startsWith("//") ? path.toLowerCase() : path;
  };
  return Boolean(left) && normalize(left!) === normalize(right);
}

function assertTauriDesktop() {
  if (!isTauriDesktop()) {
    throw new Error("当前不是 Tauri 桌面环境，不能直接读写工作区文件。");
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
