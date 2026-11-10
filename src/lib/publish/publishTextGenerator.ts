import type { OutputDraft } from "@/src/lib/types";
import type { PublishDraftSettings, PublishGeneratedDraft } from "@/src/lib/publish/publishPresets";
import type { PublishSource } from "@/src/lib/publish/publishSources";

export function generateLocalPublishDraft({ sources, settings }: {
  sources: PublishSource[];
  settings: PublishDraftSettings;
}): PublishGeneratedDraft {
  const title = settings.purpose.trim() || sources[0]?.title.trim() || "";
  const body = sources.map((source) => source.content || source.summary).filter(Boolean).join("\n\n");
  const sourceLabel = sources.filter((source) => source.kind !== "custom").map((source) => source.title).join(" · ");
  const markdown = body ? [title ? `# ${title}` : "", body, sourceLabel ? `Source: ${sourceLabel}` : ""].filter(Boolean).join("\n\n") : "";
  return { title, subtitle: "", body, markdown, sourceLabel };
}

export function createOutputDraftFromPublishDraft({ draft, sources, outputType }: {
  draft: PublishGeneratedDraft; sources: PublishSource[]; outputType: OutputDraft["outputType"];
}): OutputDraft {
  const now = new Date().toISOString();
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    sourceMaterialId: sources[0]?.sourceMaterialId ?? "", feynmanNoteId: sources[0]?.feynmanNoteId ?? "",
    knowledgeNodeId: "", outputType, title: draft.title, content: draft.markdown,
    status: "draft", createdAt: now, updatedAt: now,
  };
}

export function getPublishOutputDraftType(mode: PublishDraftSettings["mode"]): OutputDraft["outputType"] {
  return mode === "card" ? "plan" : "blog";
}
