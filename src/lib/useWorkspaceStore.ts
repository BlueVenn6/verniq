"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createDefaultWorkspaceState,
  importWorkspaceState as importWorkspaceStateFromJson,
  mergeWorkspaceState,
} from "@/src/lib/workspace/core";
import {
  exportWorkspaceFile as exportWorkspaceFileToDisk,
  importWorkspaceFile as importWorkspaceFileFromDisk,
  isTauriDesktop,
  openWorkspaceFile as openWorkspaceFileFromDisk,
  readWorkspaceFileSession,
  saveWorkspaceFile as saveWorkspaceFileToDisk,
  serializeWorkspaceExport,
  type WorkspaceFileSession,
  workspaceFileStorageKeys,
  writeWorkspaceFileSession,
} from "@/src/lib/workspace/desktopStorage";
import { enqueueWorkspaceWrite, flushWorkspaceWrites, getWorkspaceReadFailure, getWorkspaceWriteRevision, hasPendingWorkspaceWrites, runWorkspaceWrite, setWorkspaceReadFailure } from "@/src/lib/workspace/writeQueue";
import { clearDesktopRecovery, readDesktopRecovery, resolveDesktopRecovery, saveDesktopRecovery } from "@/src/lib/workspace/desktopRecovery";
import { translateUiText } from "@/src/lib/copy/en";
import {
  readLocalObject,
  workspaceStorageKeys,
  writeLocalObject,
} from "@/src/lib/workspace/storage";
import {
  createBrowserLocalStorageAdapter,
  createDesktopWorkspaceFileAdapter,
  loadWorkspaceFromLocalStorage,
  createWorkspaceStorageAdapter,
  saveWorkspaceToLocalStorage,
  restoreBrowserWorkspace,
  type WorkspaceStorageAdapter,
  type WorkspaceStorageStatus,
} from "@/src/lib/workspace/storageAdapter";
import type {
  ContentConversion,
  ContentPipelineItem,
  LearningSegment,
  Offer,
  PlatformConfig,
  PublishPackage,
  SourceMaterial,
  VideoGenerationDraft,
  WorkspaceState,
} from "@/src/lib/types";

let currentWindowWorkspace: WorkspaceState | null = null;
let restoredDesktopRecoveryKey: string | undefined;

const WORKSPACE_UPDATED_EVENT = "my-life-map:workspace-updated";

type WorkspaceStateSetter = WorkspaceState | ((current: WorkspaceState) => WorkspaceState);
type WorkspacePatch =
  | Partial<WorkspaceState>
  | ((current: WorkspaceState) => Partial<WorkspaceState>);
type CommitEntryInput = {
  item: ContentPipelineItem;
  offersToUpsert?: Offer[];
  platformsToUpsert?: PlatformConfig[];
  sourceMaterial?: SourceMaterial;
  learningSegments?: LearningSegment[];
};

