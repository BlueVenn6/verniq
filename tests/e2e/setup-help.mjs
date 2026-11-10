import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { chromium } from "playwright-core";

const base = process.env.VERNIQ_TEST_URL || "http://127.0.0.1:3177";
const browser = await chromium.launch({ headless: true, ...(process.env.VERNIQ_BROWSER_PATH ? { executablePath: process.env.VERNIQ_BROWSER_PATH } : process.platform === "win32" ? { channel: "msedge" } : {}) });
const checks = [], errors = [];
try {
  for (const english of [false, true]) {
    const copy = (zh, en) => english ? en : zh;
    for (const state of ["available", "missing", "unsupported"]) {
      const context = await browser.newContext({ viewport: { width: english ? 390 : 1257, height: 704 } });
      await context.addInitScript(state => {
        if (state === "unsupported") {
          Object.defineProperty(window, "SpeechSynthesisUtterance", { value: undefined });
        } else {
          Object.defineProperty(window, "speechSynthesis", { value: {
            getVoices: () => [{ lang: state === "available" ? "en-US" : "zh-CN" }],
            addEventListener() {}, removeEventListener() {}, cancel() {}, speak() {},
          } });
        }
      }, state);
      const page = await context.newPage();
      page.on("pageerror", error => errors.push(String(error)));
      await page.goto(base + "/inbox/");
      if (english) await page.getByLabel("学习模式", { exact: true }).selectOption("zh");
      await page.getByLabel(copy("材料标题", "Material title"), { exact: true }).fill("Voice help test");
      await page.getByLabel(copy("原始语言", "Material language"), { exact: true }).selectOption("en");
      await page.getByLabel(copy("原始内容", "Original text"), { exact: true }).fill("We learn through reading.");
      await page.getByRole("button", { name: copy("导入并开始阅读", "Import and read"), exact: true }).click();
      const paragraph = page.locator("[data-reading-segment] p[lang]").first();
      await paragraph.waitFor();
      await paragraph.scrollIntoViewIfNeeded();
      const point = await paragraph.evaluate(element => {
        const node = element.firstChild, start = node.textContent.indexOf("learn");
        const range = document.createRange(); range.setStart(node, start); range.setEnd(node, start + 5);
        const box = range.getBoundingClientRect(); return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      });
      await page.mouse.dblclick(point.x, point.y);
      const popup = page.getByRole("dialog", { name: copy("划词速查", "Quick lookup"), exact: true });
      await popup.getByText("ECDICT · MIT", { exact: true }).waitFor();
      const speech = popup.getByRole("button", { name: copy("朗读（设备语音）", "Read aloud (device voice)"), exact: true });
      assert.equal(await speech.isEnabled(), state === "available");
      const help = popup.locator("details");
      assert.equal(await help.getAttribute("open"), null, "Help must not expand the quick lookup by default");
      await help.locator("summary").click();
      const text = await help.innerText();
      assert.ok(text.includes(copy("管理语音 → 添加语音", "Manage voices → Add voices")));
      assert.equal(await help.getByRole("link").getAttribute("href"), "https://support.microsoft.com/en-us/windows/appendix-a-supported-languages-and-voices-4486e345-7730-53da-fcfe-55cc64300f01");
      if (english) assert.doesNotMatch(text, /[\u3400-\u9fff]/);
      if (state === "unsupported") assert.ok((await popup.innerText()).includes(copy("当前浏览器不支持设备朗读", "This browser does not support device speech")));
      if (state === "missing") assert.ok((await popup.innerText()).includes(copy("本设备暂无对应语言的语音", "No matching voice")));
      const bounds = await popup.evaluate(e => ({ left: e.getBoundingClientRect().left, right: e.getBoundingClientRect().right, width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
      assert.ok(bounds.left >= 0 && bounds.right <= bounds.width + 1 && bounds.scroll <= bounds.width + 1, JSON.stringify(bounds));
      checks.push({ english, state, voiceHelpAndBounds: true });
      await page.screenshot({ path: `build/setup-voice-${english ? "en" : "zh"}-${state}.png` });
      if (state === "available") {
        await page.goto(base + "/config-center/");
        const section = page.locator("section").filter({ has: page.getByRole("heading", { name: copy("AI 设置", "AI settings"), exact: true }) }).last();
        await section.getByRole("button", { name: copy("配置", "Configure"), exact: true }).click();
        const summary = page.locator("summary").filter({ hasText: copy("首次配置？查看填写说明", "First time? View setup guide") });
        const guide = summary.locator("..");
        assert.equal(await guide.getAttribute("open"), null);
        await summary.click();
        assert.equal(await guide.locator("dt").count(), 6);
        assert.ok((await guide.innerText()).includes("401 / 403"));
        if (english) assert.doesNotMatch(await guide.innerText(), /[\u3400-\u9fff]/);
        await page.screenshot({ path: `build/setup-ai-${english ? "en" : "zh"}.png`, fullPage: true });
        const size = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
        assert.ok(size.scroll <= size.width + 1, JSON.stringify({ english, ...size }));
        checks.push({ english, aiGuideReadable: true });
      }
      await context.close();
    }
  }
  assert.deepEqual(errors, []);
  await writeFile("build/setup-help-results.json", JSON.stringify({ checks, errors, scope: "Production UI; voice capability states simulated. No audible output or actual system installation claimed; no paid API calls." }, null, 2));
  console.log(JSON.stringify({ checks, errors }));
} finally { await browser.close(); }
