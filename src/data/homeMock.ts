import type { HomePageData } from "@/src/lib/types";
import {
  PRODUCT_NAME,
  WEB_DEMO_STORAGE_NOTICE_ZH,
} from "@/src/lib/branding";
import { UI_COPY_ZH } from "@/src/lib/uiCopy";

export const homePageData: HomePageData = {
  topNav: {
    productName: PRODUCT_NAME,
    items: [
      {
        label: "首页",
        href: "/",
      },
      {
        label: "导入",
        href: "/inbox",
        matchPrefixes: ["/inbox"],
      },
      {
        label: "阅读器",
        href: "/reader",
        matchPrefixes: ["/reader"],
      },
      {
        label: "复习",
        href: "/review",
        matchPrefixes: ["/review"],
      },
      {
        label: "积累",
        href: "/growth",
        matchPrefixes: ["/growth"],
      },
      {
        label: "发布",
        href: "/publish",
        matchPrefixes: ["/publish"],
      },
      {
        label: "设置",
        href: "/config-center",
        matchPrefixes: ["/config-center"],
      },
    ],
    identityLabel: "我",
    privacyNote: WEB_DEMO_STORAGE_NOTICE_ZH,
  },
  hero: {
    greeting: "Read what matters. Make it your own.",
    title: UI_COPY_ZH.home.title,
    subtitle: UI_COPY_ZH.home.subtitle,
    statusLine: "本地保存 · 无需注册 · 支持自有 AI",
    actions: [
      {
        label: UI_COPY_ZH.home.actions.importMaterial,
        href: "/inbox",
        helperText: UI_COPY_ZH.home.actions.importMaterialHelp,
      },
      {
        label: UI_COPY_ZH.home.actions.openReader,
        href: "/reader",
        helperText: UI_COPY_ZH.home.actions.openReaderHelp,
      },
      {
        label: "复习词汇",
        href: "/review",
        helperText: "复习从阅读器保存的词汇和表达。",
      },
    ],
  },
  focusSummary: {
    title: "学习概览",
    mainFocusAreas: ["学习材料", "阅读器"],
    lessAttendedArea: "费曼笔记",
    strongestGrowthArea: "词汇表达",
    summaryText:
      "先从一篇学习材料开始，读完后保存词汇和表达，再写一段自己的理解。",
  },
  lifeMapIntro: {
    title: "学习材料场景",
    subtitle:
      "学习材料可以来自工作、健康、兴趣，也可以来自你想表达清楚的个人经验。",
  },
  lifeAreas: [
    {
      slug: "work",
      href: "/areas/work",
      title: "工作",
      currentFocus: "用工作邮件、行业文章、报告和会议表达来学习目标语言。",
      lifeProgress: [
        "行业文章",
        "工作邮件",
        "会议记录",
      ],
      languageGrowth: [
        "专业词汇",
        "正式表达",
        "常用回复",
      ],
      currentBlock: "适合训练准确、清楚、有边界的表达。",
      primaryAction: "导入工作材料",
      secondaryActions: ["打开阅读器", "设置学习语言"],
    },
    {
      slug: "body",
      href: "/areas/body",
      title: "健康",
      currentFocus: "阅读健康、运动、饮食和身体相关材料，积累相关表达。",
      lifeProgress: [
        "健康文章",
        "营养说明",
        "运动计划",
      ],
      languageGrowth: [
        "身体部位",
        "症状描述",
        "习惯表达",
      ],
      currentBlock: "适合训练信息理解、风险判断和日常说明。",
      primaryAction: "导入健康材料",
      secondaryActions: ["打开阅读器", "保存表达"],
    },
    {
      slug: "hobby",
      href: "/areas/hobby",
      title: "兴趣",
      currentFocus: "用你真正感兴趣的内容保持阅读动力。",
      lifeProgress: [
        "长文",
        "访谈",
        "教程",
      ],
      languageGrowth: [
        "主题词汇",
        "观点表达",
        "复述练习",
      ],
      currentBlock: "适合把阅读兴趣变成稳定输入和自己的理解。",
      primaryAction: "导入兴趣材料",
      secondaryActions: ["写费曼笔记", "整理写作草稿"],
    },
    {
      slug: "relationship",
      href: "/areas/relationship",
      title: "关系与自我",
      currentFocus: "练习表达观点、情绪、边界和个人经历。",
      lifeProgress: [
        "个人叙事",
        "沟通文章",
        "观点短文",
      ],
      languageGrowth: [
        "情绪词汇",
        "边界表达",
        "经历描述",
      ],
      currentBlock: "适合训练更具体、更准确地说明自己。",
      primaryAction: "导入表达材料",
      secondaryActions: ["保存短语", "写费曼笔记"],
    },
  ],
  crossDomainIntro: {
    title: "条条大路通罗马",
    subtitle: "你在一个领域的训练与模式习惯，常常也会复刻去其他领域。",
  },
  crossDomainHints: [
    {
      text: "你在工作里慢慢养成的“先问清楚”，也会帮助你更自然地探究身体上的困惑。",
    },
    {
      text: "你最近在兴趣里培养出来的阅读节奏，也会帮助你理解工作上的难题。",
    },
    {
      text: "你在关系中协作出的柔和表达，也会让工作沟通更加流畅。",
    },
  ],
  quickActionsIntro: {
    title: "现在就做",
    subtitle: "不用重新安排日程，接着今天已经开始的地方继续。",
  },
  quickActions: [
    {
      title: "继续未完成事项",
      href: "/tasks",
      description: "回到今天已经开始、但尚未完成的事项。",
    },
    {
      title: "读懂一篇材料",
      href: "/reader",
      description: "阅读、分析，再用自己的话把理解讲清楚。",
    },
    {
      title: "写一个回复",
      href: "/inbox",
      description:
        "不管是工作、身体、兴趣，还是关系里的回应，都可以先起个头。",
    },
    {
      title: "一句话理顺",
      href: "/inbox",
      description:
        "把脑子里那句模模糊糊的话，先整理成你能说出口的最佳表达。",
    },
  ],
  growthToday: {
    title: "学习积累",
    subtitle:
      "阅读后保存下来的内容：词汇、表达、笔记和草稿。",
    newTermsCount: 12,
    newExpressionsCount: 5,
    newTemplatesCount: 1,
    personalInsightCount: 2,
    strongestArea: "阅读器",
    expressionToCarryTomorrow: "方便的话，再确认一下。",
  },
  eveningReview: {
    title: "学习收尾",
    summary:
      "读完后，用自己的话写一段解释。\n这一步会影响后续写作草稿的质量。",
    strongestArea: "已读材料",
    neglectedArea: "未写笔记",
    keyGrowthType: "费曼解释",
    primaryAction: "打开阅读器",
    secondaryAction: "导入材料",
  },
};
