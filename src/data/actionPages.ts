export type ActionType = "understand" | "reply" | "express";

export type ActionPageData = {
  type: ActionType;
  title: string;
  subtitle: string;
  backHref: string;
  backLabel: string;
};

export const actionPages: Record<ActionType, ActionPageData> = {
  understand: {
    type: "understand",
    title: "看懂一个内容",
    subtitle: "先把眼前这段内容看清楚，再决定下一步。",
    backHref: "/inbox",
    backLabel: "回到身体",
  },
  reply: {
    type: "reply",
    title: "写一个回复",
    subtitle: "不用一下子写完，先把原内容、起草和保留的表达放清楚。",
    backHref: "/inbox",
    backLabel: "回到工作里的回复",
  },
  express: {
    type: "express",
    title: "一句话理顺",
    subtitle: "把尚未成形的想法，整理成可以表达的句子。",
    backHref: "/inbox",
    backLabel: "保存到积累",
  },
};

export const actionTypes = Object.keys(actionPages) as ActionType[];
