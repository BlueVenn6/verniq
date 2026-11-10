"use client";

import { useState } from "react";
import { useLearningUi } from "@/src/components/LanguageProvider";
import { listProviderModels, type ListedModel } from "@/src/lib/llm/modelCatalog";
import type { AiProviderConfig } from "@/src/lib/types";

export function ModelCatalog({ provider, onSelect }: { provider: AiProviderConfig; onSelect: (id: string) => void }) {
  const { english, t } = useLearningUi();
  const [models, setModels] = useState<ListedModel[]>([]);
  const [message, setMessage] = useState("");
  const [listing, setListing] = useState<{ count: number; partial: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const load = async () => {
    setBusy(true); setMessage(""); setModels([]); setListing(null);
    try {
      const result = await listProviderModels(provider);
      setModels(result.models);
      setListing({ count: result.models.length, partial: result.partial });
    } catch (error) { setMessage(error instanceof Error ? error.message : "Model list request failed."); }
    finally { setBusy(false); }
  };
  return <div className="space-y-3 rounded-xl border border-stone-200 bg-[#fbfaf7] p-4">
    <p className="text-xs leading-6 text-stone-600">{english
      ? "Presets may become outdated. Fetch your provider's current model list or enter its exact ID. Existing custom IDs are never replaced automatically."
      : "预设模型可能失效。可从当前服务获取模型列表，或手动填写服务商提供的准确 ID；不会自动替换你的自定义模型。"}</p>
    <button disabled={busy} type="button" onClick={load} className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm disabled:opacity-50">{busy ? (english ? "Fetching…" : "获取中…") : (english ? "Fetch available models" : "获取服务端模型列表")}</button>
    {listing ? <p role="status" className="text-xs leading-6">{english
      ? `${listing.count} visible models${listing.partial ? " (partial list)" : ""}. A listing is not a successful inference test; test the selected model before use.`
      : `获取到 ${listing.count} 个可见模型${listing.partial ? "（部分列表）" : ""}。可见不代表可调用，选中后仍需验证；列表缺失也不能直接判定为退役。`}</p> : null}
    {message ? <p role="status" className="text-xs leading-6">{t(message)}</p> : null}
    {models.length ? <>
      <input aria-label={english ? "Filter models" : "筛选模型"} placeholder={english ? "Filter models" : "筛选模型"} value={query} onChange={(event) => setQuery(event.target.value)} className="w-full rounded-lg border border-stone-300 p-2 text-sm" />
      <div className="max-h-52 overflow-auto">{models.filter((model) => `${model.id} ${model.name}`.toLowerCase().includes(query.toLowerCase())).map((model) => (
        <button type="button" key={model.id} onClick={() => onSelect(model.id)} className="block w-full border-b border-stone-200 py-2 text-left text-sm">{model.id}</button>
      ))}</div>
    </> : null}
  </div>;
}
