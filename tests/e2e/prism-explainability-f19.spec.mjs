import {test,expect} from '@playwright/test';
import {openModel,train,chart,ready,json,download} from '../support/f19-browser.mjs';
async function openExplanation(panel){await panel.locator('summary:visible').filter({hasText:'F13 — Explainability & Diagnostics Studio'}).first().click();return panel.getByRole('region',{name:'F13 Explainability Studio',exact:true});}
async function view(panel,name){await panel.getByRole('group',{name:'F13 diagnostic views',exact:true}).getByRole('button',{name,exact:true}).click();}
test('F19 completed permutation, PDP/ICE, what-if and subgroup results share faithful visual panels',async({page,isMobile},testInfo)=>{
  const panel=await openModel(page);await train(panel,'logistic');const f13=await openExplanation(panel);
  await f13.getByRole('button',{name:'Measure feature importance',exact:true}).click();await expect(f13.getByRole('region',{name:'F13 importance evidence table',exact:true})).toBeVisible();
  await f13.locator('summary').filter({hasText:'F19 — Visual Explainability'}).click();await ready(f13);let spec=await json(page,f13);expect(spec.chartType).toBe('model_importance');expect(spec.evidence.rows.every(r=>r.sd>=0)).toBe(true);
  expect((await chart(f13).locator('.prism-f18-canvas').boundingBox()).width).toBeGreaterThanOrEqual(480);
  if(isMobile){const viewport=chart(f13).getByRole('region',{name:'Scrollable model chart canvas',exact:true});await viewport.focus();await page.keyboard.press('ArrowRight');await expect.poll(()=>viewport.evaluate(el=>el.scrollLeft)).toBeGreaterThan(0);}
  await chart(f13).locator('.prism-f18-canvas').evaluate(el=>el.scrollIntoView({block:'center'}));
  await chart(f13).locator('.prism-f18-canvas').screenshot({path:testInfo.outputPath('f19-permutation.png')});
  expect((await download(page,chart(f13).getByRole('button',{name:'Export SVG',exact:true}))).toString()).toContain('<svg');
  await view(f13,'Local explanation');await ready(f13);expect((await json(page,f13)).exportManifest.mode).toBe('metadata_only');
  await chart(f13).getByLabel('Allow observation-level chart exports',{exact:true}).check();spec=await json(page,f13);expect(spec.chartType).toBe('model_contributions');expect(spec.plot.yLabel).toContain('log-odds');
  const source=(await download(page,chart(f13).getByRole('button',{name:'Download .js',exact:true}))).toString();
  const restored=await page.evaluate(async({source,spec})=>{
    let option;const echarts={init:()=>({setOption:value=>{option=value;},resize:()=>{}})};
    const program=source.replace('import * as echarts from "echarts";','');
    const run=new Function('echarts','fetch','document','ResizeObserver','return (async()=>{'+program+'})()');
    await run(echarts,async()=>({ok:true,json:async()=>spec}),{getElementById:()=>({})},class{observe(){}});
    return typeof option.series[0].renderItem;
  },{source,spec});expect(restored).toBe('function');
  await chart(f13).locator('.prism-f18-canvas').evaluate(el=>el.scrollIntoView({block:'center'}));
  await chart(f13).locator('.prism-f18-canvas').screenshot({path:testInfo.outputPath('f19-waterfall.png')});
  await chart(f13).getByLabel('F18 renderer',{exact:true}).selectOption('canvas');await expect(chart(f13).locator('.prism-f18-canvas canvas')).toBeVisible();expect((await download(page,chart(f13).getByRole('button',{name:'Export SVG',exact:true}))).toString()).toContain('<svg');
  await view(f13,'PDP / ICE');await expect(chart(f13)).toHaveCount(0);await f13.getByRole('button',{name:'Calculate partial dependence',exact:true}).click();await ready(f13);await chart(f13).getByLabel('Allow observation-level chart exports',{exact:true}).check();spec=await json(page,f13);expect(spec.evidence.rows.some(r=>r.series.startsWith('ICE '))).toBe(true);
  await view(f13,'What-if');const input=f13.getByLabel('F13 hypothetical numeric value',{exact:true});await input.fill(String((Number(await input.getAttribute('min'))+Number(await input.getAttribute('max')))/2));await f13.getByRole('button',{name:'Evaluate hypothetical prediction',exact:true}).click();await ready(f13);await chart(f13).getByLabel('Allow observation-level chart exports',{exact:true}).check();expect((await json(page,f13)).chartType).toBe('model_whatif');
  await input.fill(await input.getAttribute('max'));await expect(chart(f13)).toHaveCount(0);
  await view(f13,'Subgroups');await f13.getByRole('button',{name:'Analyze validation subgroups',exact:true}).click();await ready(f13);expect((await json(page,f13)).chartType).toBe('model_subgroups');
  await expect(panel.getByRole('region',{name:'F12 final test results',exact:true})).toHaveCount(0);
});
test('F19 model-specific tree, forest and neighbor visuals reset when candidate changes',async({page})=>{
  const panel=await openModel(page);
  for(const algorithm of ['cart','forest','knn','baseline']){
    await train(panel,algorithm);const f13=await openExplanation(panel);await view(f13,'Local explanation');await f13.locator('summary').filter({hasText:'F19 — Visual Explainability'}).click();await ready(f13);
    await chart(f13).getByLabel('Allow observation-level chart exports',{exact:true}).check();const spec=await json(page,f13);expect(spec.chartType).toBe('model_model_specific');expect(spec.modelContext.algorithm).toBe(algorithm);expect(JSON.stringify(spec)).not.toContain('sample-');expect(JSON.stringify(spec)).not.toContain('neighbors');
  }
});
test('F19 cancellation leaves no stale chart and a new worker can finish',async({page})=>{
  const panel=await openModel(page);await train(panel,'logistic');const f13=await openExplanation(panel);
  await page.evaluate(()=>new Promise(resolve=>{
    const observer=new MutationObserver(()=>{const button=[...document.querySelectorAll('button')].find(b=>b.textContent==='Cancel analysis');if(button){observer.disconnect();button.click();resolve();}});
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});[...document.querySelectorAll('button')].find(b=>b.textContent==='Measure feature importance').click();
  }));
  await expect(f13).toContainText('Analysis cancelled.');await f13.locator('summary').filter({hasText:'F19 — Visual Explainability'}).click();await expect(chart(f13)).toHaveCount(0);
  await f13.getByRole('button',{name:'Measure feature importance',exact:true}).click();await ready(f13);expect((await json(page,f13)).chartType).toBe('model_importance');
  await train(panel,'baseline');const next=await openExplanation(panel);await next.locator('summary').filter({hasText:'F19 — Visual Explainability'}).click();await expect(chart(next)).toHaveCount(0);
});
