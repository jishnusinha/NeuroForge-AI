import {test,expect} from '@playwright/test';
import {openModel,train,openEvaluation,chart,ready,download,json} from '../support/f19-browser.mjs';
test.setTimeout(90000);
test('F19 classification gallery, real trace, safe exports and explicit final-test gate',async({page})=>{
  const panel=await openModel(page);await train(panel,'logistic');const studio=await openEvaluation(panel);
  const prior=await panel.getByRole('region',{name:'F12 validation results',exact:true}).innerText();
  for(const type of ['confusion','per_class','roc','precision_recall','calibration','confidence','training_loss']){
    await studio.getByLabel('F19 evaluation view',{exact:true}).selectOption(type);await ready(studio);const spec=await json(page,studio);expect(spec.chartType).toBe(type);expect(spec.modelContext.split).toBe(type==='training_loss'?'train':'validation');expect(spec.source.rowCount).toBeGreaterThan(0);expect(JSON.stringify(spec)).not.toContain('sample-');
    await chart(studio).getByRole('button',{name:'Data',exact:true}).click();await expect(chart(studio).getByRole('region',{name:'F18 exact plotted data',exact:true})).toBeVisible();await chart(studio).getByRole('button',{name:'Chart',exact:true}).click();await ready(studio);
  }
  expect(await panel.getByRole('region',{name:'F12 validation results',exact:true}).innerText()).toBe(prior);
  await expect(panel.getByRole('region',{name:'F12 final test results',exact:true})).toHaveCount(0);
  await studio.getByLabel('F19 evaluation view',{exact:true}).selectOption('confusion');await ready(studio);
  await studio.getByLabel('F19 normalize true class rows',{exact:true}).check();await ready(studio);expect((await json(page,studio)).plot.scaleMax).toBe(1);
  for(const view of ['Python','JavaScript','Methods']){await chart(studio).getByRole('button',{name:view,exact:true}).click();await expect(chart(studio)).toContainText(view==='Methods'?'membershipDigest':'recorded');}
  await chart(studio).getByRole('button',{name:'Chart',exact:true}).click();await ready(studio);
  await chart(studio).getByLabel('F18 renderer',{exact:true}).selectOption('canvas');await expect(chart(studio).locator('.prism-f18-canvas canvas').first()).toBeVisible();
  expect((await download(page,chart(studio).getByRole('button',{name:'Export SVG',exact:true}))).toString()).toContain('<svg');
  expect((await download(page,chart(studio).getByRole('button',{name:'Export PNG',exact:true}))).subarray(1,4).toString()).toBe('PNG');
  await page.getByRole('combobox',{name:'Visual theme'}).selectOption('paper');await expect(chart(studio).locator('.prism-f18-canvas canvas').first()).toBeVisible();
  await page.getByRole('combobox',{name:'Visual theme'}).selectOption('midnight');
  await chart(studio).getByRole('button',{name:'Data',exact:true}).focus();await page.keyboard.press('Enter');await expect(chart(studio).getByRole('region',{name:'F18 exact plotted data',exact:true})).toBeVisible();
  await panel.getByRole('button',{name:'Evaluate selected model on held-out test once',exact:true}).click();const final=panel.getByRole('region',{name:'F12 final test results',exact:true});await expect(final).toBeVisible();const finalStudio=await openEvaluation(final);const spec=await json(page,finalStudio);expect(spec.modelContext.split).toBe('test');expect(spec.modelContext.finalAccessedAt).toBeTruthy();await expect(panel.getByRole('button',{name:'Train and evaluate validation',exact:true})).toBeDisabled();
});
test('F19 regression plots link error records and require consent; switching candidate clears old context',async({page})=>{
  const panel=await openModel(page,{regression:true});await train(panel,'ridge');const studio=await openEvaluation(panel);
  for(const type of ['actual_predicted','residuals','residual_distribution','error_range']){
    await studio.getByLabel('F19 evaluation view',{exact:true}).selectOption(type);await ready(studio);const spec=await json(page,studio);expect(spec.modelContext.task).toBe('regression');if(['actual_predicted','residuals'].includes(type))expect(spec.exportManifest.mode).toBe('metadata_only');
  }
  await studio.getByLabel('F19 evaluation view',{exact:true}).selectOption('residuals');await ready(studio);
  await chart(studio).getByLabel('Allow observation-level chart exports',{exact:true}).check();const spec=await json(page,studio);expect(spec.evidence.rows.length).toBe(spec.source.rowCount);expect(spec.plot.reference).toBe('zero');
  await chart(studio).getByRole('button',{name:'Data',exact:true}).click();await chart(studio).getByRole('button',{name:'Link plotted row 1',exact:true}).click();await expect(studio.getByRole('region',{name:'F19 linked prediction records',exact:true})).toBeVisible();
  const digest=spec.modelContext.candidateDigest;await train(panel,'baseline');const next=await openEvaluation(panel);expect((await json(page,next)).modelContext.candidateDigest).not.toBe(digest);await expect(next.getByRole('region',{name:'F19 linked prediction records',exact:true})).toHaveCount(0);
});
test('F19 multiclass class selection uses recorded fitted order',async({page})=>{
  const panel=await openModel(page,{multi:true});await train(panel,'softmax');const studio=await openEvaluation(panel);await studio.getByLabel('F19 evaluation view',{exact:true}).selectOption('roc');await ready(studio);
  for(const index of ['0','1','2']){await studio.getByLabel('F19 probability class',{exact:true}).selectOption(index);await ready(studio);expect((await json(page,studio)).evidence.stats.class).toBe(['a','b','c'][Number(index)]);}
});
test('F19 bounded model rendering benchmark preserves source and disposes hidden surfaces',async({page},testInfo)=>{
  await page.goto('/app/datasets');const rows=Array.from({length:2000},(_,i)=>[i/10,i%17,2*i/10-i%17].join(','));
  await page.getByLabel('CSV file').setInputFiles({name:'f19-budget.csv',mimeType:'text/csv',buffer:Buffer.from(['x,y,target',...rows].join('\n'))});
  await page.locator('summary:visible').filter({hasText:'Advanced Pipeline Studio (F11)'}).first().click();await page.getByLabel('F12 learning task',{exact:true}).selectOption('regression');await page.locator('summary:visible').filter({hasText:'F12 — Professional ML Workbench'}).first().click();
  const panel=page.getByRole('region',{name:'F12 Model Workbench',exact:true});await train(panel,'ridge');const studio=await openEvaluation(panel),measurements=[];
  for(const renderer of ['svg','canvas']){
    await chart(studio).getByLabel('F18 renderer',{exact:true}).selectOption(renderer);await expect(chart(studio).getByTestId('f18-render-benchmark')).toContainText(renderer.toUpperCase()+' ready');
    const text=await chart(studio).getByTestId('f18-render-benchmark').innerText(),initMs=Number(text.match(/ready in ([\d.]+) ms/)[1]);expect(initMs).toBeLessThan(15000);measurements.push({renderer,sourceRows:2000,initMs});
  }
  await chart(studio).locator('.prism-f18-canvas').screenshot({path:testInfo.outputPath('f19-regression.png')});
  await testInfo.attach('f19-render-benchmark',{body:JSON.stringify(measurements),contentType:'application/json'});
  await panel.locator('summary:visible').filter({hasText:'F19 — Model Evaluation Studio'}).first().click();await expect(chart(panel)).toHaveCount(0);
  await expect(panel.getByRole('region',{name:'F12 final test results',exact:true})).toHaveCount(0);
});
