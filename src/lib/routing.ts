import type {
  ContentPipelineItem,
  OutputFormat,
  PlatformConfig,
  ProductConfig,
  PublishingRecommendation,
  RoutingConfigs,
  RoutingRule,
} from "@/src/lib/types";
import { translateUiText } from "@/src/lib/copy/en";

export const OUTPUT_FORMAT_LABELS: Record<OutputFormat, string> = {
  wordpress_article: "WordPress 主站文章",
  medium_article: "Medium 改写稿",
  substack_newsletter: "Substack newsletter",
  x_thread: "X thread",
  linkedin_post: "LinkedIn 帖子",
  devto_article: "Dev.to 文章",
  youtube_shorts_script: "YouTube Shorts 脚本",
  seo_metadata: "SEO metadata",
  product_faq: "产品 FAQ",
  custom: "自定义输出",
};

export const PUBLISH_MODE_LABELS = {
  manual: "手动发布",
  draft: "先生成草稿",
  auto: "自动发布",
} as const;

export const REWRITE_DEPTH_LABELS = {
  light: "轻改写",
  medium: "中等改写",
  deep: "深度改写",
} as const;

const DEFAULT_CTA = "如果这条内容对你有帮助，欢迎继续关注后续更新。";

export function matchRoutingRules(
  contentItem: ContentPipelineItem,
  routingRules: RoutingRule[],
) {
  return [...routingRules]
    .filter((rule) => rule.enabled && matchesRule(contentItem, rule))
    .sort((left, right) => {
      if (left.priority !== right.priority) {
        return right.priority - left.priority;
      }

      return left.name.localeCompare(right.name, "zh-CN");
    });
}

export function recommendPublishingPlan(
  contentItem: ContentPipelineItem,
  configs: RoutingConfigs,
  routingRules: RoutingRule[],
  uiLanguage: string = "zh-CN",
): PublishingRecommendation {
  const normalizedItem = normalizeContentItem(contentItem, configs);
  const matchedRules = matchRoutingRules(normalizedItem, routingRules);
  const enabledPlatforms = configs.platformConfigs.filter((platform) => platform.enabled);
  const platformMap = new Map(enabledPlatforms.map((platform) => [platform.id, platform]));
  const recommendedPlatforms = uniquePlatforms(
    matchedRules.flatMap((rule) => rule.then.platformIds),
    platformMap,
  );
  const resolvedPlatforms = recommendedPlatforms.length
    ? recommendedPlatforms
    : enabledPlatforms.slice(0, 2);
  const recommendedOutputFormats = uniqueOutputFormats(
    matchedRules.flatMap((rule) => rule.then.outputFormats),
  );
  const resolvedOutputFormats = recommendedOutputFormats.length
    ? recommendedOutputFormats
    : uniqueOutputFormats(
        resolvedPlatforms.flatMap((platform) => platform.supportedFormats),
      ).slice(0, 3);
  const topRule = matchedRules[0];
  const publishMode = topRule?.then.publishMode ?? resolvedPlatforms[0]?.publishMode ?? "draft";
  const rewriteDepth = topRule?.then.rewriteDepth ?? "medium";
  const cta =
    matchedRules.find((rule) => rule.then.defaultCTA?.trim())?.then.defaultCTA?.trim() ??
    resolveProductCTA(normalizedItem.productIds, configs.productConfigs) ??
    DEFAULT_CTA;

  return {
    recommendedPlatforms: resolvedPlatforms,
    recommendedOutputFormats: resolvedOutputFormats,
    publishMode,
    rewriteDepth,
    cta,
    matchedRuleIds: matchedRules.map((rule) => rule.id),
    explanation: buildExplanation(
      normalizedItem,
      configs,
      matchedRules,
      resolvedPlatforms,
      resolvedOutputFormats,
      publishMode,
      uiLanguage,
    ),
  };
}

function matchesRule(contentItem: ContentPipelineItem, rule: RoutingRule) {
  return (
    matchesIdGroup(contentItem.sourceTypeId ? [contentItem.sourceTypeId] : [], rule.when.sourceTypeIds) &&
    matchesIdGroup(contentItem.categoryIds, rule.when.categoryIds) &&
    matchesIdGroup(contentItem.moduleIds ?? [], rule.when.moduleIds) &&
    matchesIdGroup(contentItem.productIds ?? [], rule.when.productIds) &&
    matchesKeywords(contentItem, rule.when.keywords)
  );
}

function matchesIdGroup(itemValues: string[], ruleValues?: string[]) {
  if (!ruleValues?.length) return true;
  if (!itemValues.length) return false;
  return ruleValues.some((value) => itemValues.includes(value));
}

function matchesKeywords(contentItem: ContentPipelineItem, keywords?: string[]) {
  if (!keywords?.length) return true;

  const haystack = [
    contentItem.title,
    contentItem.description,
    ...(contentItem.keywords ?? []),
  ]
    .join(" ")
    .toLocaleLowerCase();

  return keywords.some((keyword) => haystack.includes(keyword.toLocaleLowerCase()));
}

