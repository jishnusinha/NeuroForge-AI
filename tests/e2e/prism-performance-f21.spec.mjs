import {test,expect} from '@playwright/test';
import {studio} from '../support/f21-browser.mjs';
import {readdir,stat} from 'node:fs/promises';
test('F21 initial JavaScript stays within the measured shell growth budget',async()=>{const name=(await readdir('client/dist/assets')).find(name=>/^index-.*\.js$/.test(name));expect(name).toBeTruthy();expect((await stat('client/dist/assets/'+name)).size).toBeLessThanOrEqual(361337);});
test('F21 landing canvas pauses its frame loop offscreen and releases it on navigation',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await page.addInitScript(()=>{const request=window.requestAnimationFrame.bind(window),cancel=window.cancelAnimationFrame.bind(window),frames=new Set();window.__f21Frames=frames;window.requestAnimationFrame=callback=>{const id=request(time=>{frames.delete(id);callback(time);});frames.add(id);return id;};window.cancelAnimationFrame=id=>{frames.delete(id);cancel(id);};});
 await page.goto('/');await page.locator('canvas').scrollIntoViewIfNeeded();await expect.poll(()=>page.evaluate(()=>window.__f21Frames.size)).toBeGreaterThan(0);await page.locator('footer').scrollIntoViewIfNeeded();await expect.poll(()=>page.evaluate(()=>window.__f21Frames.size)).toBe(0);await page.goto('/app');await expect.poll(()=>page.evaluate(()=>window.__f21Frames.size)).toBe(0);
});
test('F21 lab draft feedback reserves layout space at mobile, tablet and wide desktop sizes',async({browser},info)=>{
 test.setTimeout(90000);const results=[];
 for(const width of [390,768,1920])for(const route of ['playground','studio']){const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});try{await context.addInitScript(()=>{window.__f21CLS=0;new PerformanceObserver(list=>{for(const entry of list.getEntries())if(!entry.hadRecentInput)window.__f21CLS+=entry.value;}).observe({type:'layout-shift',buffered:true});});const page=await context.newPage();await page.goto('http://127.0.0.1:'+(process.env.NEUROFORGE_E2E_PORT||4179)+'/app/'+route);await expect(page.getByText('Saved on device',{exact:true})).toBeVisible();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const cls=await page.evaluate(()=>window.__f21CLS);results.push({route,width,cls});expect(cls,route+' '+width).toBeLessThanOrEqual(.1);}finally{await context.close();}}
 await info.attach('lab-layout-shift',{body:JSON.stringify(results),contentType:'application/json'});
});
test('F21 homepage keeps chart runtime lazy and repeated chart switches release renderers',async({page},info)=>{
 await page.addInitScript(()=>{const Native=window.ResizeObserver,active=new Set();window.__f21Observers=active;window.ResizeObserver=class extends Native{observe(...args){active.add(this);return super.observe(...args);}disconnect(){active.delete(this);return super.disconnect();}};});
 await page.goto('/app');expect(await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>/install-.*\.js/.test(r.name)).length)).toBe(0);
 const panel=await studio(page),measurements=[],active=await page.evaluate(()=>window.__f21Observers.size);
 for(const type of ['scatter','histogram','scatter','histogram']){await panel.getByLabel('F18 chart type',{exact:true}).selectOption(type);await expect(panel.locator('.prism-f18-canvas svg')).toHaveCount(1);await expect.poll(()=>page.evaluate(()=>window.__f21Observers.size)).toBe(active);measurements.push(await panel.getByTestId('f18-render-benchmark').innerText());}
 await page.getByRole('button',{name:'Overview',exact:true}).click();await expect(page.locator('.prism-f18-canvas')).toHaveCount(0);
 // The persistent DataSheet owns a legitimate observer until the dataset route unmounts.
 await expect.poll(()=>page.evaluate(()=>window.__f21Observers.size)).toBe(active-1);await page.getByRole('navigation',{name:'Breadcrumb'}).getByRole('link',{name:'NeuroForge',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.__f21Observers.size)).toBe(0);await info.attach('chart-lifecycle',{body:JSON.stringify(measurements),contentType:'application/json'});
});
