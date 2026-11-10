"use client";

import { FullTextSelect } from "@/src/components/FullTextSelect";


import { useLearningUi } from "@/src/components/LanguageProvider";
import {
  PUBLISH_BRAND_MODES,
  PUBLISH_LAYOUTS,
  PUBLISH_RATIOS,
  type PublishBrandMode,
  type PublishLayoutId,
  type PublishRatioId,
  type PublishVisualSettings,
  type PublishCardFontId,
  resolvePublishLayout,
} from "@/src/lib/publish/publishPresets";

type PublishVisualControlsProps = {
  enabled: boolean;
  settings: PublishVisualSettings;
  imageName: string;
  onChange: (patch: Partial<PublishVisualSettings>) => void;
  onImageChange: (file: File | null) => void;
  onLogoChange: (file: File | null) => void;
};

export function PublishVisualControls({
  enabled,
  settings,
  imageName,
  onChange,
  onImageChange,
  onLogoChange,
}: PublishVisualControlsProps) {
  const { t } = useLearningUi();
  const layout = resolvePublishLayout(settings.layout, settings.ratioId);
  if (!enabled) {
    return (
      <section className="rounded-[1.25rem] border border-stone-200 bg-white p-5 text-sm leading-7 text-stone-600 shadow-sm shadow-stone-200/60">
        {t("选择“分享卡片”后，可以设置比例、图片和品牌显示。")}</section>
    );
  }

  return (
    <section className="rounded-[1.25rem] border border-stone-200 bg-white p-5 shadow-sm shadow-stone-200/60">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">{t("设计卡片")}</p>
        <h2 className="mt-2 text-xl font-semibold text-stone-950">{t("设置卡片呈现")}</h2>
        <p className="mt-2 text-sm leading-7 text-stone-600">
          {t("选择字体和排版，预览与 PNG 保持一致。配图与文字分区显示，不会铺成文字背景。")}</p>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold">{t("卡片字体")}
          <FullTextSelect aria-label={t("卡片字体")} value={settings.fontFamily || "serif"} onChange={event => onChange({ fontFamily: event.target.value as PublishCardFontId })} className="mt-2 w-full rounded-xl border border-stone-200 p-3 font-normal">
            <option value="serif">{t("思源宋体 · Noto Serif SC")}</option>
            <option value="sans">{t("思源黑体 · Noto Sans SC")}</option>
          </FullTextSelect>
        </label>
        <label className="block text-sm font-semibold">{t("文字粗细")}
          <FullTextSelect aria-label={t("文字粗细")} value={settings.fontWeight || 600} onChange={event => onChange({ fontWeight: Number(event.target.value) })} className="mt-2 w-full rounded-xl border border-stone-200 p-3 font-normal">
            <option value={400}>{t("常规")}</option><option value={600}>{t("半粗")}</option><option value={700}>{t("加粗")}</option>
          </FullTextSelect>
        </label>
        <label className="block text-sm font-semibold">{t("字号")}
          <span className="ml-2 font-normal">{Math.round((settings.fontScale || 1.4) * 100)}%</span>
          <input aria-label={t("卡片字号")} type="range" min={80} max={200} step={5} value={Math.round((settings.fontScale || 1.4) * 100)} onChange={event => onChange({ fontScale: Number(event.target.value) / 100 })} className="mt-4 block w-full" />
        </label>
        <label className="block text-sm font-semibold">{t("文字对齐")}
          <FullTextSelect aria-label={t("文字对齐")} value={settings.textAlign || "left"} onChange={event => onChange({ textAlign: event.target.value as "left" | "center" })} className="mt-2 w-full rounded-xl border border-stone-200 p-3 font-normal">
            <option value="left">{t("左对齐")}</option><option value="center">{t("居中对齐")}</option>
          </FullTextSelect>
        </label>
      </div>
      <p className="mt-3 text-xs leading-6 text-stone-500">{t("两款字体均支持中英文，按 SIL OFL 1.1 授权可商用，随应用提供。放大后放不下时，请缩小字号或精简文字。")}</p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold text-stone-700">{t("比例")}</span>
          <FullTextSelect
            aria-label={t("比例")}
            value={settings.ratioId}
            onChange={(event) => onChange({ ratioId: event.target.value as PublishRatioId })}
            className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800"
          >
            {PUBLISH_RATIOS.map((ratio) => (
              <option key={ratio.id} value={ratio.id}>
                {ratio.label} · {t(ratio.fit)}
              </option>
            ))}
          </FullTextSelect>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-stone-700">{t("品牌显示")}</span>
          <FullTextSelect
            aria-label={t("品牌显示")}
            value={settings.brandMode}
            onChange={(event) => onChange({ brandMode: event.target.value as PublishBrandMode })}
            className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800"
          >
            {PUBLISH_BRAND_MODES.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {t(brand.label)}
              </option>
            ))}
          </FullTextSelect>
        </label>
      </div>

      {settings.brandMode === "custom_name" ? <label className="mt-4 block text-sm font-semibold">
        {t("你的名字或署名")}<input aria-label={t("你的名字或署名")} maxLength={60} value={settings.customName || ""} onChange={(event) => onChange({ customName: event.target.value })} className="mt-2 w-full rounded-xl border border-stone-300 p-3 font-normal" />
      </label> : null}
      {settings.brandMode === "custom_logo" ? <label className="mt-4 block text-sm font-semibold">
        {t("上传自己的 Logo")}<span className="mt-2 inline-block cursor-pointer rounded-lg border border-stone-300 px-3 py-2">{t("选择 Logo 图片")}<input aria-label={t("上传自己的 Logo")} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => onLogoChange(event.target.files?.[0] ?? null)} className="sr-only" /></span>
        <span className="mt-2 block text-xs font-normal text-stone-500">{settings.logoDataUrl ? t("Logo 已加入，可重新选择或移除。") : t("支持 PNG、JPEG、WebP，最大 2 MB。")}</span>
        {settings.logoDataUrl ? <button type="button" onClick={() => onLogoChange(null)} className="mt-2 text-xs underline">{t("移除 Logo")}</button> : null}
      </label> : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold text-stone-700">{t("版式")}</span>
          <FullTextSelect
            aria-label={t("版式")}
            value={layout}
            onChange={(event) => onChange({ layout: event.target.value as PublishLayoutId })}
            className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800"
          >
            {PUBLISH_LAYOUTS.map((layout) => (
              <option key={layout.id} value={layout.id}>
                {t(layout.label)}
              </option>
            ))}
          </FullTextSelect>
        </label>

        {layout !== "pure_text" && imageName ? <label className="block text-sm font-semibold">
          {t("图片缩放")}<span className="ml-2 font-normal">{Math.round((settings.imageZoom || 1) * 100)}%</span>
          <input aria-label={t("图片缩放")} type="range" min={100} max={300} step={5} value={Math.round((settings.imageZoom || 1) * 100)} onChange={event => onChange({ imageZoom: Number(event.target.value) / 100 })} className="mt-5 block w-full" />
        </label> : null}
      </div>
      <p className="mt-3 text-sm leading-7 text-stone-600">{t(PUBLISH_LAYOUTS.find(option => option.id === layout)?.description || "")}</p>

      {layout !== "pure_text" ? <div className="mt-4 rounded-xl border border-dashed border-stone-300 bg-[#fbfaf7] px-4 py-4 text-sm text-stone-700">
        <label className="inline-block cursor-pointer rounded-lg border border-stone-300 px-3 py-2 font-semibold">{imageName ? t("更换卡片配图") : t("选择卡片配图")}
        <input
          aria-label={t("卡片配图")}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => onImageChange(event.target.files?.[0] ?? null)}
          className="sr-only"
        />
        </label>
        {imageName ? <button type="button" onClick={() => onImageChange(null)} className="ml-3 text-xs underline">{t("移除配图")}</button> : null}
        {imageName ? <button type="button" onClick={() => onChange({ imageZoom: 1, imagePositionX: 0.5, imagePositionY: 0.5, imageCrop: "center" })} className="ml-3 text-xs underline">{t("重置构图")}</button> : null}
        <span className="mt-2 block text-xs leading-6 text-stone-500">
          {imageName || t("请选一张配图；上传后在右侧预览位置和裁切效果。")}
        </span>
        <p className="mt-2 text-xs leading-6 text-stone-500">{t("在预览图片上拖动调整构图。缩放和位置随草稿保存，配图需重新选择。")}</p>
      </div> : null}
    </section>
  );
}
