"use client";


import { useLearningUi } from "@/src/components/LanguageProvider";
import { useRef, useState } from "react";
import Link from "next/link";
import { useWorkspaceStore } from "@/src/lib/useWorkspaceStore";
import type { WorkspaceFileSession } from "@/src/lib/workspace/desktopStorage";
import type { WorkspaceStorageStatus } from "@/src/lib/workspace/storageAdapter";

export type WorkspaceStatusSummary = {
  label: string;
  detail: string;
  actionLabel: string;
  fileName: string;
  isOpenedFile: boolean;
  isFileUnavailable: boolean;
};

export function WorkspaceFileControls({ manage = false }: { manage?: boolean }) {
  const { t } = useLearningUi();
  const {
    isDesktopStorageAvailable,
    storageStatus,
    workspaceFile,
    workspaceFileMessage,
    saveWorkspaceFile,
    saveWorkspaceFileAs,
    openWorkspaceFile,
    exportWorkspaceFile,
    importWorkspaceFile,
    exportWorkspace,
    importWorkspace,
    reloadBrowserWorkspace,
  } = useWorkspaceStore();
  const [busyAction, setBusyAction] = useState("");
  const [restoreMessage, setRestoreMessage] = useState("");
  const backupInput = useRef<HTMLInputElement>(null);

  const summary = getWorkspaceStatusSummary({ workspaceFile, storageStatus });
  const needsAttention = summary.isFileUnavailable || workspaceMessageNeedsAttention(workspaceFileMessage);

  const downloadRecovery = () => {
    const url = URL.createObjectURL(new Blob([exportWorkspace()], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url; link.download = "verniq-recovery.json"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (!manage) {
    return needsAttention ? (
      <div role="alert" className="bg-amber-100 px-5 py-3 text-sm text-amber-950">
        <p>{t(workspaceFileMessage || summary.detail)}</p>
        <div className="mt-2 flex gap-4">
          <button type="button" onClick={downloadRecovery}>{t("下载恢复副本")}</button>
          {isDesktopStorageAvailable ? (
            <button type="button" onClick={() => runAction("open", setBusyAction, openWorkspaceFile)} disabled={Boolean(busyAction)}>{t("重新打开数据文件")}</button>
          ) : <button type="button" onClick={() => void reloadBrowserWorkspace()}>{t("加载已保存版本")}</button>}
          <Link href="/config-center#workspace-data">{t("数据与备份")}</Link>
        </div>
      </div>
    ) : null;
  }

  return (
    <section id="workspace-data" className="scroll-mt-32 rounded-[1.75rem] border border-stone-200 bg-white p-6 sm:p-8">
      <h2 className="text-2xl font-semibold">{t("数据与备份")}</h2>
      <p className="mt-3 text-sm leading-7 text-stone-600">{t("这里管理全部学习材料、词汇、进度和创作草稿的数据文件。文章导入请使用顶部的“导入”。")}</p>
      <p className="mt-2 text-xs leading-6 text-stone-500">{t("导出备份不含 API 密钥和自定义 Header 值，换设备后请重新填写。")}</p>
      <div className="mt-4 space-y-4">
        <div className="text-sm leading-7 text-stone-600">
          <p className="font-semibold text-stone-900">{t(summary.label)}</p>
          <p>
            {summary.isOpenedFile ? `${t("文件位置：")}${workspaceFile.filePath}` : t(summary.detail)}
          </p>
          {workspaceFile.lastSavedAt ? (
            <p>
              {t("最近保存：")}{formatCompactTime(workspaceFile.lastSavedAt)}
              {typeof workspaceFile.backupCount === "number"
                ? ` · ${t("自动备份")} ${workspaceFile.backupCount} ${t("次")}`
                : ""}
            </p>
          ) : null}
          {workspaceFileMessage ? <p className="text-stone-500">{t(workspaceFileMessage)}</p> : null}
          {!summary.isOpenedFile ? <p>{t("当前数据保存在本机缓存中。清除应用数据前请先导出备份；桌面版可选择一个数据文件自动保存。")}</p> : null}
        </div>

        {isDesktopStorageAvailable ? <div className="flex flex-wrap gap-2">
          <ActionButton
            label={t("打开学习数据文件")}
            busy={busyAction === "open"}
            onClick={() => runAction("open", setBusyAction, openWorkspaceFile)}
          />
          <ActionButton
            label={t(summary.isOpenedFile ? "立即保存" : "选择数据文件保存")}
            busy={busyAction === "save"}
            onClick={() => runAction("save", setBusyAction, saveWorkspaceFile)}
          />
          {summary.isOpenedFile ? <ActionButton
            label={t("另存数据文件")}
            busy={busyAction === "saveAs"}
            onClick={() => runAction("saveAs", setBusyAction, saveWorkspaceFileAs)}
          /> : null}
          <ActionButton
            label={t("导出全部数据备份")}
            busy={busyAction === "export"}
            onClick={() => runAction("export", setBusyAction, exportWorkspaceFile)}
          />
          <ActionButton
            label={t("从备份恢复")}
            busy={busyAction === "import"}
            onClick={() => runAction("import", setBusyAction, importWorkspaceFile)}
          />

        </div> : <div className="flex flex-wrap gap-2">
          <button type="button" className="brand-control-pill px-4 py-2 text-sm" onClick={downloadRecovery}>{t("导出全部数据备份")}</button>
          <button type="button" disabled={Boolean(busyAction)} className="brand-control-pill px-4 py-2 text-sm disabled:opacity-40" onClick={() => backupInput.current?.click()}>{t("从备份恢复")}</button>
          <input ref={backupInput} type="file" accept=".json,application/json" aria-label={t("选择学习数据备份")} className="sr-only" onChange={async event => {
            const file = event.target.files?.[0]; event.target.value = "";
            if (!file) return;
            if (file.size > 25 * 1024 * 1024) { setRestoreMessage("备份超过 25 MB，请使用桌面版处理。"); return; }
            setBusyAction("import"); setRestoreMessage("");
            try { const result = await importWorkspace(await file.text()); setRestoreMessage(result.message); }
            catch { setRestoreMessage("恢复失败，原数据未被替换。"); }
            finally { setBusyAction(""); }
          }} />
        </div>}
        {restoreMessage ? <p role="status" className="text-sm leading-6">{t(restoreMessage)}</p> : null}
      </div>
    </section>
  );
}

export function getWorkspaceStatusSummary({
  workspaceFile,
  storageStatus,
}: {
  workspaceFile: WorkspaceFileSession;
  storageStatus: WorkspaceStorageStatus;
}): WorkspaceStatusSummary {
  const fileName = workspaceFile.filePath
    ? workspaceFile.filePath.split(/[/\\]/).pop() || workspaceFile.filePath
    : "";
  const isOpenedFile = workspaceFile.storageMode === "desktop-file" && Boolean(workspaceFile.filePath);
  const isFileUnavailable = Boolean(workspaceFile.filePath) && !isOpenedFile;

  if (isOpenedFile) {
    return {
      label: fileName,
      detail: storageStatus.warning || (workspaceFile.lastSavedAt
        ? `最近保存 ${formatCompactTime(workspaceFile.lastSavedAt)}`
        : "正在使用工作区文件保存。"),
      actionLabel: "管理",
      fileName,
      isOpenedFile,
      isFileUnavailable: false,
    };
  }

  if (isFileUnavailable) {
    return {
      label: "文件不可用",
      detail: "当前窗口无法访问这个工作区文件，请重新打开后再继续保存。",
      actionLabel: "打开工作区",
      fileName,
      isOpenedFile: false,
      isFileUnavailable: true,
    };
  }

  return {
    label: "保存在本机缓存",
    detail: "尚未选择学习数据文件。",
    actionLabel: "数据与备份",
    fileName: "",
    isOpenedFile: false,
    isFileUnavailable: false,
  };
}

export function workspaceMessageNeedsAttention(message: string) {
  if (!message) return false;
  if (/失败|冲突|不可用|无法|暂停|恢复副本|未保存|请勿关闭|立即导出|invalid|failed|conflict|unavailable|paused/i.test(message)) return true;
  return !/^(?:已取消|已打开工作区文件|工作区文件已保存|工作区 JSON 已导出|已另存为新的工作区文件|JSON 已导入|已从临时工作区迁移|已从备份恢复学习数据|已加载浏览器保存)/.test(message);
}

function ActionButton({
  label,
  busy,
  onClick,
}: {
  label: string;
  busy: boolean;
  onClick: () => void;
}) {
  const { t } = useLearningUi();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="brand-control-pill px-4 py-2 text-sm text-stone-700 transition hover:border-stone-300 disabled:cursor-not-allowed disabled:bg-stone-100"
    >
      {busy ? t("处理中…") : label}
    </button>
  );
}

async function runAction(
  action: string,
  setBusyAction: (value: string) => void,
  handler: () => Promise<boolean>,
) {
  setBusyAction(action);

  try {
    await handler();
  } finally {
    setBusyAction("");
  }
}

function formatCompactTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
