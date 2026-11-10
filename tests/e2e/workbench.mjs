import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.env.VERNIQ_TEST_URL || 'http://127.0.0.1:3177';
const browser=await chromium.launch({...(process.env.VERNIQ_BROWSER_PATH ? {executablePath:process.env.VERNIQ_BROWSER_PATH} : process.platform==='win32' ? {channel:'msedge'} : {}),headless:true});
const page=await browser.newPage({viewport:{width:1440,height:960}});
let holdNextResponse=false, releaseResponse;
const checks=[],errors=[],requests=[];page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>d.accept());
await page.route('https://relay.example/**',async route=>{
 const body=route.request().postDataJSON();requests.push({url:route.request().url(),body});
 const sys=body?.messages?.[0]?.content||'';
 const highlight=sys.includes('language-learning analyst')||sys.includes('articleOverview');
 const writing=sys.includes('careful writing collaborator');
 const content=highlight?JSON.stringify({articleOverview:{summaryZh:'阅读和反思帮助理解材料。',summaryInTargetLanguage:'Reading and reflection support understanding.',keyIdeas:['持续阅读促进学习','反思把材料联系起来']},vocabularyCandidates:[{text:'reflect',lemma:'reflect',meaningZh:'反思',meaningEn:'Think carefully.',sentence:'We reflect on reading.'}]}):writing?'# Reading with reflection\n\nDaily practice supports understanding [S1]. Reflecting helps connect ideas [S2].':sys.includes('reading discussion partner')?'A grounded discussion reply '+requests.length:'Connection OK';
 if(holdNextResponse){holdNextResponse=false;await new Promise(resolve=>{releaseResponse=resolve;});}
 await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({choices:[{message:{content}}]})});
});
async function importText(title,content){await page.goto(base+'/inbox/');await page.getByLabel('材料标题',{exact:true}).fill(title);await page.getByLabel('原始内容',{exact:true}).fill(content);await page.getByRole('button',{name:'导入并开始阅读',exact:true}).click();await page.locator('[data-reading-segment]').first().waitFor();}
try {
 await importText('Reading and reflection','Reading every day helps us learn and remember new words.\n\nWe reflect on reading.');
 await importText('Practice connects ideas','Daily practice connects ideas.\n\nReflection helps us understand.');
 await page.goto(base+'/config-center/');
 const ai=page.locator('section').filter({has:page.getByRole('heading',{name:'AI 设置',exact:true})}).last();await ai.getByRole('button',{name:'配置',exact:true}).click();
 await page.getByRole('button',{name:'OpenAI / Claude 兼容中转',exact:true}).click();const form=page.locator('#ai-service-create-form');
 await form.getByLabel('服务名称',{exact:true}).fill('Acceptance gateway');await form.getByLabel('服务地址',{exact:true}).fill('https://relay.example/gateway/v1');await form.getByLabel('API 密钥',{exact:true}).fill('isolated-test-key');await form.getByLabel('模型 ID（必填）',{exact:true}).fill('Exact-Model/Manual');await form.getByRole('button',{name:'创建服务',exact:true}).click();await form.waitFor({state:'detached'});
 // Follow the screenshot's separate "add model" path, rather than treating
 // the initial model created with the provider as proof of this form.
 await page.getByRole('button',{name:'＋ 自定义模型 ID',exact:true}).click();
 const modelForm=page.locator('section').filter({has:page.getByRole('button',{name:'创建模型',exact:true})}).last();
 await modelForm.getByRole('button',{name:'创建模型',exact:true}).click();await modelForm.getByText('请先填写模型 ID。',{exact:true}).waitFor();
 await modelForm.getByLabel('模型 ID（必填）',{exact:true}).fill('Exact-Model/Manual');
 await modelForm.getByRole('button',{name:'创建模型',exact:true}).click();await modelForm.getByText('当前 AI 服务中已经存在相同的模型 ID。',{exact:true}).waitFor();
 const customId='My.Exact-Custom/Alias-2026';
 await modelForm.getByLabel('模型 ID（必填）',{exact:true}).fill(customId);
 await modelForm.getByLabel('显示名称（选填）',{exact:true}).fill('User added exact alias');
 await modelForm.getByRole('checkbox',{name:'设为默认',exact:true}).check();
 await modelForm.getByRole('button',{name:'创建模型',exact:true}).click();await modelForm.waitFor({state:'detached'});
 const customRow=page.getByText('User added exact alias',{exact:true}).locator('..').locator('..').locator('..');
 await customRow.getByRole('button',{name:'验证文本',exact:true}).click();await customRow.getByText(/连接测试通过/).first().waitFor();
 assert.equal(requests.at(-1).body.model,customId);assert.equal(requests.at(-1).url,'https://relay.example/gateway/v1/chat/completions');
 await page.waitForFunction(id=>{const w=JSON.parse(localStorage.getItem('my-life-map:workspace:core:v1'));const model=w.aiModels.find(m=>m.modelId===id);return model&&w.aiTaskRouting.languageAnalysis.modelId===model.id&&w.aiTaskRouting.publishPackage.modelId===model.id;},customId);
 checks.push('Add a second custom model through the screenshot form: empty and duplicate IDs rejected, exact mixed-case ID retained, set-as-default routes reading and writing, model-specific text verification reaches the exact gateway');
 await page.getByRole('button',{name:'验证连接',exact:true}).click();await page.getByText(/连接测试通过/).first().waitFor();
 checks.push('Create a real provider configuration in UI; connection test uses its exact endpoint and exact model ID, and clearly states its limited scope');
 await page.goto(base+'/reader/');
 await page.getByRole('tab',{name:'我的笔记',exact:true}).click();const note=page.getByLabel('我的总结与思考',{exact:true});await note.fill('I understand that reflection connects practice with learning.');assert.equal(await note.evaluate(e=>e===document.activeElement),true);await page.getByRole('button',{name:'保存笔记',exact:true}).click();
 await page.getByRole('tab',{name:'AI 对话',exact:true}).click();await page.getByLabel('快捷问题',{exact:true}).selectOption('understanding');
 const allowance=page.locator('label').filter({hasText:'允许本次发送材料正文给远程 AI'}).getByRole('checkbox');await allowance.check();await page.getByRole('button',{name:'发送',exact:true}).click();await page.getByRole('log').getByText(/A grounded discussion reply/).waitFor();
 assert.ok(requests.at(-1).body.messages.at(-1).content.includes('I understand that reflection'));
 await page.getByLabel('快捷问题',{exact:true}).selectOption('custom');await page.getByLabel('向 AI 提问',{exact:true}).fill('How can I apply that?');await page.getByRole('button',{name:'发送',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[role=log]').innerText.match(/A grounded discussion reply/g)?.length===2);
 assert.ok(requests.at(-1).body.messages.some(m=>m.role==='assistant'));
 // A user may draft their next question while the previous request is pending.
 holdNextResponse=true;
 await page.getByLabel('向 AI 提问',{exact:true}).fill('A pending question');
 await page.getByRole('button',{name:'发送',exact:true}).click();
 await page.getByText('AI 正在回复…',{exact:true}).waitFor();
 await page.getByLabel('向 AI 提问',{exact:true}).fill('KEEP MY NEXT QUESTION');
 releaseResponse();
 await page.waitForFunction(()=>document.querySelector('[role=log]')?.innerText.match(/A grounded discussion reply/g)?.length===3);
 assert.equal(await page.getByLabel('向 AI 提问',{exact:true}).inputValue(),'KEEP MY NEXT QUESTION');
 checks.push('An arriving AI reply preserves the next question being typed');
 await page.getByRole('button',{name:'AI 提取文章重点',exact:true}).click();await page.getByRole('button',{name:'提取重点',exact:true}).click();await page.getByRole('log').getByText(/阅读和反思帮助理解材料/).waitFor();
 assert.ok(requests.at(-1).body.messages.at(-1).content.includes('Daily practice connects ideas'));
 // The screenshot flow above deliberately changed the default. Verify that
 // actual reading now uses that new exact ID, rather than the initial model.
 assert.equal(requests.at(-1).url,'https://relay.example/gateway/v1/chat/completions');assert.equal(requests.at(-1).body.model,customId);
 const sendBox=await page.getByRole('button',{name:'提取重点',exact:true}).boundingBox(); assert.ok(sendBox.y+sendBox.height<960,'Send remains visible below conversation history');
 await page.getByText('查看学习候选与详细分析',{exact:true}).click();await page.getByText('reflect',{exact:true}).first().waitFor();
 await page.screenshot({path:'build/discussion-reader-1440.png'});
 checks.push('One note editor, understanding feedback, follow-up conversation and article highlights all send through the configured adapter and display results beside the original');
 const select=page.getByLabel('当前材料',{exact:true});const ids=await select.locator('option').evaluateAll(es=>es.map(e=>e.value));const currentSource=await select.inputValue();const otherSource=ids.find(id=>id!==currentSource);await select.selectOption(otherSource);assert.equal(await page.getByRole('log').getByText(/A grounded discussion reply/).count(),0);await select.selectOption(currentSource);assert.equal(await page.getByRole('log').getByText(/A grounded discussion reply/).count(),3);
 await page.reload();await page.getByRole('log').getByText(/A grounded discussion reply/).first().waitFor();
 checks.push('Conversations are isolated by material and survive a reload without overwriting the note');
 await page.goto(base+'/publish/');
 for(const title of ['Reading and reflection','Practice connects ideas']) {const button=page.getByRole('button').filter({has:page.getByText(title,{exact:true})}).first();if(!(await button.innerText()).includes('已选'))await button.click();}
 await page.getByLabel('自定义输入',{exact:true}).fill('My supplementary observation.');
 await page.getByLabel('标题（可选）',{exact:true}).fill('Learning through reflection');
 await page.getByRole('tab',{name:'AI 创作',exact:true}).click();
 for(const [label,value] of [['创作主题','Learning through reflection'],['我的思考（Reflection）','I connect reading with practice.'],['写作要求或修改反馈','Compare both sources and my reflection.']]) {const field=page.getByLabel(label,{exact:true});await field.fill(value);assert.equal(await field.evaluate(e=>e===document.activeElement),true);}
 await page.locator('label').filter({hasText:'允许本次将所选材料正文发送给远程模型'}).getByRole('checkbox').check();await page.getByRole('button',{name:'综合材料生成文章',exact:true}).click();
 const editor=page.getByLabel('草稿内容',{exact:true});await page.waitForFunction(()=>[...document.querySelectorAll('textarea')].some(e=>e.value.includes('## Selected source index')));
 const sent=JSON.parse(requests.at(-1).body.messages.at(-1).content);assert.equal(sent.sources.length,3);assert.ok(sent.reflection.includes('reading with practice'));
 await editor.fill((await editor.inputValue())+'\nMY PERSONAL EDIT');await page.getByLabel('写作要求或修改反馈',{exact:true}).fill('Improve the opening and keep my viewpoint.');await page.getByRole('button',{name:'按反馈修改当前草稿',exact:true}).click();await page.waitForFunction(()=>[...document.querySelectorAll('textarea')].some(e=>e.value.includes('## Selected source index')&&!e.value.includes('MY PERSONAL EDIT')));assert.ok(JSON.parse(requests.at(-1).body.messages.at(-1).content).currentDraft.includes('MY PERSONAL EDIT'));
 await editor.fill((await editor.inputValue())+'\nRECOVER THIS DRAFT');await page.reload();await page.getByText('已接续上次草稿，可直接编辑。',{exact:true}).waitFor();assert.ok((await editor.inputValue()).includes('RECOVER THIS DRAFT'));assert.equal(await page.locator('[inert]').count(),0);
 await page.getByRole('tab',{name:'AI 创作',exact:true}).click();const reflection=page.getByLabel('我的思考（Reflection）',{exact:true});await reflection.click();await page.keyboard.type(' This field is editable after recovery.');assert.ok((await reflection.inputValue()).includes('editable after recovery'));
 checks.push('Every left input accepts focus and typing; multiple sources and reflection reach AI; revised text returns to the right; recovery retains edits without disabling the workspace');
 for(const route of ['config-center','inbox','publish']) {await page.locator(`header nav a[href="/${route}/"]`).filter({visible:true}).click();await page.waitForURL(base+`/${route}/`);}
 checks.push('Settings, Import and Create navigation works after unsaved draft recovery');
 // A long article uses an actual document-sized editor; its text is not trapped in a small fixed box.
 const longArticle = '# Long article\n\n' + Array.from({length:60},(_,i)=>`Paragraph ${i+1}. Reading and reflection connect the original sources with our own understanding. More details remain editable.`).join('\n\n');
 await editor.fill(longArticle);
 await page.waitForFunction(()=>{const e=document.querySelector('.publish-text-body textarea');return e && e.clientHeight>=e.scrollHeight-2 && e.clientHeight>1500;});
 const buttons=await page.locator('.publish-actions > div > button, .publish-actions summary').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().toJSON()));
 assert.equal(buttons.length,3);assert.ok(Math.max(...buttons.map(b=>b.width))-Math.min(...buttons.map(b=>b.width))<2);
 assert.ok(Math.max(...buttons.map(b=>b.y))-Math.min(...buttons.map(b=>b.y))<2);
 assert.equal(await page.locator('.publish-actions').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 250, 240)','Sticky document actions must hide scrolled text rather than showing overlapping ghost text');
 await page.getByRole('button',{name:'展开编辑',exact:true}).click();assert.equal(await page.locator('.publish-editor-expanded').count(),1);
 assert.equal(await page.locator('.publish-editor-expanded > div:first-child').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 250, 240)','The expanded editor heading must also be opaque above scrolling content');
 await page.keyboard.press('Escape');assert.equal(await page.locator('.publish-editor-expanded').count(),0);
 await page.locator('.publish-text-body textarea').evaluate(e=>e.scrollIntoView({block:'end'}));
 assert.ok((await page.locator('.publish-actions').boundingBox()).y>=70,'document actions stay visible while reading a long article');
 assert.equal(await editor.inputValue(),longArticle);checks.push('Long articles expand the editor with no inner vertical clipping; expanded editing exits with Escape; three equal action controls stay accessible');
 await editor.fill('# A short note\n\nReadable and editable.');

 for(const width of [900,1024,1440,1920]) {await page.setViewportSize({width,height:960});await page.goto(base+'/publish/');const pos=await page.locator('.publish-workbench').evaluate(e=>({columns:getComputedStyle(e).gridTemplateColumns,rootWidth:document.documentElement.scrollWidth,width:innerWidth,controls:e.querySelector('.publish-controls').getBoundingClientRect().toJSON(),output:e.querySelector('.publish-output').getBoundingClientRect().toJSON()}));assert.ok(Math.abs(pos.controls.y-pos.output.y)<3);assert.ok(pos.output.x>pos.controls.x);assert.ok(pos.rootWidth<=pos.width+1);await page.screenshot({path:`build/discussion-publish-${width}.png`});await page.goto(base+'/reader/');const reader=await page.locator('.reader-workbench').evaluate(e=>{const a=e.querySelector('.reader-original').getBoundingClientRect(),b=e.querySelector('.reader-assistant').getBoundingClientRect();return {a:a.toJSON(),b:b.toJSON(),root:document.documentElement.scrollWidth,w:innerWidth};});assert.ok(Math.abs(reader.a.y-reader.b.y)<3);assert.ok(reader.b.x>reader.a.x);assert.ok(reader.root<=reader.w+1);await page.screenshot({path:`build/discussion-reader-${width}.png`});}
 checks.push('Reader and Create retain side-by-side panes at CSS widths 900/1024/1440/1920, including zoomed-desktop-equivalent widths, with no horizontal page overflow');
 await page.setViewportSize({width:1440,height:960});await page.getByLabel('学习模式',{exact:true}).selectOption('zh');await page.getByRole('tab',{name:'My note',exact:true}).waitFor();await page.getByRole('tab',{name:'AI discussion',exact:true}).click();
 const chinese=await page.locator('.reader-assistant').evaluate(e=>{const walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);const out=[];let n;while(n=walker.nextNode()){if(n.parentElement.closest('[hidden], [role=log], details:not([open]), select, textarea'))continue;if(n.parentElement.getClientRects().length&&/[\u4e00-\u9fff]/.test(n.textContent))out.push(n.textContent)}return out;});assert.deepEqual(chinese,[]);checks.push('New reader controls are consistently English after switching learning mode');
 assert.deepEqual(errors,[]);
 fs.writeFileSync('build/discussion-workbench-results.json',JSON.stringify({checkedAt:new Date().toISOString(),checks,errors,requestCount:requests.length,scope:'Production web bundle with controlled network responses; no live provider credentials or desktop package used.'},null,2));console.log(JSON.stringify({checks,errors,requests:requests.length},null,2));
} catch(error) {await page.screenshot({path:'build/discussion-failure.png'});console.error('URL',page.url());throw error;}finally{await browser.close();}
