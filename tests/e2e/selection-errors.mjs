import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base = process.env.VERNIQ_TEST_URL || 'http://127.0.0.1:3177';
const browser = await chromium.launch({ ...(process.env.VERNIQ_BROWSER_PATH ? { executablePath: process.env.VERNIQ_BROWSER_PATH } : process.platform === 'win32' ? { channel: 'msedge' } : {}), headless: true });
const context = await browser.newContext({ viewport: { width: 1257, height: 704 } });
const scope = { providerId: 'relay', modelId: 'saved-model' };
await context.addInitScript(scope => {
  const key = 'my-life-map:workspace:core:v1';
  if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ schemaVersion: 5,
    aiProviders: [{ id: 'relay', name: 'Saved relay', providerType: 'openai_compatible', adapterProtocol: 'openai_chat_completions', enabled: true, baseUrl: 'https://relay.example/v1', authMode: 'none', apiKeyRequired: false, connectionVerification: { status: 'verified' } }],
    aiModels: [{ id: 'saved-model', providerId: 'relay', modelId: 'Exact-Configured-Model', displayName: 'Configured model', enabled: true, supportsText: true, capabilities: ['text', 'analysis'] }],
    aiTaskRouting: { languageAnalysis: scope, phraseAnalysis: scope, sentenceGrammarAnalysis: scope }, sourceMaterials: [] }));
}, scope);
const page = await context.newPage();
const errors = [], checks = [];
let fail = true, calls = 0;
page.on('pageerror', e => errors.push(String(e)));
page.on('dialog', d => d.accept());
await page.route('https://relay.example/**', async route => {
  calls++;
  assert.equal(route.request().postDataJSON().model, 'Exact-Configured-Model');
  if (fail) return route.abort('connectionfailed');
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: JSON.stringify({ overallMeaning: '我们的读书小组每周见面。', sentenceCore: [], structureBreakdown: [], grammarPoints: [{ title: '一般现在时', explanation: '说明固定活动。' }], fixedExpressions: [], pitfalls: [], simplifiedRewrite: 'Our group meets weekly.', similarExamples: ['Our club meets every week.'], ambiguityNotes: [] }) } }] }) });
});
async function selectSentence() {
  await page.locator('[data-reading-segment] p[lang]').first().evaluate(element => {
    const range = document.createRange(); range.selectNodeContents(element);
    const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
    element.closest('article').dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift', bubbles: true }));
  });
  await page.getByRole('dialog').getByRole('button', { name: /AI/ }).click();
}
try {
  await page.goto(base + '/inbox/');
  await page.getByLabel('材料标题', { exact: true }).fill('Selection failure and recovery');
  await page.getByLabel('原始内容', { exact: true }).fill('Our reading group meets every week.');
  await page.getByRole('button', { name: '导入并开始阅读', exact: true }).click();
  await page.locator('[data-reading-segment]').first().waitFor();
  await selectSentence();
  const tools = page.getByRole('region', { name: '学习工具', exact: true });
  await tools.getByRole('alert').getByText('无法连接 AI 服务。请检查网络、服务地址或中转服务状态后重试。', { exact: true }).waitFor();
  assert.equal(calls, 1);
  assert.equal(await tools.getByText('整体意思', { exact: true }).count(), 0);
  checks.push('A failed selection request shows an actionable Chinese alert, no fabricated result, and sends no automatic retry');
  fail = false;
  await tools.getByRole('button', { name: '开始分析', exact: true }).click();
  await tools.getByText('整体意思', { exact: true }).waitFor();
  await tools.getByRole('button', { name: '保存语法笔记', exact: true }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('my-life-map:workspace:core:v1')).grammarNotes.length === 1);
  assert.equal(await tools.getByRole('alert').count(), 0);
  assert.equal(calls, 2);
  checks.push('An explicit retry displays the returned result and saves a real grammar note');
  await page.getByLabel('学习模式', { exact: true }).selectOption('zh');
  fail = true;
  await selectSentence();
  const englishTools = page.getByRole('region', { name: 'Learning tools', exact: true });
  await englishTools.getByRole('alert').getByText('Could not connect to the AI service. Check your network, service URL or relay status, then try again.', { exact: true }).waitFor();
  assert.equal(calls, 3);
  for (const width of [390, 900, 1257]) {
    await page.setViewportSize({ width, height: 704 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  }
  checks.push('The same failure uses English after changing mode and stays within mobile and desktop widths');
  assert.deepEqual(errors, []);
  fs.writeFileSync('build/selection-errors-results.json', JSON.stringify({ checks, errors, scope: 'Production UI with controlled connection failures and recovery responses; no live service used' }, null, 2));
  console.log(JSON.stringify({ checks, errors }, null, 2));
} finally { await browser.close(); }
