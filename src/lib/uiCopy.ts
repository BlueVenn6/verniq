import { zhCNCopy } from "@/src/lib/copy/zhCN";

export const UI_COPY_ZH = {
  home: {
    title: zhCNCopy.home.heroTitle,
    subtitle: zhCNCopy.home.heroSubtitle,
    webDemoNotice: zhCNCopy.home.webDemoNotice,
    webDemoStatus: zhCNCopy.home.webDemoStatus,
    actions: {
      importMaterial: zhCNCopy.home.importMaterial,
      importMaterialHelp: zhCNCopy.home.importMaterialHelp,
      openReader: zhCNCopy.home.openReader,
      openReaderHelp: zhCNCopy.home.openReaderHelp,
      downloadDesktop: zhCNCopy.home.downloadDesktop,
      downloadDesktopHelp: zhCNCopy.home.downloadDesktopHelp,
      configureAi: zhCNCopy.home.configureAi,
      configureAiHelp: zhCNCopy.home.configureAiHelp,
    },
  },
  reader: {
    title: zhCNCopy.reader.title,
    sourceList: zhCNCopy.reader.sourceList,
    emptyTitle: zhCNCopy.reader.emptyTitle,
    emptyDescription: zhCNCopy.reader.emptyDescription,
    emptyAction: zhCNCopy.reader.emptyAction,
    intro: zhCNCopy.reader.intro,
    missingSegments: zhCNCopy.reader.missingSegments,
    missingContent: zhCNCopy.reader.missingContent,
  },
  aiKey: {
    webNotice: zhCNCopy.credential.webNotice,
    desktopNotice: zhCNCopy.credential.desktopNotice,
  },
};