export function useWorkspaceStore() {
  const [workspace, setWorkspaceState] = useState<WorkspaceState>(() =>
    currentWindowWorkspace ?? createDefaultWorkspaceState(),
  );
  const [lastUpdatedAt, setLastUpdatedAt] = useState("");
  const [workspaceFile, setWorkspaceFileState] = useState<WorkspaceFileSession>(() => ({
    storageMode: "browser-cache",
    backupCount: 0,
  }));
  const [workspaceFileMessage, setWorkspaceFileMessage] = useState("");
  const [storageStatus, setStorageStatus] = useState<WorkspaceStorageStatus>(() =>
    createInitialStorageStatus(),
  );
  const workspaceRef = useRef(workspace);
  const workspaceFileRef = useRef(workspaceFile);
  const storageAdapterRef = useRef<WorkspaceStorageAdapter | null>(null);

  const setWorkspaceFile = useCallback((session: WorkspaceFileSession) => {
    workspaceFileRef.current = session;
    writeWorkspaceFileSession(session);
    setWorkspaceFileState(session);
  }, []);

  const refreshStorageStatus = useCallback((): void => {
    const adapter = createCurrentWorkspaceStorageAdapter(
      () => workspaceFileRef.current,
      setWorkspaceFile,
    );

    storageAdapterRef.current = adapter;
    void adapter.getStorageStatus().then(setStorageStatus);
  }, [setWorkspaceFile]);

  useEffect(() => {
    const syncWorkspaceFromStorage = async () => {
      if (hasPendingWorkspaceWrites() || getWorkspaceReadFailure()) {
        if (currentWindowWorkspace) {
          workspaceRef.current = currentWindowWorkspace;
          setWorkspaceState(currentWindowWorkspace);
        }
        if (getWorkspaceReadFailure()) {
          const session = readWorkspaceFileSession();
          workspaceFileRef.current = session;
          setWorkspaceFileState(session);
          setWorkspaceFileMessage(getWorkspaceReadFailure());
          setStorageStatus((current) => ({ ...current, warning: getWorkspaceReadFailure() }));
        }
        return;
      }
      const revision = getWorkspaceWriteRevision();
      const nextSession = readWorkspaceFileSession();
      workspaceFileRef.current = nextSession;
      setWorkspaceFileState(nextSession);
      const adapter = createCurrentWorkspaceStorageAdapter(
        () => workspaceFileRef.current,
        setWorkspaceFile,
      );
      storageAdapterRef.current = adapter;
      try {
        const recovery = readDesktopRecovery(adapter.kind === "desktop" && nextSession.filePath ? nextSession.filePath : "browser-cache");
        if (recovery) {
          restoredDesktopRecoveryKey = recovery.storageKey;
          currentWindowWorkspace = recovery.workspace;
          workspaceRef.current = recovery.workspace;
          setWorkspaceState(recovery.workspace);
          setLastUpdatedAt(recovery.updatedAt);
          const warning = adapter.kind === "desktop"
            ? "已恢复尚未写入文件的内容。自动保存已暂停，请先另存恢复副本，或重新打开磁盘文件。"
            : "已恢复浏览器未保存的内容，已暂停自动保存。请先下载恢复副本，再加载已保存版本。";
          setWorkspaceReadFailure(warning);
          setWorkspaceFileMessage(warning);
          setStorageStatus({ kind: adapter.kind, isDesktop: adapter.kind === "desktop", hasOpenedWorkspaceFile: Boolean(nextSession.filePath),
            workspaceFilePath: nextSession.filePath, isUsingFallbackStorage: true, warning });
          return;
        }
        const loadedWorkspace = await adapter.loadWorkspace();
        const nextWorkspace = loadedWorkspace
          ? mergeWorkspaceState(createDefaultWorkspaceState(), loadedWorkspace)
          : createDefaultWorkspaceState();
        const nextStatus = await adapter.getStorageStatus();

        if (hasPendingWorkspaceWrites() || revision !== getWorkspaceWriteRevision()) return;

        setWorkspaceReadFailure("");
        currentWindowWorkspace = nextWorkspace;
        workspaceRef.current = nextWorkspace;
        setWorkspaceState(nextWorkspace);
        setLastUpdatedAt(readLocalObject(workspaceStorageKeys.workspaceUpdatedAt, ""));
        setStorageStatus(nextStatus);
      } catch (error) {
        if (hasPendingWorkspaceWrites() || revision !== getWorkspaceWriteRevision()) return;
        const reason = error instanceof Error ? error.message : "读取工作区失败。";
        const warning = `${reason} 已暂停自动保存以保护原数据，请重新打开工作区文件。`;

        if (nextSession.storageMode === "desktop-file" && nextSession.filePath) {
          try {
            const recoveredWorkspace = loadWorkspaceFromLocalStorage();
            currentWindowWorkspace = recoveredWorkspace;
            workspaceRef.current = recoveredWorkspace;
            setWorkspaceState(recoveredWorkspace);
            setLastUpdatedAt(readLocalObject(workspaceStorageKeys.workspaceUpdatedAt, ""));
            setWorkspaceFileMessage(`${warning} 当前显示的是本地恢复副本。`);
            setStorageStatus((current) => ({
              ...current,
              isUsingFallbackStorage: true,
              warning: `${warning} 当前显示的是本地恢复副本。`,
            }));
          } catch {
            setWorkspaceFileMessage(warning);
            setStorageStatus((current) => ({ ...current, warning }));
          }
        } else {
          setWorkspaceFileMessage(warning);
          setStorageStatus((current) => ({ ...current, warning }));
        }

        setWorkspaceReadFailure(warning);
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (
        event.key &&
        ![
          workspaceStorageKeys.workspaceState,
          workspaceStorageKeys.workspaceUpdatedAt,
          workspaceStorageKeys.contentPipelineItems,
          workspaceFileStorageKeys.metadata,
        ].includes(event.key)
      ) {
        return;
      }

      void syncWorkspaceFromStorage();
    };

    void syncWorkspaceFromStorage();

    window.addEventListener("storage", handleStorage);
    window.addEventListener(WORKSPACE_UPDATED_EVENT, syncWorkspaceFromStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(WORKSPACE_UPDATED_EVENT, syncWorkspaceFromStorage);
    };
  }, [refreshStorageStatus, setWorkspaceFile]);

  const persistWorkspace = useCallback((nextWorkspace: WorkspaceState) => {
    const readFailure = getWorkspaceReadFailure();
    if (readFailure) {
      // Consumers such as Save draft await flushWorkspaceWrites(). A paused
      // save must remain a failed write, never reuse an earlier successful one.
      const blocked = enqueueWorkspaceWrite(async () => { throw new Error(readFailure); });
      void blocked.settled.catch(() => undefined);
      {
        try {
          saveDesktopRecovery(workspaceFileRef.current.filePath ?? "browser-cache", nextWorkspace, new Date().toISOString());
        } catch {
          setWorkspaceFileMessage("恢复副本写入失败，请立即导出工作区并保持页面打开。");
          return "";
        }
      }
      setWorkspaceFileMessage(readFailure);
      setStorageStatus((current) => ({ ...current, warning: readFailure }));
      return "";
    }
    const updatedAt = new Date().toISOString();
    const adapter =
      storageAdapterRef.current ??
      createCurrentWorkspaceStorageAdapter(() => workspaceFileRef.current, setWorkspaceFile);

    storageAdapterRef.current = adapter;
    const filePath = workspaceFileRef.current.filePath;
    let recovery: ReturnType<typeof saveDesktopRecovery> | undefined;
    try {
      recovery = saveDesktopRecovery(filePath ?? "browser-cache", nextWorkspace, updatedAt);
    } catch {
      setWorkspaceFileMessage("恢复副本写入失败，请立即保存工作区文件。");
    }
    let cleanupWarning = "";
    const queued = enqueueWorkspaceWrite(async () => {
      if (getWorkspaceReadFailure()) throw new Error(getWorkspaceReadFailure());
      await adapter.saveWorkspace(nextWorkspace);
      // Only acknowledge a confirmed primary write. Recovery and status
      // metadata are secondary and must not turn a durable save into a conflict.
      try {
        if (recovery) clearDesktopRecovery(recovery);
      } catch {
        cleanupWarning = "内容已保存，但保存状态缓存未能更新。请导出备份。";
      }
      try {
        writeLocalObject(workspaceStorageKeys.workspaceUpdatedAt, updatedAt);
      } catch {
        cleanupWarning = "内容已保存，但保存状态缓存未能更新。请导出备份。";
      }
    });
    void queued.settled
      .then(() => adapter.getStorageStatus())
      .then((nextStatus) => {
        if (queued.revision !== getWorkspaceWriteRevision()) return;
        setStorageStatus(nextStatus);
        setLastUpdatedAt(updatedAt);
        setWorkspaceFileMessage(cleanupWarning);
        scheduleWorkspaceUpdatedEvent();

        if (!cleanupWarning && nextStatus.kind === "desktop" && nextStatus.hasOpenedWorkspaceFile) {
          setWorkspaceFileMessage("工作区文件已保存。");
        }
      })
      .catch((error) => {
        if (queued.revision !== getWorkspaceWriteRevision()) return;
        const reason = error instanceof Error ? error.message : "未知错误";
        try {
          if (adapter.kind === "desktop" && filePath) saveWorkspaceToLocalStorage(nextWorkspace);
          else if (!recovery) throw new Error("Recovery storage is unavailable");
          const warning = adapter.kind === "desktop" && filePath
            ? `文件保存失败：${reason}。最新内容已保留在本地恢复副本，请重新打开工作区文件后再继续保存。`
            : `浏览器保存失败，已暂停自动保存。${reason} 当前编辑内容已保留在恢复副本。`;
          setWorkspaceReadFailure(warning);
          scheduleWorkspaceUpdatedEvent();
          setWorkspaceFileMessage(warning);
          void adapter.getStorageStatus().then((nextStatus) =>
            setStorageStatus(
              adapter.kind === "desktop"
                ? { ...nextStatus, isUsingFallbackStorage: true, warning }
                : { ...nextStatus, warning },
            ),
          );
        } catch {
          const warning = `保存失败：${reason}。临时缓存也不可用，请勿关闭页面并立即导出工作区。`;
          setWorkspaceReadFailure(warning);
          scheduleWorkspaceUpdatedEvent();
          setWorkspaceFileMessage(warning);
          setStorageStatus((current) => ({ ...current, warning: "保存失败：文件和临时缓存均未确认写入。" }));
        }
      });

    return updatedAt;
  }, [setWorkspaceFile]);

  const commitWorkspaceState = useCallback(
    (nextWorkspace: WorkspaceState) => {
      const updatedAt = persistWorkspace(nextWorkspace);

      currentWindowWorkspace = nextWorkspace;
      workspaceRef.current = nextWorkspace;
      setWorkspaceState(nextWorkspace);
      scheduleWorkspaceUpdatedEvent();

      return updatedAt;
    },
    [persistWorkspace],
  );

  const setWorkspace = useCallback(
    (nextValue: WorkspaceStateSetter) => {
      const current = currentWindowWorkspace ?? workspaceRef.current;
      const resolved = typeof nextValue === "function" ? nextValue(current) : nextValue;
      const nextWorkspace = mergeWorkspaceState(createDefaultWorkspaceState(), resolved);

      commitWorkspaceState(nextWorkspace);
    },
    [commitWorkspaceState],
  );

  const updateWorkspace = useCallback(
    (patch: WorkspacePatch) => {
      const current = currentWindowWorkspace ?? workspaceRef.current;
      const resolvedPatch = typeof patch === "function" ? patch(current) : patch;
      const nextWorkspace = mergeWorkspaceState(current, resolvedPatch);

      commitWorkspaceState(nextWorkspace);
    },
    [commitWorkspaceState],
  );

  const addContentItem = useCallback(
    (item: ContentPipelineItem) => {
      updateWorkspace((current) => ({
        contentPipelineItems: upsertByKey(current.contentPipelineItems, item, (entry) => entry.id),
        currentContentId: item.id,
        recentSavedContentIds: pushRecentId(current.recentSavedContentIds, item.id),
      }));
    },
    [updateWorkspace],
  );

  const updateContentItem = useCallback(
    (item: ContentPipelineItem) => {
      updateWorkspace((current) => ({
        contentPipelineItems: replaceByKey(current.contentPipelineItems, item, (entry) => entry.id),
        currentContentId: item.id,
      }));
    },
    [updateWorkspace],
  );

  const setCurrentContentId = useCallback(
    (contentId: string) => {
      updateWorkspace((current) => ({
        currentContentId: current.contentPipelineItems.some((item) => item.id === contentId)
          ? contentId
          : current.currentContentId,
      }));
    },
    [updateWorkspace],
  );

  const commitEntryToWorkspace = useCallback(
    ({
      item,
      offersToUpsert = [],
      platformsToUpsert = [],
      sourceMaterial,
      learningSegments = [],
    }: CommitEntryInput) => {
      const current = currentWindowWorkspace ?? workspaceRef.current;
      const normalizedSourceMaterial = sourceMaterial
        ? reuseSourceMaterialForContentItem(current.sourceMaterials, sourceMaterial, item.id)
        : undefined;
      const shouldReuseExistingSegments = normalizedSourceMaterial
        ? current.learningSegments.some(
            (segment) => segment.sourceMaterialId === normalizedSourceMaterial.id,
          )
        : false;
      const normalizedLearningSegments =
        normalizedSourceMaterial && sourceMaterial && !shouldReuseExistingSegments
          ? learningSegments.map((segment) => ({
              ...segment,
              sourceMaterialId: normalizedSourceMaterial.id,
            }))
          : learningSegments;
      const nextWorkspace = mergeWorkspaceState(current, {
        currentContentId: item.id,
        recentSavedContentIds: pushRecentId(current.recentSavedContentIds, item.id),
        contentPipelineItems: upsertByKey(current.contentPipelineItems, item, (entry) => entry.id),
        offers: offersToUpsert.length
          ? upsertManyByKey(current.offers, offersToUpsert, (entry) => entry.id)
          : current.offers,
        platformConfigs: platformsToUpsert.length
          ? upsertManyByKey(current.platformConfigs, platformsToUpsert, (entry) => entry.id)
          : current.platformConfigs,
        sourceMaterials: normalizedSourceMaterial
          ? upsertByKey(current.sourceMaterials, normalizedSourceMaterial, (entry) => entry.id)
          : current.sourceMaterials,
        learningSegments: normalizedLearningSegments.length && !shouldReuseExistingSegments
          ? upsertManyByKey(current.learningSegments, normalizedLearningSegments, (entry) => entry.id)
          : current.learningSegments,
      });

      commitWorkspaceState(nextWorkspace);

      return item;
    },
    [commitWorkspaceState],
  );

  const addOffer = useCallback(
    (offer: Offer) => {
      updateWorkspace((current) => ({
        offers: upsertByKey(current.offers, offer, (entry) => entry.id),
      }));
    },
    [updateWorkspace],
  );

  const updateOffer = useCallback(
    (offer: Offer) => {
      updateWorkspace((current) => ({
        offers: replaceByKey(current.offers, offer, (entry) => entry.id),
      }));
    },
    [updateWorkspace],
  );

  const addPublishPackage = useCallback(
    (publishPackage: PublishPackage) => {
      updateWorkspace((current) => ({
        publishPackages: upsertByKey(
          current.publishPackages,
          publishPackage,
          (entry) => entry.contentItemId,
        ),
      }));
    },
    [updateWorkspace],
  );

  const updatePublishPackage = useCallback(
    (publishPackage: PublishPackage) => {
      updateWorkspace((current) => ({
        publishPackages: replaceByKey(
          current.publishPackages,
          publishPackage,
          (entry) => entry.contentItemId,
        ),
      }));
    },
    [updateWorkspace],
  );

  const addVideoGenerationDraft = useCallback(
    (draft: VideoGenerationDraft) => {
      updateWorkspace((current) => ({
        videoGenerationDrafts: upsertByKey(
          current.videoGenerationDrafts,
          draft,
          (entry) => entry.contentItemId,
        ),
      }));
    },
    [updateWorkspace],
  );

  const updateVideoGenerationDraft = useCallback(
    (draft: VideoGenerationDraft) => {
      updateWorkspace((current) => ({
        videoGenerationDrafts: replaceByKey(
          current.videoGenerationDrafts,
          draft,
          (entry) => entry.contentItemId,
        ),
      }));
    },
    [updateWorkspace],
  );

  const addConversion = useCallback(
    (conversion: ContentConversion) => {
      updateWorkspace((current) => ({
        contentConversions: upsertByKey(
          current.contentConversions,
          conversion,
          (entry) => entry.contentItemId,
        ),
      }));
    },
    [updateWorkspace],
  );

  const updateConversion = useCallback(
    (conversion: ContentConversion) => {
      updateWorkspace((current) => ({
        contentConversions: replaceByKey(
          current.contentConversions,
          conversion,
          (entry) => entry.contentItemId,
        ),
      }));
    },
    [updateWorkspace],
  );

  const resetWorkspace = useCallback(() => {
    const nextWorkspace = createDefaultWorkspaceState();

    commitWorkspaceState(nextWorkspace);
  }, [commitWorkspaceState]);

  const exportWorkspace = useCallback(() => {
    return serializeWorkspaceExport(currentWindowWorkspace ?? workspaceRef.current);
  }, []);

  const importWorkspace = useCallback(
    async (json: string) => {
      const result = importWorkspaceStateFromJson(json);
      if (!result.success) return { success: false, message: result.errors.join("；") };
      await flushWorkspaceWrites().catch(() => undefined);
      const expected = window.localStorage.getItem(workspaceStorageKeys.workspaceState);
      const prompt = "从备份恢复会替换当前学习数据。请先导出当前内容；原始已保存数据也会保留在本机安全副本中。是否继续？";
      if (!window.confirm(workspaceRef.current.languageSettings.uiLanguage === "en" ? translateUiText(prompt) : prompt)) return { success: false, message: "已取消恢复。" };
      try {
        const restored = await runWorkspaceWrite(() => restoreBrowserWorkspace(json, expected));
        currentWindowWorkspace = restored.workspace;
        workspaceRef.current = restored.workspace;
        setWorkspaceState(restored.workspace);
        setWorkspaceReadFailure("");
        let warning = restored.statusWarning;
        try { resolveDesktopRecovery("browser-cache", restoredDesktopRecoveryKey); }
        catch { warning = "内容已保存，但保存状态缓存未能更新。请导出备份。"; }
        restoredDesktopRecoveryKey = undefined;
        setLastUpdatedAt(restored.updatedAt);
        setWorkspaceFileMessage(warning || "已从备份恢复学习数据。");
        refreshStorageStatus();
        scheduleWorkspaceUpdatedEvent();
        return { success: true, message: warning || "已从备份恢复学习数据。" };
      } catch (error) {
        const message = error instanceof Error ? error.message : "恢复失败，原数据未被替换。";
        setWorkspaceFileMessage(message);
        return { success: false, message };
      }
    },
    [refreshStorageStatus],
  );

  const reloadBrowserWorkspace = useCallback(async () => {
    const prompt = "加载已保存版本会替换当前恢复内容。请先下载恢复副本。是否继续？";
    const text = workspaceRef.current.languageSettings.uiLanguage === "en" ? translateUiText(prompt) : prompt;
    if (!window.confirm(text)) return false;
    try {
      await flushWorkspaceWrites().catch(() => undefined);
      const saved = await createBrowserLocalStorageAdapter().loadWorkspace();
      if (!saved) return false;
      resolveDesktopRecovery("browser-cache", restoredDesktopRecoveryKey);
      restoredDesktopRecoveryKey = undefined;
      currentWindowWorkspace = saved;
      workspaceRef.current = saved;
      setWorkspaceState(saved);
      setWorkspaceReadFailure("");
      setWorkspaceFileMessage("已加载浏览器保存的版本。");
      refreshStorageStatus();
      scheduleWorkspaceUpdatedEvent();
      return true;
    } catch (error) {
      setWorkspaceFileMessage(error instanceof Error ? error.message : "读取工作区失败。");
      return false;
    }
  }, [refreshStorageStatus]);

  const openWorkspaceFile = useCallback(async () => {
    try {
      await flushWorkspaceWrites().catch(() => undefined);
      if (getWorkspaceReadFailure()) {
        const prompt = "打开磁盘文件会替换当前显示的恢复内容。建议先另存恢复副本。仍要继续吗？";
        if (!window.confirm(workspaceRef.current.languageSettings.uiLanguage === "en" ? translateUiText(prompt) : prompt)) return false;
      }
      const result = await openWorkspaceFileFromDisk();

      if (!result) {
        setWorkspaceFileMessage("已取消打开工作区。");
        return false;
      }

      const nextWorkspace = result.workspace;
      const updatedAt = new Date().toISOString();

      writeLocalObject(workspaceStorageKeys.workspaceState, nextWorkspace);
      writeLocalObject(workspaceStorageKeys.workspaceUpdatedAt, updatedAt);
      setWorkspaceReadFailure("");
      resolveDesktopRecovery(result.metadata.filePath!, restoredDesktopRecoveryKey);
      restoredDesktopRecoveryKey = undefined;
      currentWindowWorkspace = nextWorkspace;
      workspaceRef.current = nextWorkspace;
      setWorkspaceState(nextWorkspace);
      setLastUpdatedAt(updatedAt);
      setWorkspaceFile(result.metadata);
      storageAdapterRef.current = createDesktopWorkspaceFileAdapter(
        () => workspaceFileRef.current,
        setWorkspaceFile,
      );
      refreshStorageStatus();
      setWorkspaceFileMessage("已打开工作区文件。");
      scheduleWorkspaceUpdatedEvent();

      return true;
    } catch (error) {
      setWorkspaceFileMessage(
        error instanceof Error ? error.message : "打开工作区失败。",
      );
      return false;
    }
  }, [refreshStorageStatus, setWorkspaceFile]);

  const saveWorkspaceFile = useCallback(async () => {
    if (getWorkspaceReadFailure()) {
      setWorkspaceFileMessage(getWorkspaceReadFailure());
      return false;
    }
    try {
      const result = await runWorkspaceWrite(async () => {
        const saved = await saveWorkspaceFileToDisk(currentWindowWorkspace ?? workspaceRef.current, readWorkspaceFileSession(), { backup: true });
        if (saved) setWorkspaceFile(saved);
        return saved;
      });

      if (!result) {
        setWorkspaceFileMessage("已取消保存。");
        return false;
      }

      setWorkspaceFile(result);
      refreshStorageStatus();
      setWorkspaceFileMessage("工作区文件已保存。");

      return true;
    } catch (error) {
      setWorkspaceFileMessage(
        error instanceof Error ? error.message : "工作区保存失败，请检查文件是否仍可写入。",
      );
      return false;
    }
  }, [refreshStorageStatus, setWorkspaceFile]);

  const saveWorkspaceFileAs = useCallback(async () => {
    try {
      await flushWorkspaceWrites().catch(() => undefined);
      const recoveryPath = workspaceFileRef.current.filePath ?? "browser-cache";
      const result = await runWorkspaceWrite(async () => {
        const saved = await saveWorkspaceFileToDisk(currentWindowWorkspace ?? workspaceRef.current, readWorkspaceFileSession(), { saveAs: true, backup: true });
        if (saved) {
          setWorkspaceFile(saved);
          setWorkspaceReadFailure("");
        }
        return saved;
      });

      if (!result) {
        setWorkspaceFileMessage("已取消另存为。");
        return false;
      }

      setWorkspaceFile(result);
      if (recoveryPath) resolveDesktopRecovery(recoveryPath, restoredDesktopRecoveryKey);
      restoredDesktopRecoveryKey = undefined;
      setWorkspaceReadFailure("");
      refreshStorageStatus();
      setWorkspaceFileMessage("已另存为新的工作区文件。");

      return true;
    } catch (error) {
      setWorkspaceFileMessage(
        error instanceof Error ? error.message : "另存为失败。",
      );
      return false;
    }
  }, [refreshStorageStatus, setWorkspaceFile]);

  const exportWorkspaceFile = useCallback(async () => {
    try {
      const result = await exportWorkspaceFileToDisk(currentWindowWorkspace ?? workspaceRef.current, workspaceFileRef.current);

      if (!result) {
        setWorkspaceFileMessage("已取消导出。");
        return false;
      }

      setWorkspaceFile(result);
      refreshStorageStatus();
      setWorkspaceFileMessage("工作区 JSON 已导出。");

      return true;
    } catch (error) {
      setWorkspaceFileMessage(
        error instanceof Error ? error.message : "导出 JSON 失败。",
      );
      return false;
    }
  }, [refreshStorageStatus, setWorkspaceFile]);

  const importWorkspaceFile = useCallback(async () => {
    try {
      await flushWorkspaceWrites().catch(() => undefined);
      const result = await importWorkspaceFileFromDisk();

      if (!result) {
        setWorkspaceFileMessage("已取消导入。");
        return false;
      }

      const updatedAt = new Date().toISOString();

      writeLocalObject(workspaceStorageKeys.workspaceState, result.workspace);
      writeLocalObject(workspaceStorageKeys.workspaceUpdatedAt, updatedAt);
      setWorkspaceReadFailure("");
      currentWindowWorkspace = result.workspace;
      workspaceRef.current = result.workspace;
      setWorkspaceState(result.workspace);
      setLastUpdatedAt(updatedAt);
      setWorkspaceFile({
        storageMode: "browser-cache",
        backupCount: 0,
        lastOpenedAt: result.metadata.lastOpenedAt,
      });
      refreshStorageStatus();
      setWorkspaceFileMessage("JSON 已导入。请保存或另存为工作区文件。");
      scheduleWorkspaceUpdatedEvent();

      return true;
    } catch (error) {
      setWorkspaceFileMessage(
        error instanceof Error ? error.message : "导入 JSON 失败。",
      );
      return false;
    }
  }, [refreshStorageStatus, setWorkspaceFile]);

  const migrateLocalStorageToWorkspaceFile = useCallback(async () => {
    try {
      const result = await runWorkspaceWrite(() => saveWorkspaceFileToDisk(currentWindowWorkspace ?? workspaceRef.current, workspaceFileRef.current, {
        saveAs: true,
        backup: true,
      }));

      if (!result) {
        setWorkspaceFileMessage("已取消迁移。");
        return false;
      }

      setWorkspaceFile(result);
      setWorkspaceReadFailure("");
      resolveDesktopRecovery("browser-cache", restoredDesktopRecoveryKey);
      restoredDesktopRecoveryKey = undefined;
      refreshStorageStatus();
      setWorkspaceFileMessage("已从临时工作区迁移为工作区文件。");

      return true;
    } catch (error) {
      setWorkspaceFileMessage(
        error instanceof Error ? error.message : "迁移到工作区文件失败。",
      );
      return false;
    }
  }, [refreshStorageStatus, setWorkspaceFile]);

  return {
    workspace,
    reloadBrowserWorkspace,
    lastUpdatedAt,
    workspaceFile,
    workspaceFileMessage,
    storageStatus,
    isDesktopStorageAvailable: isTauriDesktop(),
    setWorkspace,
    updateWorkspace,
    addContentItem,
    updateContentItem,
    commitEntryToWorkspace,
    setCurrentContentId,
    addOffer,
    updateOffer,
    addPublishPackage,
    updatePublishPackage,
    addVideoGenerationDraft,
    updateVideoGenerationDraft,
    addConversion,
    updateConversion,
    resetWorkspace,
    exportWorkspace,
    importWorkspace,
    openWorkspaceFile,
    saveWorkspaceFile,
    saveWorkspaceFileAs,
    exportWorkspaceFile,
    importWorkspaceFile,
    migrateLocalStorageToWorkspaceFile,
  };
}

function createCurrentWorkspaceStorageAdapter(
  getSession: () => WorkspaceFileSession,
  onSaved: (session: WorkspaceFileSession) => void,
) {
  return isTauriDesktop()
    ? createDesktopWorkspaceFileAdapter(getSession, onSaved)
    : createWorkspaceStorageAdapter();
}

function createInitialStorageStatus(): WorkspaceStorageStatus {
  return {
    kind: "browser",
    isDesktop: false,
    hasOpenedWorkspaceFile: false,
    isUsingFallbackStorage: true,
  };
}

function scheduleWorkspaceUpdatedEvent() {
  if (typeof window === "undefined") {
    return;
  }

  window.setTimeout(() => {
    window.dispatchEvent(new CustomEvent(WORKSPACE_UPDATED_EVENT));
  }, 0);
}

function upsertByKey<T>(items: T[], nextItem: T, getKey: (item: T) => string) {
  const nextKey = getKey(nextItem);
  const exists = items.some((item) => getKey(item) === nextKey);

  return exists ? replaceByKey(items, nextItem, getKey) : [nextItem, ...items];
}

function replaceByKey<T>(items: T[], nextItem: T, getKey: (item: T) => string) {
  const nextKey = getKey(nextItem);

  return items.map((item) => (getKey(item) === nextKey ? nextItem : item));
}

function upsertManyByKey<T>(items: T[], nextItems: T[], getKey: (item: T) => string) {
  return nextItems.reduce((current, nextItem) => upsertByKey(current, nextItem, getKey), items);
}

function reuseSourceMaterialForContentItem(
  sourceMaterials: SourceMaterial[],
  nextSourceMaterial: SourceMaterial,
  contentItemId: string,
) {
  const existing = sourceMaterials.find(
    (sourceMaterial) => sourceMaterial.metadata?.contentItemId === contentItemId,
  );

  if (!existing) {
    return nextSourceMaterial;
  }

  return {
    ...nextSourceMaterial,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
}

function pushRecentId(ids: string[], nextId: string) {
  return [nextId, ...ids.filter((id) => id !== nextId)].slice(0, 12);
}
