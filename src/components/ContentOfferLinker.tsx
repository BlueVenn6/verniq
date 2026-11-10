import { CONVERSION_STATUS_LABELS, OFFER_STATUS_LABELS } from "@/src/lib/offers";
import { useLearningUi } from "@/src/components/LanguageProvider";
import type {
  ContentConversion,
  OfferRecommendation,
} from "@/src/lib/types";

type ContentOfferLinkerProps = {
  recommendation: OfferRecommendation;
  conversion?: ContentConversion;
  fallbackCTA?: string;
};

export function ContentOfferLinker({
  recommendation,
  conversion,
  fallbackCTA,
}: ContentOfferLinkerProps) {
  const { t } = useLearningUi();
  const cta = recommendation.offer?.primaryCTA || fallbackCTA || t("继续观察这条内容的回流");

  return (
    <aside className="rounded-[1.5rem] border border-stone-200 bg-white p-5 shadow-sm shadow-stone-200/60">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-stone-950">{t("内容 × 产品")}</h3>
        <span className="rounded-full border border-stone-200 bg-[#fbfaf7] px-3 py-1 text-xs text-stone-600">
          {conversion
            ? t(CONVERSION_STATUS_LABELS[conversion.conversionStatus])
            : t("暂无转化记录")}
        </span>
      </div>

      {recommendation.offer ? (
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-xs font-semibold text-stone-500">{t("可能接上的产品")}</p>
            <p className="mt-2 text-lg font-semibold text-stone-950">
              {recommendation.offer.name}
            </p>
            <p className="mt-2 text-sm leading-7 text-stone-600">
              {t(recommendation.explanation)}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <MetricBlock title="CTA" value={cta} />
            <MetricBlock
              title={t("当前阶段")}
              value={t(OFFER_STATUS_LABELS[recommendation.offer.status])}
            />
          </div>

          {/* These counts only exist once a conversion record does. Showing four
              zeros would imply the app measures conversions when it does not. */}
          {conversion ? (
            <div className="grid grid-cols-4 gap-2">
              <StatChip label={t("点击")} value={conversion.clicks ?? 0} />
              <StatChip label={t("订阅")} value={conversion.subscribers ?? 0} />
              <StatChip label={t("咨询")} value={conversion.inquiries ?? 0} />
              <StatChip label={t("购买")} value={conversion.purchases ?? 0} />
            </div>
          ) : (
            <p className="text-xs leading-6 text-stone-500">
              {t("当前版本不统计点击或购买数据，这里只显示内容与产品的对应关系。")}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-4 text-sm leading-7 text-stone-600">{t(recommendation.explanation)}</p>
      )}
    </aside>
  );
}

function MetricBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-3xl bg-[#fbfaf7] p-4">
      <p className="text-xs font-semibold text-stone-500">{title}</p>
      <p className="mt-2 text-sm leading-7 text-stone-700">{value}</p>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl bg-[#fbfaf7] p-3 text-center">
      <p className="text-xs font-semibold text-stone-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-stone-900">{value}</p>
    </div>
  );
}
