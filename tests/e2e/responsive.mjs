import {chromium} from 'playwright-core';import fs from 'node:fs';import assert from 'node:assert/strict';
const base=process.env.VERNIQ_TEST_URL || 'http://127.0.0.1:3177';
const b=await chromium.launch({...(process.env.VERNIQ_BROWSER_PATH ? {executablePath:process.env.VERNIQ_BROWSER_PATH} : process.platform==='win32' ? {channel:'msedge'} : {}),headless:true});const c=await b.newContext({viewport:{width:1257,height:704},deviceScaleFactor:2.25});
const now=new Date().toISOString();
const seed={schemaVersion:5,sourceMaterials:[{id:'synthetic-source',goalId:'',title:'A long original title with clear words and readable navigation',sourceType:'text',language:'en',originalContent:'We read, reflect and learn.',cleanedContent:'We read, reflect and learn.',createdAt:now,updatedAt:now}]};
seed.sourceMaterials.push({id:'old-failed-pdf',goalId:'',title:'boxing_player',fileName:'boxing_player.pdf',sourceType:'file',language:'en',originalContent:'',cleanedContent:'',createdAt:now,updatedAt:now,metadata:{ingestError:'Setting up fake worker failed: "Failed to fetch dynamically imported module: http://127.0.0.1:3110/_next/static/media/pdf.worker.min.'+'unbroken'.repeat(60)+'.mjs"',ingestStatus:'failed'}});
seed.readerMessages=[{id:'long-ai',sourceMaterialId:seed.sourceMaterials[0].id,role:'assistant',text:'A useful response with a long source URL: https://example.com/'+ 'long-source-identifier'.repeat(70),createdAt:now}];
await c.addInitScript(seed=>{const key='my-life-map:workspace:core:v1';if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(seed));},seed);
const p=await c.newPage();const checks=[],errors=[];p.on('pageerror',e=>errors.push(String(e)));
try{
 for(const language of ['en','zh']){
  await p.goto(base+'/inbox/');await p.getByLabel(/^(学习模式|Learning mode)$/, {exact:true}).selectOption(language);
  for(const width of [390,900,1024,1257,1440,1920]){
   await p.setViewportSize({width,height:704});
   for(const route of ['/','/inbox/','/reader/','/review/','/organize/','/growth/','/publish/','/config-center/']){
    await p.goto(base+route);await p.locator('header').first().waitFor();
    const bounds=await p.evaluate(()=>{const w=document.documentElement.clientWidth;return{width:w,scroll:document.documentElement.scrollWidth,panes:[...document.querySelectorAll('.reader-original,.reader-assistant,.publish-controls,.publish-output,aside[aria-label]')].filter(e=>e.getClientRects().length&&!e.hidden).map(e=>({name:e.getAttribute('aria-label')||e.className,right:e.getBoundingClientRect().right,left:e.getBoundingClientRect().left})),outside:[...document.querySelectorAll('input:not([type=hidden]),textarea,button,a,select')].filter(e=>getComputedStyle(e).visibility!=='hidden'&&e.getClientRects().length).filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.right>w+1;}).slice(0,6).map(e=>e.getAttribute('aria-label')||e.textContent.slice(0,70))};});
    assert.ok(bounds.scroll<=bounds.width+1,JSON.stringify({language,width,route,bounds}));assert.deepEqual(bounds.outside,[],JSON.stringify({language,width,route,bounds}));assert.ok(bounds.panes.every(p=>p.right<=bounds.width+1&&p.left>=-1),JSON.stringify({language,width,route,bounds}));
    if(route==='/inbox/')assert.ok(!(await p.locator('body').innerText()).includes('Setting up fake worker'));
    if(width===1257&&['/inbox/','/reader/','/publish/'].includes(route))await p.screenshot({path:`build/final-bounds-${language}-${route.slice(1,-1)}.png`});
    checks.push({language,width,route,noHorizontalClipping:true});
   }
  }
 }
 assert.deepEqual(errors,[]);fs.writeFileSync('build/window-bounds-results.json',JSON.stringify({checks,errors,scope:'Production bundle; original reported 1257x704 CSS viewport at device scale 2.25 plus five other widths. Historical worker error and long AI URL seeded.'},null,2));console.log(JSON.stringify({pageViewportChecks:checks.length,errors}));
}catch(e){await p.screenshot({path:'build/window-bounds-failure.png'});throw e;}finally{await b.close();}
