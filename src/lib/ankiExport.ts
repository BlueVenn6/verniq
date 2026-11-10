import type { ExpressionItem, VocabularyItem, WorkspaceState } from "@/src/lib/types";
import { formatDueDistance, getEffectiveSrsState } from "@/src/lib/srs";

export type AnkiExportResult = {
  fileName: string;
  content: string;
  rowCount: number;
};

type ExportableItem =
  | {
      kind: "vocabulary";
      item: VocabularyItem;
    }
  | {
      kind: "expression";
      item: ExpressionItem;
    };

export function buildAnkiTsvExport(workspace: WorkspaceState): AnkiExportResult {
  const sourceTitleMap = new Map(
    workspace.sourceMaterials.map((source) => [source.id, source.title]),
  );
  const rows = [
    ...workspace.vocabularyItems
      .filter((item) => item.status !== "ignored")
      .map((item) => ({ kind: "vocabulary" as const, item })),
    ...workspace.expressionItems
      .filter((item) => item.status !== "ignored")
      .map((item) => ({ kind: "expression" as const, item })),
  ].map((entry) => formatAnkiRow(entry, sourceTitleMap));

  return {
    fileName: `verniq-anki-export-${formatDateForFileName(new Date())}.tsv`,
    content: rows.join("\r\n"),
    rowCount: rows.length,
  };
}

export function downloadTextFile(fileName: string, content: string) {
  const blob = new Blob([content], { type: "text/tab-separated-values;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  // A detached anchor is ignored by some WebView2 and Firefox embedding modes,
  // which would make this silently do nothing while the UI reports success.
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking synchronously can cancel the download before it starts.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function formatAnkiRow(
  entry: ExportableItem,
  sourceTitleMap: Map<string, string>,
) {
  const item = entry.item;
  const srs = getEffectiveSrsState(item);
  const front = item.text;
  const back =
    entry.kind === "vocabulary"
      ? [entry.item.meaningZh, entry.item.meaningEn].filter(Boolean).join(" / ") || entry.item.lemma
      : entry.item.meaningZh || entry.item.usageNote || entry.item.meaningEn;
  const meta =
    entry.kind === "vocabulary"
      ? entry.item.partOfSpeech || "vocabulary"
      : entry.item.type || "expression";
  const sourceTitle = sourceTitleMap.get(item.sourceMaterialId) ?? "";
  const tags = [
    "verniq",
    entry.kind,
    ...item.tags,
    item.language ? `lang:${item.language}` : "",
  ].filter(Boolean);

  return [
    front,
    [entry.kind === "vocabulary" ? entry.item.pronunciation : "", back].filter(Boolean).join(" · "),
    item.sentence,
    sourceTitle,
    meta,
    tags.join(" "),
    item.status,
    `stage ${item.stage}`,
    srs.dueAt,
    formatDueDistance(srs.dueAt),
  ].map(escapeTsvCell).join("\t");
}

function escapeTsvCell(value: string | number | undefined) {
  const normalized = String(value ?? "")
    .replace(/\r?\n/g, "<br>")
    .replace(/\t/g, " ")
    .trim();

  if (/^[=+\-@\r]/.test(normalized)) {
    return `'${normalized}`;
  }

  return normalized;
}

function formatDateForFileName(date: Date) {
  return date.toISOString().slice(0, 10);
}
