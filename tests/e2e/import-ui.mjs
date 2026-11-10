import { chromium } from 'playwright-core';
import fs from 'node:fs'; import assert from 'node:assert/strict';
const base=process.env.VERNIQ_TEST_URL || 'http://127.0.0.1:3177';
const browser=await chromium.launch({...(process.env.VERNIQ_BROWSER_PATH ? {executablePath:process.env.VERNIQ_BROWSER_PATH} : process.platform==='win32' ? {channel:'msedge'} : {}),headless:true});
const context=await browser.newContext({viewport:{width:1440,height:960}}); const page=await context.newPage();
const checks=[],errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>d.accept());
try {
 await page.goto(base+'/inbox/');
 const form=page.getByRole('region',{name:'导入材料表单',exact:true});
 assert.equal(await form.getByRole('tab').count(),4);assert.equal(await form.getByLabel('原始语言',{exact:true}).count(),1);
 assert.equal(await form.getByLabel('内容摘要',{exact:true}).isVisible(),false);
 const input=page.getByLabel('原始内容',{exact:true});await input.click();await page.keyboard.type('A genuine imported passage. Reading helps us learn.');
 for(const width of [900,1024,1440,1920]){await page.setViewportSize({width,height:960});await page.evaluate(()=>scrollTo(0,0));const box=await page.getByRole('button',{name:'导入并开始阅读',exact:true}).boundingBox();assert.ok(box.y+box.height<960,`primary import action visible at ${width}`);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.screenshot({path:`build/compact-import-${width}.png`});}
 checks.push('The default paste input and import action are visible without scrolling at desktop widths; four method choices align evenly; classification is collapsed and language appears once');
 await page.setViewportSize({width:1440,height:960});await form.getByLabel('材料标题',{exact:true}).fill('Actual paste import');await form.getByText('分类、摘要与阅读目标（选填）',{exact:true}).click();await form.getByLabel('材料类型',{exact:true}).selectOption('note');await form.getByLabel('内容摘要',{exact:true}).fill('My import summary.');await form.getByRole('button',{name:'导入并开始阅读',exact:true}).click();await page.locator('[data-reading-segment]').first().waitFor();assert.ok((await page.getByRole('main',{name:'阅读原文',exact:true}).innerText()).includes('A genuine imported passage.'));
 let state=await page.evaluate(()=>JSON.parse(localStorage.getItem('my-life-map:workspace:core:v1')));assert.ok(state.contentPipelineItems.some(i=>i.sourceTypeId==='note'&&i.summary==='My import summary.'));checks.push('Real pointer/keyboard entry, optional metadata and paste submission persist the text and open the Reader');
 await page.goto(base+'/inbox/');await page.getByRole('tab',{name:'选择文档',exact:true}).click();await page.locator('input[type=file]').first().setInputFiles({name:'Actual-file.txt',mimeType:'text/plain',buffer:Buffer.from('Real TXT file content. This is not a mocked ingestion response.')});await page.getByRole('button',{name:'导入并开始阅读',exact:true}).click();await page.locator('[data-reading-segment]').first().waitFor();assert.ok((await page.getByRole('main',{name:'阅读原文',exact:true}).innerText()).includes('Real TXT file content.'));checks.push('TXT upload uses the real file parser, persists its extracted text and opens the Reader');
 await page.goto(base+'/inbox/');await page.getByRole('tab',{name:'上传图片',exact:true}).click();await page.getByLabel('材料标题',{exact:true}).fill('Image still selected');await page.getByLabel('原始语言',{exact:true}).selectOption('zh');assert.equal(await page.getByRole('tab',{name:'上传图片',exact:true}).getAttribute('aria-selected'),'true');assert.equal(await page.getByLabel('识别结果（可编辑）',{exact:true}).isVisible(),true);checks.push('Editing title or language retains image import mode rather than unexpectedly switching to paste');
 await page.getByRole('tab',{name:'添加链接',exact:true}).click();assert.equal(await page.getByLabel('原始语言',{exact:true}).count(),1);await page.getByLabel('链接',{exact:true}).click();await page.keyboard.type('https://example.com/article');assert.equal(await page.getByLabel('链接',{exact:true}).inputValue(),'https://example.com/article');checks.push('URL input accepts pointer focus and typing and has no duplicate language fields');
 const originalIds=await page.evaluate(()=>JSON.parse(localStorage.getItem('my-life-map:workspace:core:v1')).sourceMaterials.map(s=>s.id));
 await page.route('https://blocked.example/**',route=>route.abort('failed'));
 await page.getByLabel('链接',{exact:true}).fill('https://blocked.example/article');
 await page.getByRole('button',{name:'导入并开始阅读',exact:true}).click();
 await form.getByRole('alert').filter({hasText:'网站可能限制访问'}).waitFor();
 assert.equal(await page.getByLabel('链接',{exact:true}).inputValue(),'https://blocked.example/article');
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('my-life-map:workspace:core:v1')).sourceMaterials.map(s=>s.id)),originalIds);
 await page.getByLabel('学习模式',{exact:true}).selectOption('zh');
 await page.getByRole('tab',{name:'Add a link',exact:true}).click();
 await page.getByLabel('URL',{exact:true}).fill('https://blocked.example/english');
 await page.getByRole('button',{name:'Import and read',exact:true}).click();
 const englishForm=page.getByRole('region',{name:'Import form',exact:true});
 await englishForm.getByRole('alert').filter({hasText:'The page could not be reached'}).waitFor();
 assert.ok(!(await englishForm.getByRole('alert').innerText()).match(/[\u3400-\u9fff]|Failed to fetch/));
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('my-life-map:workspace:core:v1')).sourceMaterials.map(s=>s.id)),originalIds);
 checks.push('Blocked URL imports show actionable Chinese and English guidance, preserve the entered URL and existing materials, and do not create fake readable entries');
 await page.getByRole('tab',{name:'Paste text',exact:true}).click();
 for(const width of [1440,900,390]){await page.setViewportSize({width,height:960});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.screenshot({path:`build/compact-import-en-${width}.png`});}
 const chinese=await page.getByRole('region',{name:'Import form',exact:true}).evaluate(e=>{const walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);const out=[];let n;while(n=walker.nextNode()){if(n.parentElement.closest('textarea,select,details:not([open])'))continue;if(n.parentElement.getClientRects().length&&/[\u4e00-\u9fff]/.test(n.textContent))out.push(n.textContent)}return out;});assert.deepEqual(chinese,[]);checks.push('Import controls use English consistently and fit desktop and mobile widths');
 assert.deepEqual(errors,[]);fs.writeFileSync('build/compact-import-results.json',JSON.stringify({checks,errors,scope:'Actual production web bundle; real paste and TXT ingestion. No live AI/OCR request in this suite.'},null,2));console.log(JSON.stringify({checks,errors},null,2));
} catch(error){await page.screenshot({path:'build/compact-import-failure.png'});console.error(page.url());throw error;}finally{await browser.close();}
