import { homePageData } from "@/src/data/homeMock";

export type AreaSlug = "work" | "body" | "hobby" | "relationship";

export type AreaTask = {
  title: string;
  status: string;
  detail: string;
};

export type AreaPageData = {
  slug: AreaSlug;
  title: string;
  subtitle: string;
  currentFocus: string;
  lifeProgress: string[];
  notes: string[];
  currentBlock: string;
  recentTasks: AreaTask[];
  bestNext?: string;
  primaryAction: {
    label: string;
    href: string;
  };
};

const areasBySlug = Object.fromEntries(
  homePageData.lifeAreas.map((area) => [area.slug, area]),
);

export const areaPages: Record<AreaSlug, AreaPageData> = {
  work: {
    slug: "work",
    title: "工作",
    subtitle: "先把最该处理的那件事接住，其他的慢慢排开。",
    currentFocus: areasBySlug.work.currentFocus,
    lifeProgress: areasBySlug.work.lifeProgress,
    notes: areasBySlug.work.languageGrowth,
    currentBlock: areasBySlug.work.currentBlock,
    recentTasks: [
      {
        title: "回复项目里的确认消息",
        status: "做到一半",
        detail: "意思已经想清楚了，还差一句更稳的开头。",
      },
      {
        title: "整理今天收到的资料",
        status: "刚开始",
        detail: "先把要点拆出来，再决定要不要继续追问。",
      },
      {
        title: "跟进上周没收口的事项",
        status: "尚未开始",
        detail: "适合用一段简短回复先把节奏接回来。",
      },
    ],
    bestNext: "最适合现在继续做的事：先把项目里的确认消息写顺。",
    primaryAction: {
      label: "去写一个回复",
      href: "/inbox",
    },
  },
  body: {
    slug: "body",
    title: "身体",
    subtitle: "不用一下子变好，先照顾今天能照顾到的部分。",
    currentFocus: areasBySlug.body.currentFocus,
    lifeProgress: areasBySlug.body.lifeProgress,
    notes: areasBySlug.body.languageGrowth,
    currentBlock: areasBySlug.body.currentBlock,
    recentTasks: [
      {
        title: "看完那份健康信息",
        status: "做到一半",
        detail: "重点已经看到了，还可以顺手记下两个问法。",
      },
      {
        title: "把晚睡原因写清楚",
        status: "刚开始",
        detail: "不用写很多，先记下一条主要原因。",
      },
      {
        title: "调整明天的吃饭安排",
        status: "尚未开始",
        detail: "先定一个容易做到的小调整。",
      },
    ],
    primaryAction: {
      label: "看懂一个内容",
      href: "/inbox",
    },
  },
  hobby: {
    slug: "hobby",
    title: "兴趣",
    subtitle: "把看到的东西留下一点，兴趣就不会只是划过去。",
    currentFocus: areasBySlug.hobby.currentFocus,
    lifeProgress: areasBySlug.hobby.lifeProgress,
    notes: areasBySlug.hobby.languageGrowth,
    currentBlock: areasBySlug.hobby.currentBlock,
    recentTasks: [
      {
        title: "继续读今天打开的那篇内容",
        status: "做到一半",
        detail: "还有一段没看完，可以先抓住主线。",
      },
      {
        title: "把一个新主题写成一句话",
        status: "刚开始",
        detail: "不用完整，先写你现在的理解。",
      },
      {
        title: "整理两个想继续看的方向",
        status: "尚未开始",
        detail: "把好奇心先放到一个地方。",
      },
    ],
    primaryAction: {
      label: "一句话理顺",
      href: "/inbox",
    },
  },
  relationship: {
    slug: "relationship",
    title: "关系和自己",
    subtitle: "有些话不用急着说完，先把心里的顺序理出来。",
    currentFocus: areasBySlug.relationship.currentFocus,
    lifeProgress: areasBySlug.relationship.lifeProgress,
    notes: areasBySlug.relationship.languageGrowth,
    currentBlock: areasBySlug.relationship.currentBlock,
    recentTasks: [
      {
        title: "写下那句没说出口的话",
        status: "刚开始",
        detail: "先不判断对错，只把想表达的意思写下来。",
      },
      {
        title: "整理一次情绪变化",
        status: "做到一半",
        detail: "已经记了开头，还差一个更准确的描述。",
      },
      {
        title: "给一段关系里的回复降温",
        status: "尚未开始",
        detail: "可以先换成更平一点的说法。",
      },
    ],
    primaryAction: {
      label: "一句话理顺",
      href: "/inbox",
    },
  },
};

export const areaSlugs = Object.keys(areaPages) as AreaSlug[];
