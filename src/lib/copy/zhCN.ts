export const zhCNCopy = {
  nav: {
    home: "首页",
    inbox: "导入",
    reader: "阅读器",
    settings: "设置",
    identity: "我",
  },
  home: {
    heroTitle: "今天继续读点什么？",
    heroSubtitle:
      "阅读感兴趣的内容，积累词汇与表达，再通过复述加深理解。",
    webDemoNotice:
      "Verniq 网页版适合临时体验，不适合长期保存学习资料。完整的本地工作区请使用桌面版。",
    webDemoStatus: "免费临时体验。无需账号。不做云端存储。可使用自己的 AI 密钥。",
    importMaterial: "导入学习材料",
    importMaterialHelp: "粘贴正文、添加链接或选择文件，保存到工作区。",
    openReader: "打开阅读器",
    openReaderHelp: "继续阅读、查词、分析材料，并保存有用表达。",
    downloadDesktop: "下载桌面版",
    downloadDesktopHelp: "即将推出。一次性购买，本地长期保存。",
    configureAi: "配置 AI",
    configureAiHelp: "设置学习语言、解释语言和自己的 AI 密钥。",
  },
  reader: {
    title: "阅读器",
    sourceList: "学习材料",
    emptyTitle: "还没有可阅读的材料",
    emptyDescription:
      "导入文章、链接或文件后，就可以在这里阅读、查词并保存词汇和表达。",
    emptyAction: "导入材料",
    intro: "点击段落记录阅读位置，选词后就近查看释义；需要记录或 AI 分析时再打开学习工具。",
    missingSegments: "当前材料已有正文，但暂无分段。请重新打开本页，或回到导入页重新保存一次。",
    missingContent: "当前材料没有可阅读正文，可能是材料为空或解析失败。请回到导入页重新粘贴正文或重新导入。",
    saveVocabulary: "保存为词汇",
    saveExpression: "保存为表达",
    analyzeMaterial: "分析材料",
    feynmanNote: "费曼笔记",
    outputDraft: "写作草稿",
  },
  settings: {
    languageTitle: "语言设置",
    languageDescription: "设置界面语言、学习语言，以及 AI 解释时使用的语言。",
    languageSummaryPrefix: "界面",
    aiTitle: "AI 设置",
    aiDescription:
      "配置 AI 服务、服务地址、API 密钥和实际发送给服务商的模型 ID。",
    aiNoAi: "不使用 AI",
    aiNoAiDescription: "仍可导入材料、阅读、查词、保存词汇和写费曼笔记。",
    aiRemote: "使用自己的 AI 服务",
    aiRemoteDescription: "使用你自己的 AI 密钥调用远程模型。发送前 Verniq 会显示发送范围。",
    aiLocal: "仅使用本地模型",
    aiLocalDescription: "适合 Ollama / LM Studio。材料不发送给远程 AI 服务。",
    aiService: "选择 AI 服务",
    aiSecret: "API 密钥",
    saveAiSecret: "保存密钥",
    modelForLanguageAnalysis: "学习分析模型",
    modelForFeynman: "费曼反馈模型",
    modelForOutput: "写作整理模型",
    advancedSettings: "连接设置",
    advancedDescription:
      "可配置 AI 服务、服务地址、认证方式、模型 ID、任务路由和密钥引用。",
  },
  credential: {
    webNotice:
      "网页模式只在当前会话中临时保存密钥，关闭或清理浏览器数据后需要重新填写。",
    desktopNotice:
      "密钥将安全保存在系统凭据存储中，不会写入工作区文件。",
    legacyWarning: "当前仍在使用旧的明文 API 密钥。系统凭据存储可用时，建议迁移。",
  },
  workspace: {
    localCache: "当前工作区：临时工作区",
    open: "打开",
    save: "保存",
    saveAs: "另存为",
    export: "导出",
    import: "导入",
    migrate: "迁移",
  },
};

export type ZhCNCopy = typeof zhCNCopy;
