# Screenshots / 功能截图

[English README](../README.md) · [中文介绍](../README.zh-CN.md)

These are screenshots of the actual production web bundle in separate, fresh browser contexts. Chinese UI teaches English; English UI teaches Chinese. Materials and notes are original demonstration content. No personal workspace, API key, simulated AI reply or fabricated connection result is included. Writing screenshots show editable demonstration drafts and AI controls, not claimed live AI results. Screenshots illustrate the web interface, not an installed Windows release.

以下截图来自实际生产网页版本，使用全新、相互隔离的浏览器会话。中文界面学英语，英文界面学中文。材料与笔记均为原创演示内容，不包含私人工作区、密钥、模拟 AI 回答或伪造的连接状态。创作页展示可编辑的演示草稿和 AI 入口，不代表真实模型生成结果；这些截图不代表 Windows 安装包验收。

| Feature / 功能 | 中文界面 | English interface |
| --- | --- | --- |
| Home / 首页：继续阅读、到期复习、创作 | ![中文首页](screenshots/zh-CN/home.png) | ![English home](screenshots/en/home.png) |
| Import / 导入：粘贴、链接、文档、图片 | ![中文导入](screenshots/zh-CN/import.png) | ![English import](screenshots/en/import.png) |
| Reader / 阅读：就近划词与双语词典 | ![中文阅读与查词](screenshots/zh-CN/reader.png) | ![English reader and lookup](screenshots/en/reader.png) |
| Review / 复习：先回忆，再揭示答案 | ![中文复习](screenshots/zh-CN/review.png) | ![English review](screenshots/en/review.png) |
| Notes / 笔记：自己的总结与思考 | ![中文笔记](screenshots/zh-CN/notes.png) | ![English note](screenshots/en/notes.png) |
| Writing / 创作：多材料、主题、反思与编辑 | ![中文创作](screenshots/zh-CN/writing.png) | ![English writing](screenshots/en/writing.png) |
| Share card / 卡片：字体、构图、署名与 PNG | ![中文分享卡片](screenshots/zh-CN/card.png) | ![English share card](screenshots/en/card.png) |
| AI setup / 设置：自定义地址、协议与模型 ID | ![中文 AI 配置](screenshots/zh-CN/settings.png) | ![English AI setup](screenshots/en/settings.png) |

## Recreate / 重新拍摄

Build the source first, then serve the production output on a local port. Run the capture script in another terminal. It creates demonstration data only in its isolated browser contexts, does not open your browser profile, and makes no AI requests. It needs an installed Edge on Windows, or a Playwright Chromium installation elsewhere; `VERNIQ_BROWSER_PATH` can select an executable. Do not edit source during the build.

先构建源码并启动本地生产预览，再在另一个终端运行截图脚本。脚本仅在隔离浏览器会话内创建演示数据，不读取用户浏览器配置，不发起 AI 请求。Windows 默认使用已安装的 Edge，其他系统需安装 Playwright Chromium；也可用 `VERNIQ_BROWSER_PATH` 指定浏览器。构建期间请勿修改源码。

```powershell
npm ci
npm run build
npm run serve:out
```

```powershell
node scripts/capture-docs.mjs
```

`VERNIQ_DOCS_URL` overrides `http://127.0.0.1:3000`. [manifest.json](screenshots/manifest.json) records the served build identity, screenshot hashes and dimensions. New screenshots change the source tree, so build again before running verification that requires an exact source hash.

`VERNIQ_DOCS_URL` 可覆盖默认预览地址。[manifest.json](screenshots/manifest.json) 记录被拍摄构建的身份、截图哈希和尺寸。生成截图会改变源码树，运行严格匹配源码哈希的生产验证前需重新构建。
