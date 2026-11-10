import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';import fs from 'node:fs';
const base=process.env.VERNIQ_TEST_URL || 'http://127.0.0.1:3177';
const b=await chromium.launch({...(process.env.VERNIQ_BROWSER_PATH ? {executablePath:process.env.VERNIQ_BROWSER_PATH} : process.platform==='win32' ? {channel:'msedge'} : {}),headless:true});
const c=await b.newContext({viewport:{width:1272,height:704}});const p=await c.newPage();const errors=[],warnings=[],checks=[];
p.on('pageerror',e=>errors.push(String(e)));p.on('console',e=>{if(/cMapUrl|fake worker failed/i.test(e.text()))warnings.push(e.text());});
async function upload(file){await p.goto(base+'/inbox/');await p.getByRole('tab',{name:/^(选择文档|Choose a document)$/,exact:true}).click();await p.locator('input[type=file]').first().setInputFiles('tests/fixtures/documents/'+file);await p.getByRole('button',{name:/^(导入并开始阅读|Import and read)$/,exact:true}).click();}
try{
 for(const [file,language,text]of [['chinese-pdf.pdf','zh','我们每天阅读'],['english-pdf.pdf','en','We read and reflect'],['chinese-docx.docx','zh','学习来自阅读'],['chinese-text.txt','zh','我们每天阅读'],['english-markdown.markdown','en','English text'],['english-page.html','en','English text']]){
  await upload(file);await p.waitForURL(/\/reader\/?\?/);await p.locator('[data-reading-segment]').first().waitFor();
  const source=await p.evaluate(file=>JSON.parse(localStorage.getItem('my-life-map:workspace:core:v1')).sourceMaterials.find(s=>s.fileName===file),file);
  assert.equal(source.language,language);assert.ok(source.cleanedContent.includes(text));assert.equal(source.metadata.ingestStatus,'ingested');
  if(language==='zh'){assert.equal(await p.getByRole('button',{name:'切换为学习中文',exact:true}).isVisible(),true);assert.ok((await p.getByRole('main',{name:'阅读原文',exact:true}).innerText()).includes('你当前正在学英语'));}
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1),false,`No horizontal overflow: ${file}`);
  checks.push({file,language,characters:source.cleanedContent.length,opensReader:true});
 }
 for(const [file,reason] of [['scanned-pdf.pdf','扫描版'],['locked-pdf.pdf','密码保护'],['broken-pdf.pdf','损坏']]){
  const count=await p.evaluate(()=>JSON.parse(localStorage.getItem('my-life-map:workspace:core:v1')).sourceMaterials.length);
  await upload(file);const alert=p.getByRole('alert').filter({hasText:reason});await alert.waitFor();assert.ok((await alert.innerText()).includes('不是学习语言限制'));
  assert.ok((await p.getByRole('button',{name:new RegExp(file.replaceAll('.','\\.'))}).innerText()).includes(file));
  assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('my-life-map:workspace:core:v1')).sourceMaterials.length),count,'No false success or empty material');
  checks.push({file,errorExplained:true,inputPreserved:true});
 }
 await p.goto(base+'/reader/');await p.getByLabel('当前材料',{exact:true}).selectOption({label:'chinese-pdf'});await p.getByRole('button',{name:'切换为学习中文',exact:true}).click();await p.getByRole('tab',{name:'AI discussion',exact:true}).waitFor();
 // The translated tabs render before the Reader's separate workspace subscriber finishes syncing.
 await p.getByRole('button',{name:'Switch to learning Chinese',exact:true}).waitFor({state:'hidden'});
 await p.waitForFunction(()=>JSON.parse(localStorage.getItem('my-life-map:workspace:core:v1')).languageSettings.targetLanguage==='zh');
 assert.equal(await p.getByRole('button',{name:'Switch to learning Chinese',exact:true}).count(),0);
 checks.push({modeSwitch:'Chinese material switches to learning Chinese with English UI'});
 await p.goto(base+'/inbox/');await p.getByRole('tab',{name:'Choose a document',exact:true}).click();await p.locator('input[type=file]').first().setInputFiles('tests/fixtures/documents/scanned-pdf.pdf');await p.getByRole('button',{name:'Import and read',exact:true}).click();const alert=p.getByRole('region',{name:'Import form',exact:true}).getByRole('alert');await p.waitForFunction(()=>document.querySelector('[role=alert]')?.textContent.includes('scanned PDFs'));assert.ok((await alert.innerText()).includes('scanned PDFs'));assert.ok(!/[\u3400-\u9fff]/.test(await alert.innerText()));
 assert.deepEqual(errors,[]);assert.deepEqual(warnings,[]);await p.screenshot({path:'build/document-import-final-english-error.png'});
 fs.writeFileSync('build/document-import-results.json',JSON.stringify({checks,errors,warnings,scope:'Real production PDF, DOCX, TXT, Markdown and HTML parsers, including CID Chinese PDF. No parsing mocks.'},null,2));console.log(JSON.stringify({checks,errors,warnings},null,2));
}catch(e){await p.screenshot({path:'build/document-import-final-failure.png'});throw e;}finally{await b.close();}
