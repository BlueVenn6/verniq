import { chromium } from 'playwright-core';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const base = process.env.VERNIQ_TEST_URL || 'http://127.0.0.1:3177';
const browser = await chromium.launch({ ...(process.env.VERNIQ_BROWSER_PATH ? { executablePath: process.env.VERNIQ_BROWSER_PATH } : process.platform === 'win32' ? { channel: 'msedge' } : {}), headless: true });
const context = await browser.newContext({ viewport: { width: 1257, height: 704 } });
const seed = {
  schemaVersion: 5,
  aiProviders: [{ id: 'saved-relay', name: 'Saved relay', providerFamily: 'custom', providerType: 'openai_compatible', connectionMode: 'custom_base_url', adapterProtocol: 'openai_chat_completions', baseUrl: 'https://relay.example/gateway', customEndpointPath: '/gateway/v1/chat/completions', enabled: true, authMode: 'none', apiKeyRequired: false, connectionVerification: { status: 'unverified' } }],
  aiModels: [{ id: 'saved-gpt', providerId: 'saved-relay', modelId: 'gpt-5.6-terra', displayName: 'Saved GPT', enabled: true, supportsText: true, supportsVision: false, capabilities: ['text', 'analysis'] }],
  sourceMaterials: [],
};
await context.addInitScript(seed => {
  const key = 'my-life-map:workspace:core:v1';
  if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(seed));
}, seed);
const page = await context.newPage();
page.setDefaultTimeout(30000);
const png = Buffer.from(fs.readFileSync('src/lib/llm/providerTest.ts', 'utf8').match(/const VERNIQ_TEST_IMAGE_BASE64 =\s*"([^"]+)"/)[1], 'base64');
const requests = [], errors = [], checks = [];
let failProbe = true, holdNext = false, release;
page.on('pageerror', error => errors.push(String(error)));
await page.route('https://relay.example/**', async route => {
  const request = route.request().postDataJSON();
  requests.push({ url: route.request().url(), request });
  if (failProbe) {
    failProbe = false;
    await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: { message: 'image input not supported' } }) });
    return;
  }
  const isProbe = request.messages[0].content[0].text.includes('test image');
  if (holdNext) { holdNext = false; await new Promise(resolve => { release = resolve; }); }
  try {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: isProbe ? 'VERNIQ TEST' : '每天阅读，留下自己的思考。' } }] }) });
  } catch (error) {
    if (!/already handled|intercepted|closed|cancel|invalid/i.test(String(error))) throw error;
  }
});
const upload = () => page.locator('input[type=file][accept*="image/png"]').setInputFiles({ name: 'image-note.png', mimeType: 'image/png', buffer: png });
const editor = page.getByLabel('识别结果（可编辑）', { exact: true });
const allow = () => page.getByRole('checkbox').filter({ visible: true }).check();
try {
  await page.goto(base + '/inbox/');
  await page.getByRole('tab', { name: '上传图片', exact: true }).click();
  assert.equal(await page.getByLabel('识图模型', { exact: true }).inputValue(), 'saved-gpt');
  assert.equal(await page.getByRole('button', { name: '确认并提取文字', exact: true }).isDisabled(), true);
  await page.getByRole('button', { name: '验证并启用识图', exact: true }).click();
  const form = page.getByRole('region', { name: '导入材料表单', exact: true });
  await form.getByRole('alert').waitFor();
  assert.match(await form.getByRole('alert').innerText(), /不支持图片输入/);
  let state = await page.evaluate(() => JSON.parse(localStorage.getItem('my-life-map:workspace:core:v1')));
  assert.equal(state.aiModels.find(m => m.id === 'saved-gpt').capabilityVerification.image, 'failed');
  checks.push('A failed real-shaped image probe stays failed and leaves OCR disabled');
  await page.getByRole('button', { name: '验证并启用识图', exact: true }).click();
  await form.getByText(/图片能力：已验证/).waitFor();
  state = await page.evaluate(() => JSON.parse(localStorage.getItem('my-life-map:workspace:core:v1')));
  assert.equal(state.aiTaskRouting.imageTextExtraction.modelId, 'saved-gpt');
  assert.equal(state.aiModels.filter(m => m.providerId === 'saved-relay').length, 1);
  await page.reload();
  await page.getByRole('tab', { name: '上传图片', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: '验证并启用识图', exact: true }).count(), 0);
  await upload();
  await allow();
  await page.getByRole('button', { name: '确认并提取文字', exact: true }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('textarea')].some(el => el.closest('label')?.textContent.includes('识别结果（可编辑）') && el.value.includes('每天阅读')));
  await editor.fill('每天阅读，留下自己的思考。\n这是我校对后的中文。');
  await page.getByRole('button', { name: '确认并导入阅读器', exact: true }).click();
  await page.locator('[data-reading-segment]').first().waitFor();
  state = await page.evaluate(() => JSON.parse(localStorage.getItem('my-life-map:workspace:core:v1')));
  assert.equal(state.sourceMaterials.at(-1).language, 'zh');
  assert.ok(state.sourceMaterials.at(-1).cleanedContent.includes('这是我校对后的中文'));
  checks.push('An existing text model is verified, enabled, survives reload, and imports corrected Chinese image text into the Reader');
  await page.goto(base + '/inbox/');
  await page.getByRole('tab', { name: '上传图片', exact: true }).click();
  await upload(); await allow(); holdNext = true;
  await page.getByRole('button', { name: '确认并提取文字', exact: true }).click();
  await page.getByRole('button', { name: '正在提取…', exact: true }).waitFor();
  await page.getByRole('button', { name: '移除图片', exact: true }).click();
  await upload();
  await editor.fill('保留新图片的人工校对内容');
  release();
  await page.waitForTimeout(300);
  assert.equal(await editor.inputValue(), '保留新图片的人工校对内容');
  checks.push('Replacing an image cancels the old request and prevents its late result from overwriting the new image text');
  assert.ok(requests.every(r => r.url === 'https://relay.example/gateway/v1/chat/completions'));
  assert.ok(requests.every(r => r.request.model === 'gpt-5.6-terra' && r.request.messages.at(-1).content.some(p => p.type === 'image_url' && p.image_url.url.startsWith('data:image/png;base64,'))));
  checks.push('Image requests retain the exact saved model and custom chat gateway rather than using a drawing endpoint');
  await page.getByLabel('学习模式', { exact: true }).selectOption('zh');
  await page.getByRole('tab', { name: 'Upload an image', exact: true }).waitFor();
  await page.getByRole('tab', { name: 'Upload an image', exact: true }).click();
  await page.getByLabel('Image-reading model', { exact: true }).waitFor();
  for (const width of [390, 900, 1257, 1920]) {
    await page.setViewportSize({ width, height: 704 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
  }
  const chinese = await page.getByRole('region', { name: 'Import form', exact: true }).evaluate(el => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), found = []; let n;
    while (n = walker.nextNode()) if (!n.parentElement.closest('textarea,select,input') && n.parentElement.getClientRects().length && /[\u4e00-\u9fff]/.test(n.textContent)) found.push(n.textContent);
    return found;
  });
  assert.deepEqual(chinese, []); assert.deepEqual(errors, []);
  checks.push('Image setup and result controls use English consistently and fit mobile and desktop widths');
  fs.writeFileSync('build/image-input-flow-results.json', JSON.stringify({ checks, errors, scope: 'Production UI with a controlled provider response. Live API tests are recorded separately.' }, null, 2));
  console.log(JSON.stringify({ checks, errors }, null, 2));
} catch (error) {
  release?.();
  await page.screenshot({ path: 'build/image-input-flow-failure.png' });
  throw error;
} finally { await context.close(); await browser.close(); }
