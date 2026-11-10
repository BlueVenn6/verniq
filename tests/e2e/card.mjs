import { chromium } from 'playwright-core';
import fs from 'node:fs';import assert from 'node:assert/strict';
const origin=process.env.VERNIQ_TEST_URL||'http://127.0.0.1:3177';
const browser=await chromium.launch({...(process.env.VERNIQ_BROWSER_PATH ? {executablePath:process.env.VERNIQ_BROWSER_PATH} : process.platform==='win32' ? {channel:'msedge'} : {}),headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1100}});
const seed={schemaVersion:5,languageSettings:{uiLanguage:'zh-CN',targetLanguage:'en',explanationLanguage:'zh-CN'}};
await context.addInitScript(s=>{if(!localStorage.getItem('my-life-map:workspace:core:v1'))localStorage.setItem('my-life-map:workspace:core:v1',JSON.stringify(s));},seed);
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>d.accept());const checks=[],exports=[];
try{
 await page.goto(origin+'/publish/');await page.getByRole('button',{name:/^分享卡片/}).click();
 await page.getByLabel('卡片内容',{exact:true}).fill('Read. Reflect.\n阅读与思考。');await page.getByRole('tab',{name:'卡片样式',exact:true}).click();await page.getByLabel('比例',{exact:true}).selectOption('1:1');await page.getByLabel('版式',{exact:true}).selectOption('image_top');
 const source=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=800;c.height=1200;const ctx=c.getContext('2d');const data=ctx.createImageData(800,1200);for(let y=0;y<1200;y++)for(let x=0;x<800;x++){const i=(y*800+x)*4;data.data[i]=Math.round(x/799*255);data.data[i+1]=Math.round(y/1199*255);data.data[i+2]=64;data.data[i+3]=255;}ctx.putImageData(data,0,0);return c.toDataURL('image/png').split(',')[1];});
 const sourceFile={name:'framing-test.png',mimeType:'image/png',buffer:Buffer.from(source,'base64')};fs.writeFileSync('build/card-framing-source.png',sourceFile.buffer);
 await page.getByLabel('卡片配图',{exact:true}).setInputFiles(sourceFile);
 await page.getByLabel('品牌显示',{exact:true}).selectOption('custom_name');await page.getByLabel('你的名字或署名',{exact:true}).fill('Ada');
 const card=page.locator('svg[data-card-fits]'),region=card.locator('[data-card-image-region]'),image=region.locator('image'),drag=page.getByRole('button',{name:'拖动图片调整构图',exact:true});
 await drag.waitFor();
 // A nested SVG's bounding box can include its oversized, clipped image.
 // Compare the hit target with the intended viewport, measured from the root SVG.
 const alignment=await drag.evaluate(e=>{const root=e.parentElement.querySelector('svg[data-card-fits]'),r=root.getBoundingClientRect(),b=e.getBoundingClientRect();return {actual:{x:b.x,y:b.y,width:b.width,height:b.height},expected:{x:r.x,y:r.y,width:r.width,height:r.height/2}};});
 for(const key of ['x','y','width','height'])assert.ok(Math.abs(alignment.actual[key]-alignment.expected[key])<1,JSON.stringify(alignment));assert.equal(await page.getByLabel('图片取景',{exact:true}).count(),0);
 assert.deepEqual(await region.evaluate(e=>['x','y','width','height'].map(a=>Number(e.getAttribute(a)))),[0,0,1600,800]);
 assert.equal(await card.locator('line,[stroke]').count(),0);
 async function imagePosition(){return image.evaluate(e=>Object.fromEntries(['x','y','width','height'].map(a=>[a,Number(e.getAttribute(a))])));}
 async function exportCard(name){const menu=page.locator('.publish-actions details');if((await menu.getAttribute('open'))===null)await menu.locator('summary').click();const event=page.waitForEvent('download',{timeout:90000});await page.getByRole('button',{name:'导出 PNG',exact:true}).click();const d=await event;const file='build/'+name+'.png';await d.saveAs(file);const bytes=fs.readFileSync(file);assert.match(d.suggestedFilename(),/\.png$/);const sample=await page.evaluate(async data=>{const img=await createImageBitmap(await(await fetch('data:image/png;base64,'+data)).blob());const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);const at=(x,y)=>Array.from(ctx.getImageData(x,y,1,1).data);return {width:img.width,height:img.height,edgePixels:[at(0,0),at(img.width-1,0),at(0,img.height/2-1),at(img.width-1,img.height/2-1)],below:at(0,img.height/2),center:at(img.width/2,img.height/4)};},bytes.toString('base64'));exports.push({file,name:d.suggestedFilename(),bytes:bytes.length,...sample});return sample;}
 const first=await exportCard('card-fullbleed-before-pan');for(const pixel of first.edgePixels){assert.equal(pixel[2],64);assert.equal(pixel[3],255);}assert.deepEqual(first.below,[250,243,230,255]);
 checks.push('Top image reaches all outer edges and exactly half the PNG; there is no inner border, inset margin or decorative rule');
 await page.getByRole('slider',{name:'图片缩放',exact:true}).fill('200');const zoomed=await imagePosition();assert.equal(zoomed.width,3200);assert.equal(zoomed.height,4800);
 await drag.scrollIntoViewIfNeeded();const box=await drag.boundingBox();const before=await imagePosition();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+60,box.y+box.height/2+40,{steps:10});await page.mouse.up();const after=await imagePosition();assert.ok(after.x>before.x);assert.ok(after.y>before.y);
 const changed=await exportCard('card-fullbleed-after-pan');assert.notDeepEqual(changed.center,first.center);
 const expectedCenter=[Math.round((800-after.x)/after.width*255),Math.round((400-after.y)/after.height*255),64,255];for(let channel=0;channel<4;channel++)assert.ok(Math.abs(changed.center[channel]-expectedCenter[channel])<=2,'exported pixels match the preview crop');
 await drag.focus();const keyBefore=await imagePosition();await page.keyboard.press('ArrowLeft');assert.ok((await imagePosition()).x<keyBefore.x,'left arrow moves the image left');
 checks.push('Zoom, real mouse dragging and keyboard adjustment change the composition, and the exported pixels match the new framing');
 // Pointer capture keeps drag working after leaving the picture, and clamps the image to avoid gaps.
 await drag.scrollIntoViewIfNeeded();const outside=await drag.boundingBox();await page.mouse.move(outside.x+outside.width/2,outside.y+outside.height/2);await page.mouse.down();await page.mouse.move(20,Math.min(1050,outside.y+outside.height+300),{steps:12});await page.mouse.up();const clamped=await imagePosition();assert.ok(clamped.x<=0&&clamped.y<=0&&clamped.x+clamped.width>=1600&&clamped.y+clamped.height>=800);
 await page.getByRole('button',{name:'重置构图',exact:true}).click();assert.equal(await page.getByRole('slider',{name:'图片缩放',exact:true}).inputValue(),'100');assert.deepEqual(await imagePosition(),{x:0,y:-800,width:1600,height:2400});
 checks.push('Dragging outside the image stays constrained without blank edges; reset restores the original centered cover');
 for(const ratio of ['1:1','4:5','16:9'])for(const layout of ['image_top','image_left']){
  await page.getByLabel('比例',{exact:true}).selectOption(ratio);await page.getByLabel('版式',{exact:true}).selectOption(layout);
  assert.equal(await card.getAttribute('data-card-fits'),'true',`${ratio} ${layout}`);
  const bounds=await card.evaluate(e=>{const r=e.querySelector('[data-card-image-region]'),f={x:Number(r.getAttribute('x')),y:Number(r.getAttribute('y')),width:Number(r.getAttribute('width')),height:Number(r.getAttribute('height'))};return {frame:f,width:e.viewBox.baseVal.width,height:e.viewBox.baseVal.height,texts:[...e.children].filter(t=>t.tagName==='text'&&t.textContent.trim()).map(t=>{const b=t.getBBox();return {x:b.x,y:b.y,width:b.width,height:b.height};})};});
  assert.equal(bounds.frame.x,0);assert.equal(bounds.frame.y,0);assert.equal(bounds.frame.width,layout==='image_left'?bounds.width/2:bounds.width);assert.equal(bounds.frame.height,layout==='image_top'?bounds.height/2:bounds.height);
  for(const b of bounds.texts){assert.ok(b.x>=0&&b.y>=0&&b.x+b.width<=bounds.width+1&&b.y+b.height<=bounds.height+1);if(layout==='image_top')assert.ok(b.y>=bounds.frame.height);else assert.ok(b.x>=bounds.frame.width);}
 }
 checks.push('All three ratios keep a stable half-image layout; text and custom identity remain in the separate text area');
 await page.getByLabel('比例',{exact:true}).selectOption('1:1');await page.getByLabel('版式',{exact:true}).selectOption('image_top');await page.getByRole('tab',{name:'材料与形式',exact:true}).click();await page.getByLabel('标题（可选）',{exact:true}).fill('Framing');await page.getByRole('tab',{name:'卡片样式',exact:true}).click();await page.getByRole('slider',{name:'图片缩放',exact:true}).fill('185');await drag.focus();await page.keyboard.press('ArrowRight');const savedPlacement=await imagePosition();
 await page.getByRole('button',{name:'保存草稿',exact:true}).click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('my-life-map:workspace:core:v1')).outputDrafts?.some(d=>d.title==='Framing'&&d.publishVisualSettings?.imageZoom===1.85));
 await page.reload();await page.locator('details[aria-label="已保存的草稿"] > summary').click();await page.getByRole('button',{name:'Framing',exact:true}).click();await page.getByRole('tab',{name:'卡片样式',exact:true}).click();assert.equal(await page.getByRole('button',{name:'拖动图片调整构图',exact:true}).count(),0);
 await page.getByLabel('卡片配图',{exact:true}).setInputFiles(sourceFile);await drag.waitFor();assert.equal(await page.getByRole('slider',{name:'图片缩放',exact:true}).inputValue(),'185');assert.deepEqual(await imagePosition(),savedPlacement);
 checks.push('Saved crop position and zoom return after reload and selecting the image again; reopening a draft never borrows another draft image');
 await page.getByRole('heading',{name:'设置卡片呈现',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:'build/card-framing-controls-zh.png',fullPage:false});
 await page.getByRole('combobox',{name:'学习模式',exact:true}).selectOption('zh');await page.getByRole('slider',{name:'Image zoom',exact:true}).waitFor();await page.getByRole('button',{name:'Drag image to reframe',exact:true}).waitFor();
 const layouts=[];for(const width of [1440,1024,900,768,390]){await page.setViewportSize({width,height:1100});const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);assert.equal(overflow,false);layouts.push({language:'en',width,overflow});}
 await page.setViewportSize({width:1440,height:1100});await page.getByRole('slider',{name:'Image zoom',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:'build/card-framing-controls-en.png',fullPage:false});
 checks.push('Image controls and instructions switch to English and remain within the viewport at five widths');
 assert.deepEqual(errors,[]);fs.writeFileSync('build/card-framing-results.json',JSON.stringify({checks,exports,layouts,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}catch(error){await page.screenshot({path:'build/card-framing-failure.png',fullPage:true});fs.writeFileSync('build/card-framing-failure.txt',String(error)+'\n'+await page.locator('body').innerText());throw error;}finally{await browser.close();}
