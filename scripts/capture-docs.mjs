// Real production UI captures, isolated demo data, no API keys or AI request mocks.
// 真实生产界面截图；隔离演示数据，不使用密钥，不伪造 AI 回答。
import { chromium } from "playwright-core";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const base = process.env.VERNIQ_DOCS_URL || "http://127.0.0.1:3000";
if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(base).hostname)) {
  throw new Error("Use a local production preview / 请使用本地生产预览。");
}
const build = await (await fetch(new URL("/verniq-build.json", base))).json();
const localBuild = JSON.parse(await readFile(resolve(root, "out/verniq-build.json"), "utf8"));
if (build.sourceSha256 !== localBuild.sourceSha256 || build.commit !== localBuild.commit) {
  throw new Error("The preview is serving a different build / 预览来自其他构建。");
}
const browser = await chromium.launch({ headless: true, ...(process.env.VERNIQ_BROWSER_PATH
  ? { executablePath: process.env.VERNIQ_BROWSER_PATH }
  : process.platform === "win32" ? { channel: "msedge" } : {}) });
const packageInfo = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const manifest = { capturedAt: new Date().toISOString(), applicationVersion: packageInfo.version, buildSourceSha256: build.sourceSha256, builtAt: build.builtAt, viewport: { width: 1440, height: 1100 },
  scope: "Actual production web UI; original demonstration content; no live AI requests or simulated replies; not an installer test.", files: [] };
