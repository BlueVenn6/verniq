import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright-core";

const base = process.env.VERNIQ_TEST_URL || "http://127.0.0.1:3177";
const coreKey = "my-life-map:workspace:core:v1";
const timestampKey = "my-life-map:workspace:updated-at";
const browser = await chromium.launch({ headless: true, ...(process.env.VERNIQ_BROWSER_PATH ? { executablePath: process.env.VERNIQ_BROWSER_PATH } : process.platform === "win32" ? { channel: "msedge" } : {}) });
const checks = [];
const errors = [];
await mkdir("build", { recursive: true });
async function isolated(seed, legacy) {
  const context = await browser.newContext({ viewport: { width: 1257, height: 704 }, acceptDownloads: true });
  if (seed) await context.addInitScript(({ seed, legacy, coreKey, timestampKey }) => {
    if (localStorage.getItem(coreKey)) return;
    localStorage.setItem(coreKey, JSON.stringify(seed));
    localStorage.setItem(timestampKey, JSON.stringify("2026-11-01T00:00:00.000Z"));
    if (legacy) localStorage.setItem("my-life-map:content-pipeline:items", JSON.stringify(legacy));
  }, { seed, legacy, coreKey, timestampKey });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(String(error)));
  page.on("dialog", dialog => dialog.accept());
  return { context, page };
}
async function stored(page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key)), coreKey); }
async function saveDraft(page) {
  const save = page.getByRole("button", { name: "保存草稿", exact: true });
  await save.click();
  // The queue is asynchronous; wait until both React and the durable write settle.
  await page.waitForTimeout(250);
  assert.equal(await save.isEnabled(), true);
}

try {
  const initial = await isolated();
  await initial.page.goto(base + "/inbox/");
  await initial.page.getByLabel("材料标题", { exact: true }).fill("Authoritative reading");
  await initial.page.getByLabel("原始内容", { exact: true }).fill("Reading connects ideas. We learn through regular practice.");
  await initial.page.getByRole("button", { name: "导入并开始阅读", exact: true }).click();
  await initial.page.locator("[data-reading-segment]").first().waitFor();
  await initial.page.waitForFunction(key => Boolean(localStorage.getItem(key)), coreKey);
  const seed = await stored(initial.page);
  await initial.context.close();

  const legacy = structuredClone(seed.contentPipelineItems);
  legacy[0].title = "STALE LEGACY TITLE";
  const authority = await isolated(seed, legacy);
  await authority.page.goto(base + "/inbox/");
  await authority.page.getByRole("heading", { name: "最近导入的材料", exact: true }).waitFor();
  await authority.page.getByLabel("学习模式", { exact: true }).selectOption("zh");
  await authority.page.getByRole("tab", { name: "Paste text", exact: true }).waitFor();
  await authority.page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).languageSettings.uiLanguage === "en", coreKey);
  assert.equal((await stored(authority.page)).contentPipelineItems[0].title, "Authoritative reading");
  assert.equal(await authority.page.getByText("STALE LEGACY TITLE", { exact: true }).count(), 0);
  checks.push("Primary workspace wins over stale legacy cache in the actual Import UI");
  await authority.context.close();

  for (const recoveryFails of [false, true]) {
    const { context, page } = await isolated(seed);
    await page.goto(base + "/publish/");
    await page.getByLabel("草稿内容", { exact: true }).waitFor();
    const before = await page.evaluate(({ coreKey, timestampKey }) => ({ core: localStorage.getItem(coreKey), timestamp: localStorage.getItem(timestampKey) }), { coreKey, timestampKey });
    await page.evaluate(({ coreKey, recoveryFails }) => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        if (this === localStorage && (key === coreKey || (recoveryFails && key.startsWith("my-life-map:workspace:recovery:")))) throw new DOMException("Synthetic storage quota fault", "QuotaExceededError");
        return original.call(this, key, value);
      };
    }, { coreKey, recoveryFails });
    const editor = page.getByLabel("草稿内容", { exact: true });
    await editor.fill("MY UNSAVED ARTICLE: preserve this content when saving fails.");
    await saveDraft(page);
    await page.getByText("草稿保存失败，编辑内容和恢复副本仍保留。请检查工作区保存状态。", { exact: true }).waitFor();
    const after = await page.evaluate(({ coreKey, timestampKey }) => ({ core: localStorage.getItem(coreKey), timestamp: localStorage.getItem(timestampKey) }), { coreKey, timestampKey });
    assert.deepEqual(after, before, "A failed save must not replace the primary document or advance Last saved");
    await editor.fill("MY SECOND UNSAVED ARTICLE: paused saving must also report failure.");
    await saveDraft(page);
    assert.equal(await page.getByText("草稿已保存，包含所选材料、创作设置、卡片文字和署名。配图需重新选择。", { exact: true }).count(), 0);
    const downloadEvent = page.waitForEvent("download");
    await page.getByRole("button", { name: "下载恢复副本", exact: true }).click();
    const download = await downloadEvent;
    const recovered = JSON.parse(await readFile(await download.path(), "utf8"));
    assert.ok(recovered.workspace.outputDrafts.some(draft => draft.content.includes("MY SECOND UNSAVED ARTICLE")));
    await page.locator('header nav a[href="/config-center/"]').filter({ visible: true }).click();
    await page.waitForURL(base + "/config-center/");
    const secondExportEvent = page.waitForEvent("download");
    await page.getByRole("button", { name: "下载恢复副本", exact: true }).click();
    const secondExport = JSON.parse(await readFile(await (await secondExportEvent).path(), "utf8"));
    assert.ok(secondExport.workspace.outputDrafts.some(draft => draft.content.includes("MY SECOND UNSAVED ARTICLE")), "Navigation must retain failed writes in memory");
    checks.push(`Storage fault with recovery ${recoveryFails ? "unavailable" : "available"}: original and saved time preserved, repeated save fails honestly, latest text exportable after navigation`);
    await context.close();
  }

  const metadataFault = await isolated(seed);
  await metadataFault.page.goto(base + "/publish/");
  await metadataFault.page.getByLabel("草稿内容", { exact: true }).waitFor();
  await metadataFault.page.evaluate(timestampKey => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (this === localStorage && key === timestampKey) throw new DOMException("Synthetic timestamp fault", "QuotaExceededError");
      return original.call(this, key, value);
    };
  }, timestampKey);
  await metadataFault.page.getByLabel("草稿内容", { exact: true }).fill("Durably saved despite unavailable status metadata.");
  await saveDraft(metadataFault.page);
  assert.ok((await stored(metadataFault.page)).outputDrafts.some(draft => draft.content.includes("Durably saved")));
  await metadataFault.page.reload();
  assert.equal(await metadataFault.page.getByText(/已恢复浏览器未保存的内容，已暂停自动保存/).count(), 0);
  checks.push("A failed timestamp update does not turn a durable save into a false recovery or conflict");
  await metadataFault.context.close();

  assert.deepEqual(errors, []);
  await writeFile("build/storage-faults-results.json", JSON.stringify({ checks, errors, scope: "Actual production UI, real browser storage with deliberate write failures; isolated synthetic data only" }, null, 2));
  console.log(JSON.stringify({ checks, errors }, null, 2));
} finally {
  await browser.close();
}
