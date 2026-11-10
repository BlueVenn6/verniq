"use client";

import { useMemo } from "react";
import { useLearningUi } from "@/src/components/LanguageProvider";
import { ConfigCenterSection } from "@/src/components/ConfigCenterSection";
import { ContentOfferLinker } from "@/src/components/ContentOfferLinker";
import { RoutingRecommendationCard } from "@/src/components/RoutingRecommendationCard";
import { contentModuleOptions } from "@/src/data/mockData";
import { recommendOfferForContent } from "@/src/lib/offers";
import { recommendPublishingPlan } from "@/src/lib/routing";
import { useWorkspaceStore } from "@/src/lib/useWorkspaceStore";
import type { RoutingConfigs } from "@/src/lib/types";

export function ConfigCenterWorkspacePersisted() {
  const { t } = useLearningUi();
  const { workspace, updateWorkspace } = useWorkspaceStore();

  const configs = useMemo<RoutingConfigs>(
    () => ({
      sourceTypeConfigs: workspace.sourceTypeConfigs,
      categoryConfigs: workspace.categoryConfigs,
      platformConfigs: workspace.platformConfigs,
      productConfigs: workspace.productConfigs,
    }),
    [
      workspace.categoryConfigs,
      workspace.platformConfigs,
      workspace.productConfigs,
      workspace.sourceTypeConfigs,
    ],
  );

  const sourceTypeMap = useMemo(
    () => new Map(workspace.sourceTypeConfigs.map((item) => [item.id, item.name])),
    [workspace.sourceTypeConfigs],
  );
  const categoryMap = useMemo(
    () => new Map(workspace.categoryConfigs.map((item) => [item.id, item])),
    [workspace.categoryConfigs],
  );
  const productMap = useMemo(
    () => new Map(workspace.productConfigs.map((item) => [item.id, item.name])),
    [workspace.productConfigs],
  );
  const moduleMap = useMemo(
    () => new Map(contentModuleOptions.map((item) => [item.id, item.name])),
    [],
  );
  const conversionMap = useMemo(
    () => new Map(workspace.contentConversions.map((item) => [item.contentItemId, item])),
    [workspace.contentConversions],
  );

  const pipelineCards = useMemo(
    () =>
      workspace.contentPipelineItems.map((item) => {
        const recommendation = recommendPublishingPlan(item, configs, workspace.routingRules, workspace.languageSettings.uiLanguage);

        return {
          item,
          recommendation,
          offerRecommendation: recommendOfferForContent(
            {
              ...item,
              targetPlatformIds:
                item.targetPlatformIds ??
                recommendation.recommendedPlatforms.map((platform) => platform.id),
            },
            workspace.offers,
            workspace.languageSettings.uiLanguage,
          ),
          conversion: conversionMap.get(item.id),
        };
      }),
    [
      configs,
      conversionMap,
      workspace.contentPipelineItems,
      workspace.offers,
      workspace.routingRules,
      workspace.languageSettings.uiLanguage,
    ],
  );

  return (
    <div className="space-y-6">
      <ConfigCenterSection
        aiProviders={workspace.aiProviders}
        aiModels={workspace.aiModels}
        aiTaskRouting={workspace.aiTaskRouting}
        aiContentPreferences={workspace.aiContentPreferences}
        aiPrivacySettings={workspace.aiPrivacySettings}
        languageSettings={workspace.languageSettings}
        automationConnections={workspace.automationConnections}
        sourceTypeConfigs={workspace.sourceTypeConfigs}
        categoryConfigs={workspace.categoryConfigs}
        platformConfigs={workspace.platformConfigs}
        productConfigs={workspace.productConfigs}
        routingRules={workspace.routingRules}
        onAiProvidersChange={(value) =>
          updateWorkspace({
            aiProviders: value,
          })
        }
        onAiModelsChange={(value) =>
          updateWorkspace({
            aiModels: value,
          })
        }
        onAiTaskRoutingChange={(value) =>
          updateWorkspace({
            aiTaskRouting: value,
          })
        }
        onAiContentPreferencesChange={(value) =>
          updateWorkspace({
            aiContentPreferences: value,
          })
        }
        onAiPrivacySettingsChange={(value) =>
          updateWorkspace({
            aiPrivacySettings: value,
          })
        }
        onLanguageSettingsChange={(value) =>
          updateWorkspace({
            languageSettings: value,
          })
        }
        onAutomationConnectionsChange={(value) =>
          updateWorkspace({
            automationConnections: value,
          })
        }
        onSourceTypeChange={(value) =>
          updateWorkspace((current) => ({
            sourceTypeConfigs: replaceById(current.sourceTypeConfigs, value),
          }))
        }
        onCategoryChange={(value) =>
          updateWorkspace((current) => ({
            categoryConfigs: replaceById(current.categoryConfigs, value),
          }))
        }
        onCategoryAdd={(value) =>
          updateWorkspace((current) => ({
            categoryConfigs: [value, ...current.categoryConfigs],
          }))
        }
        onPlatformChange={(value) =>
          updateWorkspace((current) => ({
            platformConfigs: replaceById(current.platformConfigs, value),
          }))
        }
        onPlatformAdd={(value) =>
          updateWorkspace((current) => ({
            platformConfigs: [value, ...current.platformConfigs],
          }))
        }
        onProductChange={(value) =>
          updateWorkspace((current) => ({
            productConfigs: replaceById(current.productConfigs, value),
          }))
        }
        onProductAdd={(value) =>
          updateWorkspace((current) => ({
            productConfigs: [value, ...current.productConfigs],
          }))
        }
        onRuleChange={(value) =>
          updateWorkspace((current) => ({
            routingRules: replaceById(current.routingRules, value),
          }))
        }
        onRuleAdd={(value) =>
          updateWorkspace((current) => ({
            routingRules: [value, ...current.routingRules],
          }))
        }
      />

      <section className="rounded-[1.75rem] border border-stone-200 bg-white p-6 shadow-sm shadow-stone-200/60 sm:p-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-stone-500">{t("内容整理")}</p>
          <h2 className="mt-2 text-2xl font-semibold text-stone-950">
            {t("查看设置如何影响内容整理")}
          </h2>
          <p className="mt-3 text-sm leading-7 text-stone-600">
            {t("展开后可查看各类内容的推荐整理方式。")}
          </p>
        </div>

        <details className="mt-6 rounded-[1.5rem] border border-stone-200 bg-[#fbfaf7] p-4">
          <summary className="cursor-pointer text-sm font-semibold text-stone-800">
            {t("查看内容整理预览")}
          </summary>
          <div className="mt-5 space-y-4">
          {pipelineCards.length === 0 ? (
            <p className="text-sm leading-7 text-stone-600">
              {t("当前还没有内容条目，所以这里没有可预览的整理建议。导入材料并保存为内容后，这里会显示对应的方式与去向。")}
            </p>
          ) : null}
          {pipelineCards.map(({ item, recommendation, offerRecommendation, conversion }) => (
            <article
              key={item.id}
              className="grid gap-4 rounded-[1.5rem] border border-stone-200 bg-[#fbfaf7] p-5 lg:grid-cols-[minmax(0,1fr)_360px]"
            >
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white px-3 py-1 text-xs text-stone-600">
                    {item.status}
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs text-stone-600">
                    {t(sourceTypeMap.get(item.sourceTypeId) ?? "未分类来源")}
                  </span>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-stone-950">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-stone-600">{item.description}</p>
                </div>

                <MetaGroup
                  label={t("内容分类")}
                  items={item.categoryIds.map((id) => categoryMap.get(id)?.name ?? id)}
                  tone="category"
                  colors={item.categoryIds.map((id) => categoryMap.get(id)?.color ?? "#e7e0d8")}
                />

                <MetaGroup
                  label={t("绑定产品")}
                  items={(item.productIds ?? []).map((id) => productMap.get(id) ?? id)}
                />

                <MetaGroup
                  label={t("内容模块")}
                  items={(item.moduleIds ?? []).map((id) => moduleMap.get(id) ?? id)}
                />
              </div>

              <div className="space-y-4">
                <RoutingRecommendationCard
                  recommendation={recommendation}
                  matchedRules={workspace.routingRules.filter((rule) =>
                    recommendation.matchedRuleIds.includes(rule.id),
                  )}
                />
                <ContentOfferLinker
                  recommendation={offerRecommendation}
                  conversion={conversion}
                  fallbackCTA={item.primaryCTA || recommendation.cta}
                />
              </div>
            </article>
          ))}
          </div>
        </details>
      </section>
    </div>
  );
}

function MetaGroup({
  label,
  items,
  tone = "default",
  colors = [],
}: {
  label: string;
  items: string[];
  tone?: "default" | "category";
  colors?: string[];
}) {
  const { t } = useLearningUi();
  return (
    <div>
      <p className="text-xs font-semibold text-stone-500">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item, index) => (
          <span
            key={`${label}-${item}`}
            className={`rounded-full px-3 py-1 text-xs ${
              tone === "category"
                ? "border border-transparent text-stone-800"
                : "border border-stone-200 bg-white text-stone-600"
            }`}
            style={
              tone === "category"
                ? { backgroundColor: colors[index] ?? "#e7e0d8" }
                : undefined
            }
          >
            {t(item)}
          </span>
        ))}
      </div>
    </div>
  );
}

function replaceById<T extends { id: string }>(items: T[], nextItem: T) {
  return items.map((item) => (item.id === nextItem.id ? nextItem : item));
}