const translations = {
  "材料标题": "Material title", "原始内容": "Original text", "导入并开始阅读": "Import and read",
  "划词速查": "Quick lookup", "记录到生词本": "Record word", "学习工具": "Learning tools", "保存为词汇": "Save word",
  "我的笔记": "My note", "我的总结与思考": "My summary and reflection", "保存笔记": "Save note",
  "显示释义": "Reveal answer", "标题（可选）": "Title (optional)", "自定义输入": "Your own text",
  "草稿内容": "Draft content", "保存草稿": "Save draft", "AI 创作": "Write with AI", "创作主题": "Writing topic",
  "我的思考（Reflection）": "My reflection", "写作要求或修改反馈": "Writing instructions or revision feedback", "输出语言": "Output language",
  "材料与形式": "Sources & format", "分享卡片": "Share card", "卡片内容": "Card content", "卡片样式": "Card design",
  "比例": "Dimensions", "版式": "Layout", "卡片配图": "Card image", "品牌显示": "Branding",
  "你的名字或署名": "Your name or signature", "文字粗细": "Font weight", "卡片字号": "Card text size",
  "AI 设置": "AI settings", "配置": "Configure", "OpenAI / Claude 兼容中转": "OpenAI / Claude compatible relay",
  "服务名称": "Service name", "服务地址": "Service URL", "模型 ID（必填）": "Model ID (required)",
};
try {
  for (const language of ["zh-CN", "en"]) {
    const english = language === "en", t = text => english ? (translations[text] || text) : text;
    const output = resolve(root, "docs/screenshots", language);
    await mkdir(output, { recursive: true });
    const context = await browser.newContext({ viewport: manifest.viewport, deviceScaleFactor: 1, locale: english ? "en-US" : "zh-CN" });
    await context.addInitScript(settings => {
      if (!localStorage.getItem("my-life-map:workspace:core:v1")) localStorage.setItem("my-life-map:workspace:core:v1", JSON.stringify({ schemaVersion: 5, languageSettings: settings }));
    }, { uiLanguage: language, targetLanguage: english ? "zh" : "en", explanationLanguage: language });
    const page = await context.newPage(), errors = [];
    page.on("pageerror", error => errors.push(String(error)));
    page.on("dialog", dialog => dialog.accept());
    const field = text => page.getByLabel(t(text), { exact: true });
    const button = text => page.getByRole("button", { name: t(text), exact: true });
    const tab = text => page.getByRole("tab", { name: t(text), exact: true });
    const go = path => page.goto(new URL(path, base).href);
    async function capture(name, region = page) {
      await page.evaluate(() => document.fonts.ready);
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) throw new Error(`${language}/${name}: horizontal overflow`);
      if (errors.length) throw new Error(errors.join("\n"));
      const bytes = await region.screenshot({ path: resolve(output, `${name}.png`), animations: "disabled" });
      manifest.files.push({ path: `${language}/${name}.png`, sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) });
      console.log(`Captured ${language}/${name}.png`);
    }
    const sources = english ? [
      { title: "每天读一点，留下自己的思考", text: "我们每天学习中文，也学习观察生活。读一小段文字，记住一个有用的词，再用自己的话说一遍。\n\n阅读不只是记住答案。把一句话联系到自己的经历，新的表达就有了具体的意义。\n\n我喜欢在晚上读书，写下今天的新发现。慢慢地，语言成为理解世界的另一扇窗。" },
      { title: "让练习成为日常", text: "每天留出十分钟，读书、回忆、记录。练习不需要很长，但需要持续。\n\n把昨天学过的词用在今天的句子里。记录自己的问题，也给自己留下思考的时间。" },
    ] : [
      { title: "Small steps, lasting understanding", text: "We learn through daily reading and practice. A short passage gives us useful words, a new perspective and a reason to reflect.\n\nReading becomes more meaningful when we connect a sentence with our own experience. Instead of collecting every word, choose one expression you can use today.\n\nAt the end of each reading session, close the article and explain its main idea in your own words. Return tomorrow and see what you remember." },
      { title: "Make reflection a daily habit", text: "Ten quiet minutes can make room for reading, recall and reflection. Consistent practice matters more than a perfect routine.\n\nTry using yesterday's vocabulary in a sentence about today. Keep a question beside your notes and revisit it after your next reading session." },
    ];
    async function importSource(source) {
      await go("/inbox/"); await field("材料标题").fill(source.title); await field("原始内容").fill(source.text);
      await button("导入并开始阅读").click(); await page.locator("[data-reading-segment]").first().waitFor();
    }
    await importSource(sources[1]); await go("/inbox/");
    await field("材料标题").fill(sources[0].title); await field("原始内容").fill(sources[0].text);
    await page.evaluate(() => window.scrollTo(0, 0)); await capture("import");
    await button("导入并开始阅读").click();
    const paragraph = page.locator("[data-reading-segment] p[lang]").first(); await paragraph.waitFor(); await paragraph.scrollIntoViewIfNeeded();
    const word = english ? "学习" : "learn";
    const rect = await paragraph.evaluate((element, word) => {
      const node = element.firstChild, start = node.textContent.indexOf(word);
      if (start < 0) throw new Error("Demo word missing");
      const range = document.createRange(); range.setStart(node, start); range.setEnd(node, start + word.length);
      const box = range.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width, height: box.height };
    }, word);
    if (english) {
      await page.mouse.move(rect.x + 1, rect.y + rect.height / 2); await page.mouse.down();
      await page.mouse.move(rect.x + rect.width - 1, rect.y + rect.height / 2, { steps: 8 }); await page.mouse.up();
    } else await page.mouse.dblclick(rect.x + rect.width / 2, rect.y + rect.height / 2);
    const popup = page.getByRole("dialog", { name: t("划词速查"), exact: true });
    await popup.getByText(english ? /CC-CEDICT/ : "ECDICT · MIT", { exact: !english }).first().waitFor();
    await capture("reader");
    await popup.getByRole("button", { name: t("记录到生词本"), exact: true }).click();
    await page.getByRole("region", { name: t("学习工具"), exact: true }).getByRole("button", { name: t("保存为词汇"), exact: true }).click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("my-life-map:workspace:core:v1")).vocabularyItems.length === 1);
    await go("/review/"); await button("显示释义").click(); await page.evaluate(() => window.scrollTo(0, 0)); await capture("review");
    await go("/reader/"); await tab("我的笔记").click();
    await field("我的总结与思考").fill(english
      ? "Reading is more useful when I connect it to my own life.\n\n今天我学会了“学习”。I can use one new word in a sentence, then recall it tomorrow.\n\nMy question: what will I still remember after a week?"
      : "这篇材料提醒我：阅读不只是收集单词，更要把表达联系到自己的生活。\n\n今天学到的表达：learn through practice，通过练习学习。明天先回忆，再查看答案。\n\n我还想知道：一周以后，我能否用自己的话讲清主旨？");
    await button("保存笔记").click(); await capture("notes");
    await go("/publish/");
    for (const source of sources) {
      const choice = page.getByRole("button").filter({ has: page.getByText(source.title, { exact: true }) }).first();
      if (!(await choice.innerText()).includes(english ? "Selected" : "已选")) await choice.click();
    }
    const title = english ? "Reading, practice and a little reflection" : "阅读、练习与一点自己的思考";
    await field("标题（可选）").fill(title);
    const draft = english
      ? "# Reading, practice and a little reflection\n\nA short reading habit can bring language into everyday life. Choose one useful expression, connect it to a personal experience, and try to recall it the next day.\n\n## My reflection\n\nI would rather use one new word than collect a page of definitions. I can keep a small note beside each article and return to the question after a week.\n\n## Sources\n\n[S1] 每天读一点，留下自己的思考\n[S2] 让练习成为日常\n\nDemonstration draft written for these screenshots; not an AI-generated result."
      : "# 阅读、练习与一点自己的思考\n\n每天读一小段文字，选择一个能用得上的表达，把它联系到自己的生活，第二天再尝试回忆。两篇材料都让我想到：持续的小练习比一次收集很多词汇更容易坚持。\n\n## 我的思考\n\n与其抄下一页释义，我更愿意认真用好一个新词。把问题留在笔记旁，一周后回来看看自己的理解有什么变化。\n\n## 材料索引\n\n[S1] Small steps, lasting understanding\n[S2] Make reflection a daily habit\n\n此为截图专门编写的演示草稿，并非 AI 生成结果。";
    await field("草稿内容").fill(draft); await button("保存草稿").click();
    await tab("AI 创作").click(); await field("创作主题").fill(title); await field("输出语言").selectOption(english ? "en" : "zh");
    await field("我的思考（Reflection）").fill(english ? "Connect daily reading with personal experience. What would a sustainable practice routine look like?" : "把日常阅读和个人经历联系起来，如何形成能够持续的练习？");
    await field("写作要求或修改反馈").fill(english ? "Compare the two sources, keep source markers and distinguish my reflections from the source claims." : "比较两篇材料的共同观点，保留材料编号，把我的思考与原文观点区分开。");
    await page.evaluate(() => window.scrollTo(0, 0)); await capture("writing");
    await go("/"); await capture("home");
    await go("/publish/"); await tab("材料与形式").click();
    await page.getByRole("button", { name: english ? /^Share card/ : /^分享卡片/ }).click();
    await field("卡片内容").fill(english ? "Read a little.\nMake it your own." : "每天读一点，\n留下自己的思考。");
    await tab("卡片样式").click(); await field("比例").selectOption("1:1"); await field("版式").selectOption("image_top");
    const art = await page.evaluate(() => {
      const canvas = document.createElement("canvas"); canvas.width = 1200; canvas.height = 700;
      const c = canvas.getContext("2d"), sky = c.createLinearGradient(0, 0, 0, 700);
      sky.addColorStop(0, "#233c45"); sky.addColorStop(1, "#b8b9a0"); c.fillStyle = sky; c.fillRect(0, 0, 1200, 700);
      c.fillStyle = "#f1d3a0"; c.beginPath(); c.arc(920, 170, 76, 0, Math.PI * 2); c.fill();
      for (const [color, points] of [["#677c75", [[0, 530], [250, 180], [600, 550], [850, 300], [1200, 580]]], ["#355b59", [[0, 600], [350, 340], [750, 620], [1040, 380], [1200, 490]]], ["#1e4145", [[0, 520], [300, 660], [700, 480], [1200, 650]]]]) {
        c.fillStyle = color; c.beginPath(); c.moveTo(0, 700); for (const [x, y] of points) c.lineTo(x, y); c.lineTo(1200, 700); c.fill();
      }
      return canvas.toDataURL("image/png").split(",")[1];
    });
    await field("卡片配图").setInputFiles({ name: "verniq-demo-landscape.png", mimeType: "image/png", buffer: Buffer.from(art, "base64") });
    await field("品牌显示").selectOption("custom_name"); await field("你的名字或署名").fill("Verniq"); await field("文字粗细").selectOption("700");
    await page.getByRole("slider", { name: t("卡片字号"), exact: true }).fill("180");
    await page.locator('svg[data-card-fits="true"]').waitFor(); await page.evaluate(() => window.scrollTo(0, 0)); await capture("card");
    await go("/config-center/");
    const ai = page.locator("section").filter({ has: page.getByRole("heading", { name: t("AI 设置"), exact: true }) }).last();
    await ai.getByRole("button", { name: t("配置"), exact: true }).click(); await button("OpenAI / Claude 兼容中转").click();
    const form = page.locator("#ai-service-create-form");
    await form.getByLabel(t("服务名称"), { exact: true }).fill(english ? "My AI provider" : "我的 AI 服务");
    await form.getByLabel(t("服务地址"), { exact: true }).fill("https://api.example.com/v1");
    await form.getByLabel(t("模型 ID（必填）"), { exact: true }).fill("your-model-id");
    // Focus this illustration on the actual form, without a partially scrolled page heading.
    await capture("settings", form);
    await context.close();
  }
  await mkdir(resolve(root, "build"), { recursive: true });
  await writeFile(resolve(root, "build/docs-capture-build.json"), JSON.stringify(build, null, 2) + "\n");
  await writeFile(resolve(root, "docs/screenshots/manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
} finally { await browser.close(); }
