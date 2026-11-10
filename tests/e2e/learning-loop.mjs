import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright-core";

const base = process.env.VERNIQ_TEST_URL || "http://127.0.0.1:3177";
const browser = await chromium.launch({ headless: true, ...(process.env.VERNIQ_BROWSER_PATH ? { executablePath: process.env.VERNIQ_BROWSER_PATH } : process.platform === "win32" ? { channel: "msedge" } : {}) });
const context = await browser.newContext({ viewport: { width: 1257, height: 704 }, acceptDownloads: true });
const page = await context.newPage();
const checks = [], errors = [];
page.on("pageerror", error => errors.push(String(error)));
await context.addInitScript(() => {
  window.__spoken = [];
  Object.defineProperty(window, "speechSynthesis", { value: {
    getVoices: () => [], addEventListener() {}, removeEventListener() {}, cancel() {},
    speak(utterance) { window.__spoken.push({ text: utterance.text, lang: utterance.lang }); queueMicrotask(() => utterance.onend?.()); },
  } });
});

try {
  await page.goto(base + "/inbox/");
  await page.getByLabel("材料标题", { exact: true }).fill("Synthetic learning loop");
  await page.getByLabel("原始内容", { exact: true }).fill("We learn through daily reading and practice.");
  await page.getByRole("button", { name: "导入并开始阅读", exact: true }).click();
  const paragraph = page.locator("[data-reading-segment] p[lang]").first();
  await paragraph.waitFor();
  await paragraph.scrollIntoViewIfNeeded();
  const point = await paragraph.evaluate(element => {
    const node = element.firstChild, start = node.textContent.indexOf("learn");
    const range = document.createRange(); range.setStart(node, start); range.setEnd(node, start + 5);
    const box = range.getBoundingClientRect(); return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  });
  await page.mouse.dblclick(point.x, point.y);
  const popup = page.getByRole("dialog", { name: "划词速查", exact: true });
  await popup.getByText("ECDICT · MIT", { exact: true }).waitFor();
  assert.ok((await popup.innerText()).includes("学习"));
  assert.ok(await popup.locator("[lang=en]").count());
  await popup.getByRole("button", { name: "朗读（设备语音）", exact: true }).click();
  assert.deepEqual(await page.evaluate(() => window.__spoken.at(-1)), { text: "learn", lang: "en-US" });
  checks.push("A real double click opens local bilingual ECDICT at the selection; English device speech requests en-US (synthesis mocked, audible output not claimed)");

  await popup.getByRole("button", { name: "记录到生词本", exact: true }).click();
  const tools = page.getByRole("region", { name: "学习工具", exact: true });
  await tools.getByRole("button", { name: "保存为词汇", exact: true }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("my-life-map:workspace:core:v1")).vocabularyItems.length === 1);
  await page.goto(base + "/review/");
  const item = page.locator("article").filter({ has: page.getByRole("heading", { name: "learn", exact: true }) });
  await item.getByRole("button", { name: "显示释义", exact: true }).waitFor();
  assert.equal(await item.getByRole("button", { name: /^Good/ }).count(), 0, "Recall must precede rating");
  await item.getByRole("button", { name: "显示释义", exact: true }).click();
  await item.getByRole("button", { name: "纠正词条或释义", exact: true }).click();
  await item.getByLabel("中文释义（可编辑）", { exact: true }).fill("学习；通过练习掌握");
  await item.getByRole("button", { name: "保存纠错", exact: true }).click();
  await item.getByRole("button", { name: /^Good/ }).click();
  await page.waitForFunction(() => {
    const word = JSON.parse(localStorage.getItem("my-life-map:workspace:core:v1")).vocabularyItems[0];
    return word.srs?.reps === 1 && word.srs?.reviewHistory.length === 1 && word.meaningZh === "学习；通过练习掌握";
  });
  const record = await page.evaluate(() => JSON.parse(localStorage.getItem("my-life-map:workspace:core:v1")).vocabularyItems[0]);
  assert.ok(Date.parse(record.srs.dueAt) > Date.now());
  assert.equal(await page.getByRole("heading", { name: "learn", exact: true }).count(), 0, "A future item must leave the due queue");
  await page.getByLabel("复习范围", { exact: true }).selectOption("all");
  await page.getByRole("heading", { name: "learn", exact: true }).waitFor();
  await page.reload();
  await page.getByLabel("复习范围", { exact: true }).selectOption("all");
  await page.getByRole("heading", { name: "learn", exact: true }).waitFor();
  checks.push("Saved bilingual vocabulary reaches Review; answers stay hidden before recall; corrections and one real FSRS rating persist through reload; future due dates leave today's queue");

  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出为 Anki TSV", exact: true }).click();
  const download = await downloadEvent;
  const text = await readFile(await download.path(), "utf8");
  assert.match(download.suggestedFilename(), /\.tsv$/);
  assert.ok(text.includes("learn") && text.includes("学习；通过练习掌握"));
  checks.push("The actual downloaded Anki TSV contains the saved word and its corrected Chinese meaning");

  await page.goto(base + "/config-center/");
  const backupEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出全部数据备份", exact: true }).click();
  const backupJson = await readFile(await (await backupEvent).path(), "utf8");
  const restoredContext = await browser.newContext({ viewport: { width: 1257, height: 704 } });
  await restoredContext.addInitScript(() => {
    if (!localStorage.getItem("my-life-map:workspace:core:v1")) localStorage.setItem("my-life-map:workspace:core:v1", "{deliberately-broken-primary");
  });
  const restored = await restoredContext.newPage();
  restored.on("pageerror", error => errors.push(String(error)));
  restored.on("dialog", dialog => dialog.accept());
  await restored.goto(base + "/config-center/");
  const backupPicker = restored.getByLabel("选择学习数据备份", { exact: true });
  await backupPicker.setInputFiles({ name: "actual-export.json", mimeType: "application/json", buffer: Buffer.from(backupJson) });
  await restored.getByRole("status").filter({ hasText: "已从备份恢复学习数据。" }).waitFor();
  const before = await restored.evaluate(() => localStorage.getItem("my-life-map:workspace:core:v1"));
  assert.ok(await restored.evaluate(() => Object.keys(localStorage).some(key => key.includes("before-restore:") && JSON.parse(localStorage.getItem(key)).primaryRaw === "{deliberately-broken-primary")));
  await backupPicker.setInputFiles({ name: "damaged.json", mimeType: "application/json", buffer: Buffer.from('{"workspace":{"vocabularyItems":[null]}}') });
  await restored.getByRole("status").filter({ hasText: "vocabularyItems" }).waitFor();
  assert.equal(await restored.evaluate(() => localStorage.getItem("my-life-map:workspace:core:v1")), before);
  await restored.getByLabel("学习模式", { exact: true }).selectOption("zh");
  await restored.waitForFunction(() => JSON.parse(localStorage.getItem("my-life-map:workspace:core:v1")).languageSettings.uiLanguage === "en");
  await restored.goto(base + "/review/");
  await restored.getByLabel("Review filter", { exact: true }).selectOption("all");
  await restored.getByRole("heading", { name: "learn", exact: true }).waitFor();
  await restored.reload();
  const wordAfterRestore = await restored.evaluate(() => JSON.parse(localStorage.getItem("my-life-map:workspace:core:v1")).vocabularyItems[0]);
  assert.equal(wordAfterRestore.srs.reps, 1);
  assert.equal(wordAfterRestore.meaningZh, "学习；通过练习掌握");
  await restoredContext.close();
  checks.push("An actual downloaded backup restores into a separate browser with a corrupt primary, preserves the original bytes, rejects damaged input, and resumes normal saving with vocabulary and FSRS history intact");
  assert.deepEqual(errors, []);
  await writeFile("build/learning-loop-results.json", JSON.stringify({ checks, errors, scope: "Actual production UI, local dictionaries and FSRS; synthetic material; device speech engine mocked" }, null, 2));
  console.log(JSON.stringify({ checks, errors }, null, 2));
} finally { await browser.close(); }
