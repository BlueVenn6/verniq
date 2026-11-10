"use client";

import { useLearningUi } from "@/src/components/LanguageProvider";

// Keep one expandable guide for both first-time setup and existing providers.
export function AiConfigurationHelp() {
  const { t } = useLearningUi();
  const items = [
    ["服务地址与接口", "服务地址填写服务商文档中的 API Base URL，不是官网或控制台网址。Endpoint 是接口路径；保留默认值，除非服务商要求修改。下方会显示实际请求地址。"],
    ["接入协议怎么选", "协议决定请求格式，不是模型名称。OpenAI 和兼容中转通常使用 Chat Completions；Claude 原生使用 Messages。通过中转使用 Claude 时，以中转商提供的协议为准。"],
    ["模型 ID 与任务模型", "模型 ID 必须与服务商提供的名称一致。预设只帮助填写，不代表你的账号有权限使用。任务路由决定阅读、词句解释和创作分别使用哪个模型。"],
    ["文字、识图与生图验证", "测试连接只验证文字请求。提取截图文字还需要验证模型能接收图片；生成或编辑图片使用独立的 Images API，不能用生图验证代替识图验证。"],
    ["密钥、隐私与费用", "密钥由你选择的服务商提供。网页版仅在当前浏览器会话保存密钥；桌面版的实际存储方式会显示在下方。学习数据备份不包含密钥。验证和正式使用都会请求服务商，可能消耗其额度；发送材料前请检查范围。"],
    ["失败时检查什么", "401 / 403：检查密钥和权限；404：检查地址、协议和模型 ID；429：检查额度或调用频率。超时可减少材料或调整超时时间。验证成功不代表每个任务都已验证。"],
  ];
  return <details className="mt-3 text-sm text-stone-600">
    <summary className="w-fit cursor-pointer font-semibold underline underline-offset-4">{t("首次配置？查看填写说明")}</summary>
    <dl className="mt-4 grid min-w-0 gap-x-6 gap-y-4 md:grid-cols-2">
      {items.map(([label, description]) => <div key={label} className="min-w-0">
        <dt className="font-semibold text-stone-900">{t(label)}</dt>
        <dd className="mt-1 leading-7">{t(description)}</dd>
      </div>)}
    </dl>
  </details>;
}
