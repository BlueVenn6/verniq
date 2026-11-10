# Privacy / 隐私与数据处理

[English](#verniq-data-handling) · [简体中文](#verniq-数据处理)

## Verniq data handling

This describes the current application, rather than a hosted account or payment service.

- Learning materials, notes, review progress and drafts are stored locally. The web version uses browser storage, subject to the browser's capacity and data-clearing rules. Desktop workspaces can be saved to user-selected files; temporary local recovery data also exists.
- Browser API keys are held in session storage for the current browser session. Desktop key storage uses the available native credential store; the configuration page reports its actual status. Workspace files, recovery copies and exported backups now keep only an opaque credential reference: legacy plaintext keys and custom authentication header values are removed before anything is written to disk or browser storage. Files written by earlier versions may still contain a plaintext key until they are saved again; treat those originals as private and re-save them from this version to clear the field. User-entered text can still contain private information.
- AI requests send the selected text, context, notes, history or images required by the requested task to the configured provider or relay. Consult that provider's retention and billing terms. A relay is an additional recipient. Cancelling a task locally does not guarantee that a request already accepted by a provider stops processing or billing.
- Built-in ECDICT and CC-CEDICT lookups use bundled local data. Online dictionary lookups and dictionary recordings contact the relevant external service and expose the queried term or recording URL, along with normal connection metadata. Device speech uses the operating system's speech engine; whether a particular installed voice requires a network connection depends on that engine and voice.
- Importing a URL contacts that website. Source links in exported articles are content references, rather than proof of factual accuracy. Exported text, backups and cards may include material or personal notes selected by the user; review them before sharing.
- The current product does not provide a hosted account, payment balance, shared AI quota or automatic social-platform publishing. No such service is implied by the local application.

Before a public release, the maintainer must review this description against the exact release, publish contact information and document the supported distribution and uninstall procedures. A separately hosted web deployment may have hosting access logs and policies outside this local application's code.

## Verniq 数据处理

本文描述当前应用，不代表存在托管账号或支付服务。

- 学习材料、笔记、复习进度和草稿保存在本地。网页端使用浏览器存储，受容量和清理规则影响；桌面端可保存为用户选择的工作区文件，也会保留本地临时恢复数据。
- 网页端 API 密钥存于当前浏览器会话的 sessionStorage；桌面端使用可用的系统凭据存储，设置页显示实际状态。工作区文件、恢复副本和备份仅保留不透明的凭据引用；写入前会移除旧明文密钥和自定义认证头的值。更早版本导出的文件可能仍含明文密钥，请作为私人文件保管，并用当前版本重新保存以清理相关字段。用户自己输入的文字仍可能包含私人信息。
- AI 功能会把该任务所需的选中文字、上下文、笔记、历史或图片发送给配置的服务商或中转。请查看该服务的数据保留和计费条款；中转也是数据接收方。本地取消不保证服务商已经收到的请求会停止处理或计费。
- 内置 ECDICT 和 CC-CEDICT 在本地查询。在线词典及词典录音会连接对应服务，发送查询词或录音地址及通常的连接信息。设备朗读使用操作系统语音引擎，是否联网取决于安装的语音和引擎。
- 导入网页链接会访问该网站。导出文章中的来源链接只是内容引用，不保证事实准确。导出文字、备份和卡片可能包含所选材料或私人笔记，请在分享前检查。
- 当前没有托管账号、支付余额、共享 AI 额度或社交平台自动发布服务。

公开发布前，维护者仍需对照实际发行版复核本文、提供联系信息，并说明支持的安装和卸载方式。单独托管的网站也可能产生本地应用代码范围之外的访问日志和隐私政策。