function uniquePlatforms(platformIds: string[], platformMap: Map<string, PlatformConfig>) {
  const used = new Set<string>();
  const platforms: PlatformConfig[] = [];

  platformIds.forEach((platformId) => {
    const platform = platformMap.get(platformId);
    if (!platform || used.has(platform.id)) return;

    used.add(platform.id);
    platforms.push(platform);
  });

  return platforms;
}

function uniqueOutputFormats(formats: OutputFormat[]) {
  const used = new Set<OutputFormat>();

  return formats.filter((format) => {
    if (used.has(format)) return false;

    used.add(format);
    return true;
  });
}

function resolveProductCTA(productIds: string[] | undefined, products: ProductConfig[]) {
  if (!productIds?.length) return "";

  const product = products.find(
    (item) => item.enabled && productIds.includes(item.id) && item.defaultCTA.trim(),
  );

  return product?.defaultCTA ?? "";
}

function normalizeContentItem(
  contentItem: ContentPipelineItem,
  configs: RoutingConfigs,
): ContentPipelineItem {
  const enabledSourceTypeIds = new Set(
    configs.sourceTypeConfigs.filter((item) => item.enabled).map((item) => item.id),
  );
  const enabledCategoryIds = new Set(
    configs.categoryConfigs.filter((item) => item.enabled).map((item) => item.id),
  );
  const enabledProductIds = new Set(
    configs.productConfigs.filter((item) => item.enabled).map((item) => item.id),
  );

  return {
    ...contentItem,
    sourceTypeId: enabledSourceTypeIds.has(contentItem.sourceTypeId) ? contentItem.sourceTypeId : "",
    categoryIds: contentItem.categoryIds.filter((id) => enabledCategoryIds.has(id)),
    productIds: contentItem.productIds?.filter((id) => enabledProductIds.has(id)) ?? [],
  };
}

function buildExplanation(
  contentItem: ContentPipelineItem,
  configs: RoutingConfigs,
  matchedRules: RoutingRule[],
  platforms: PlatformConfig[],
  outputFormats: OutputFormat[],
  publishMode: "manual" | "draft" | "auto",
  uiLanguage: string,
) {
  const sourceTypeMap = new Map(configs.sourceTypeConfigs.map((item) => [item.id, item.name]));
  const categoryMap = new Map(configs.categoryConfigs.map((item) => [item.id, item.name]));
  const productMap = new Map(configs.productConfigs.map((item) => [item.id, item.name]));
  const sourceLabel = sourceTypeMap.get(contentItem.sourceTypeId) ?? "当前输入";
  const categoryLabels = contentItem.categoryIds
    .map((id) => categoryMap.get(id))
    .filter(Boolean) as string[];
  const productLabels = (contentItem.productIds ?? [])
    .map((id) => productMap.get(id))
    .filter(Boolean) as string[];
  const platformLabels = platforms.map((platform) => platform.name);
  const formatLabels = outputFormats.map((format) => OUTPUT_FORMAT_LABELS[format]);

  if (uiLanguage === "en") {
    const platformsText = platformLabels.join(", ") || "the enabled platforms";
    const formatsText = formatLabels.map(translateUiText).join(", ") || "the configured formats";
    const ruleText = matchedRules.length
      ? `Matched rule: ${matchedRules[0].name}.`
      : "No specific rule matched; using the enabled platform defaults.";
    return `${ruleText} Prepare ${formatsText} for ${platformsText}. Publishing: ${translateUiText(PUBLISH_MODE_LABELS[publishMode])}.`;
  }

  if (!matchedRules.length) {
    return `这条内容来自${sourceLabel}，当前没有命中专门规则，所以先按已启用平台给出一版通用建议：优先准备${joinList(
      platformLabels,
    )}，并生成${joinList(formatLabels)}，发布方式以${PUBLISH_MODE_LABELS[publishMode]}为主。`;
  }

  const topRule = matchedRules[0];
  const categoryPart = categoryLabels.length ? `属于${joinList(categoryLabels)}` : "当前分类还比较宽泛";
  const productPart = productLabels.length ? `，并绑定${joinList(productLabels)}` : "";
  const rulePart = `，命中了${topRule.name}`;

  return `这条内容来自${sourceLabel}，${categoryPart}${productPart}${rulePart}，因此建议优先生成${joinList(
    platformLabels,
  )}上的${joinList(formatLabels)}，发布方式以${PUBLISH_MODE_LABELS[publishMode]}为主。`;
}

function joinList(values: string[]) {
  if (!values.length) return "当前配置";
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} 和 ${values[1]}`;
  return `${values.slice(0, -1).join("、")} 和 ${values[values.length - 1]}`;
}
