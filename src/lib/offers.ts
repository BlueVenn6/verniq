import type {
  ContentConversion,
  ContentPipelineItem,
  ConversionSummary,
  Offer,
  OfferRecommendation,
} from "@/src/lib/types";

export const OFFER_TYPE_LABELS: Record<Offer["offerType"], string> = {
  service: "服务",
  template: "模板",
  tool: "工具",
  report: "报告",
  waitlist: "候补名单",
  lead_magnet: "引导内容",
};

export const OFFER_STATUS_LABELS: Record<Offer["status"], string> = {
  idea: "想法中",
  draft: "草稿中",
  testable: "可测试",
  selling: "销售中",
  paused: "暂停中",
};

export const CONVERSION_STATUS_LABELS: Record<ContentConversion["conversionStatus"], string> = {
  none: "暂无回流记录",
  clicked: "已经有人点击",
  subscribed: "已经有人订阅",
  inquired: "已经有人咨询",
  purchased: "已经产生购买",
};

const OFFER_STATUS_SCORE: Record<Offer["status"], number> = {
  idea: 1,
  draft: 2,
  testable: 3,
  selling: 4,
  paused: 0,
};

const CATEGORY_LABELS: Record<string, string> = {
  "ai-llm": "AI/LLM",
  "work-tools": "工具工作流",
  "symbol-culture": "符号文化",
  "cross-cultural-expression": "跨文化表达",
  "overseas-work": "海外工作",
  "platform-ecosystem": "平台生态",
  "life-management": "生活管理",
  "healthy-life": "健康生活",
};

const PRODUCT_LABELS: Record<string, string> = {
  "picture-seo-studio": "Picture SEO Studio",
  "avatar-localization-tool": "Avatar Localization Tool",
  "dream-symbol-tool": "Dream Symbol Tool",
  "life-os": "Life OS",
};

export function recommendOfferForContent(
  contentItem: ContentPipelineItem,
  offers: Offer[],
  uiLanguage: string = "zh-CN",
): OfferRecommendation {
  const eligibleOffers = offers
    .map((offer) => ({
      offer,
      score: scoreOfferMatch(contentItem, offer),
    }))
    .filter((item) => item.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.offer.name.localeCompare(right.offer.name, "zh-CN"),
    );

  const matched = eligibleOffers[0]?.offer ?? null;

  if (!matched) {
    return {
      offer: null,
      explanation: "这条内容暂时没有特别贴合的产品，可以先继续观察点击和订阅，再决定是否单独整理一个轻量引导内容。",
    };
  }

  const categoryText = joinList(
    contentItem.categoryIds.map((item) => CATEGORY_LABELS[item] ?? item),
  );
  const productText = contentItem.productIds?.length
    ? `，又和${joinList(
        contentItem.productIds.map((item) => PRODUCT_LABELS[item] ?? item),
      )}有关`
    : "";

  return {
    offer: matched,
    explanation: uiLanguage === "en"
      ? `${matched.name} is the closest match based on the content categories, platforms and product links.`
      : `这条内容属于${categoryText || "当前主题"}${productText}，更适合接到 ${matched.name}，因为它能更自然地接住这类读者的下一步需求。`,
  };
}

export function getConversionSummary(
  contentConversions: ContentConversion[],
): ConversionSummary {
  const totalClicks = sumBy(contentConversions, "clicks");
  const totalSubscribers = sumBy(contentConversions, "subscribers");
  const totalInquiries = sumBy(contentConversions, "inquiries");
  const totalPurchases = sumBy(contentConversions, "purchases");

  const offerScores = new Map<string, number>();

  contentConversions.forEach((item) => {
    if (!item.linkedOfferId) return;

    const nextScore =
      (offerScores.get(item.linkedOfferId) ?? 0) +
      item.clicks +
      item.subscribers * 3 +
      item.inquiries * 6 +
      item.purchases * 10;

    offerScores.set(item.linkedOfferId, nextScore);
  });

  const bestOfferId =
    [...offerScores.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "";

  return {
    totalClicks,
    totalSubscribers,
    totalInquiries,
    totalPurchases,
    bestOfferId,
    suggestedNextAction: buildSuggestedNextAction(bestOfferId, totalInquiries, totalPurchases),
  };
}

function scoreOfferMatch(contentItem: ContentPipelineItem, offer: Offer) {
  const categoryMatches = countMatches(contentItem.categoryIds, offer.relatedCategoryIds);
  const platformMatches = countMatches(
    contentItem.targetPlatformIds ?? [],
    offer.relatedPlatformIds,
  );
  const productMatch =
    offer.linkedProductId &&
    (contentItem.productIds ?? []).includes(offer.linkedProductId)
      ? 5
      : 0;
  const directLinkMatch = contentItem.linkedOfferId === offer.id ? 6 : 0;
  const statusScore = OFFER_STATUS_SCORE[offer.status];

  return categoryMatches * 4 + platformMatches * 2 + productMatch + directLinkMatch + statusScore;
}

function countMatches(left: string[], right: string[]) {
  if (!left.length || !right.length) return 0;
  return left.filter((value) => right.includes(value)).length;
}

function sumBy(
  items: ContentConversion[],
  key: keyof Pick<
    ContentConversion,
    "clicks" | "subscribers" | "inquiries" | "purchases"
  >,
) {
  return items.reduce((total, item) => total + item[key], 0);
}

function buildSuggestedNextAction(
  bestOfferId: string,
  totalInquiries: number,
  totalPurchases: number,
) {
  if (bestOfferId === "avatar-bio-localization") {
    return "当前 Avatar & Bio Localization 已经产生咨询，建议优先把跨文化表达内容继续改写成 LinkedIn 和 Medium 版本，再测试更直接的个人主页 CTA。";
  }

  if (bestOfferId === "content-to-product-rewrite-pack") {
    return "当前 Content-to-Product Rewrite Pack 已经证明有人会点击和购买，建议优先扩写平台生态与内容产品化主题，并把 CTA 放到 WordPress 和 Medium 长文结尾。";
  }

  if (bestOfferId === "ai-image-metadata-pack") {
    return "当前 AI Image Metadata Pack 已经接近可卖状态，建议继续投放 AI/LLM 与工具工作流内容，并把 CTA 固定在 SEO 类文章的开头和结尾。";
  }

  if (totalPurchases > 0) {
    return "已经出现购买，建议把当前最强主题继续做成系列内容，并把 CTA 从轻引导升级成明确下单方式。";
  }

  if (totalInquiries > 0) {
    return "已经出现咨询，建议优先补齐交付说明、案例和 CTA 位置，再继续测试同主题内容。";
  }

  return "目前还在积累点击与订阅，建议先保留轻量产品想法，用连续内容测试读者真正需要哪一步。";
}

function joinList(values: string[]) {
  if (!values.length) return "";
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} 和 ${values[1]}`;
  return `${values.slice(0, -1).join("、")} 和 ${values[values.length - 1]}`;
}
