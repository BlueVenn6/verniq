import {
  OUTPUT_FORMAT_LABELS,
  PUBLISH_MODE_LABELS,
  REWRITE_DEPTH_LABELS,
} from "@/src/lib/routing";
import { useLearningUi } from "@/src/components/LanguageProvider";
import type { PublishingRecommendation, RoutingRule } from "@/src/lib/types";

type RoutingRecommendationCardProps = {
  recommendation: PublishingRecommendation;
  matchedRules: RoutingRule[];
};

export function RoutingRecommendationCard({
  recommendation,
  matchedRules,
}: RoutingRecommendationCardProps) {
  const { t } = useLearningUi();
  return (
    <aside className="rounded-[1.5rem] border border-stone-200 bg-white p-5 shadow-sm shadow-stone-200/60">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-stone-950">{t("整理建议")}</h3>
        <span className="rounded-full bg-stone-900 px-3 py-1 text-xs font-semibold text-white">
          {t(PUBLISH_MODE_LABELS[recommendation.publishMode])}
        </span>
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <p className="text-xs font-semibold text-stone-500">{t("适合发去哪里")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {recommendation.recommendedPlatforms.map((platform) => (
              <span
                key={platform.id}
                className="rounded-full border border-stone-200 bg-[#fbfaf7] px-3 py-1 text-xs text-stone-700"
              >
                {platform.name}
              </span>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-stone-500">{t("可以整理成什么")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {recommendation.recommendedOutputFormats.map((format) => (
              <span
                key={format}
                className="rounded-full border border-stone-200 bg-[#fbfaf7] px-3 py-1 text-xs text-stone-700"
              >
                {t(OUTPUT_FORMAT_LABELS[format])}
              </span>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-3xl bg-[#fbfaf7] p-4">
            <p className="text-xs font-semibold text-stone-500">{t("整理程度")}</p>
            <p className="mt-2 text-sm text-stone-700">
              {t(REWRITE_DEPTH_LABELS[recommendation.rewriteDepth])}
            </p>
          </div>
          <div className="rounded-3xl bg-[#fbfaf7] p-4">
            <p className="text-xs font-semibold text-stone-500">{t("下一步")}</p>
            <p className="mt-2 text-sm leading-7 text-stone-700">{t(recommendation.cta)}</p>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-stone-500">{t("为什么这样建议")}</p>
          <p className="mt-2 text-sm leading-7 text-stone-700">
            {t(recommendation.explanation)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {matchedRules.length ? (
              matchedRules.map((rule) => (
                <span
                  key={rule.id}
                  className="rounded-full border border-stone-200 bg-[#fbfaf7] px-3 py-1 text-xs text-stone-600"
                >
                  {rule.name}
                </span>
              ))
            ) : (
              <span className="rounded-full border border-stone-200 bg-[#fbfaf7] px-3 py-1 text-xs text-stone-600">
                {t("暂时没有命中特定规则")}
              </span>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
