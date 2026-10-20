import { test,expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function openF12(page) {
  const f11=page.locator('summary:visible').filter({hasText:'Advanced Pipeline Studio (F11)'}).first();
  await expect(f11).toBeVisible();
  await f11.click();
  const f12=page.locator('summary:visible').filter({hasText:'F12 — Professional ML Workbench'}).first();
  await expect(f12).toBeVisible();await f12.click();
  const region=page.getByRole('region',{name:'F12 Model Workbench'});
  await expect(region).toBeVisible();
  return region;
}
async function openArchive(page){
  await page.goto('/app/experiments');
  const region=page.getByRole('region',{name:'F14 research run archive'});
  await expect(region).toBeVisible();
  await expect(region.getByRole('status').first()).toContainText('saved F14 research run', {timeout:15000});
  return region;
}
test('F14: persist regression model, attach real F13 evidence, record final test, reopen and replay after refresh',async({page})=>{
  await page.goto('/app/datasets');
  const rows=Array.from({length:60},(_,i)=>[i%17,Math.floor(i/5),7+3*(i%17)-2*Math.floor(i/5)].join(','));
  await page.getByLabel('CSV file').setInputFiles({name:'f14-regression.csv',mimeType:'text/csv',
    buffer:Buffer.from(['age,spend,target',...rows].join('\n'))});
  const f11=page.locator('summary:visible').filter({hasText:'Advanced Pipeline Studio (F11)'}).first();
  await f11.click();
  await page.getByRole('region',{name:'F11 Pipeline Studio'})
    .getByRole('combobox',{name:'F12 learning task'}).selectOption('regression');
  const f12=page.locator('summary:visible').filter({hasText:'F12 — Professional ML Workbench'}).first();
  await f12.click();
  const model=page.getByRole('region',{name:'F12 Model Workbench'});
  await model.getByRole('combobox',{name:'F12 algorithm'}).selectOption('ridge');
  await model.getByRole('button',{name:'Train and evaluate validation'}).click();
  await expect(model.getByRole('region',{name:'F12 validation results'})).toBeVisible();
  const save=model.getByRole('region',{name:'F14 save research run'});
  await save.getByRole('textbox',{name:'F14 experiment title'}).fill('F14 ridge persistence fixture');
  await save.getByRole('checkbox',{name:'F14 opt-in fitted artifact'}).check();
  await save.getByRole('button',{name:'Save F14 research run'}).click();
  await expect(save).toContainText('Local F14 receipt saved');
  const f13=page.locator('summary:visible').filter({hasText:'F13 — Explainability & Diagnostics Studio'}).first();
  await f13.click();
  const diagnostics=page.getByRole('region',{name:'F13 Explainability Studio'});
  await diagnostics.getByRole('button',{name:'Attach F13 evidence to saved F14 run'}).click();
  await expect(diagnostics.getByRole('status').last()).toContainText('attached to the saved F14 run');
  await model.getByRole('button',{name:'Evaluate selected model on held-out test once'}).click();
  await expect(model.getByRole('region',{name:'F12 final test results'})).toBeVisible();
  await expect(model).toContainText('audit receipt updated');

  const archive=await openArchive(page);
  await expect(archive.getByRole('region',{name:'F14 saved run list'})).toContainText('F14 ridge persistence fixture');
  const detail=archive.getByRole('region',{name:'F14 run detail'});
  await expect(detail).toContainText('Final test: Access recorded at');
  await expect(detail).toContainText('F13 attached explanations: 1.');
  await detail.getByRole('button',{name:'Verify saved model artifact'}).click();
  await expect(detail).toContainText('Artifact checksum verified');
  await detail.getByRole('textbox',{name:'F14 replay prepared vector'}).fill('3, 2');
  await detail.getByRole('button',{name:'Replay saved model prediction'}).click();
  await expect(detail).toContainText('Replayed prediction:');

  await detail.getByRole('button',{name:'Edit title, tags and notes'}).click();
  await detail.getByRole('textbox',{name:'F14 edit title'}).fill('F14 renamed ridge study');
  await detail.getByRole('textbox',{name:'F14 edit tags'}).fill('regression, reproducible');
  await detail.getByRole('textbox',{name:'F14 edit notes'}).fill('Measured validation before final test.');
  await detail.getByRole('button',{name:'Save run metadata'}).click();
  await expect(archive).toContainText('F14 renamed ridge study');
  await page.reload();
  const restored=page.getByRole('region',{name:'F14 research run archive'});
  await expect(restored.getByRole('region',{name:'F14 saved run list'})).toContainText('F14 renamed ridge study');
  await expect(restored.getByRole('region',{name:'F14 run detail'})).toContainText('Final test: Access recorded at');
  const download=page.waitForEvent('download');
  await restored.getByRole('button',{name:'Export F14 Markdown research report'}).click();
  const report=await download;
  expect(report.suggestedFilename()).toBe('neuroforge-f14-research-report.md');
  const markdown=await readFile(await report.path(),'utf8');
  expect(markdown).toContain('F14 renamed ridge study');
  expect(markdown).toContain('Attached explanation evidence');
  expect(markdown).toContain('Access recorded');
  expect(markdown).not.toContain('regression-observation-');
});

test('F14: comparable binary runs rank only validation measures; revision-aware delete',async({page})=>{
  await page.goto('/app/datasets');
  await page.getByRole('button',{name:'Try sample dataset'}).click();
  const model=await openF12(page);
  await model.getByRole('button',{name:'Train and evaluate validation'}).click();
  const save=model.getByRole('region',{name:'F14 save research run'});
  await save.getByRole('textbox',{name:'F14 experiment title'}).fill('F14 baseline reference');
  await save.getByRole('button',{name:'Save F14 research run'}).click();
  await expect(save).toContainText('Local F14 receipt saved');
  await model.getByRole('combobox',{name:'F12 algorithm'}).selectOption('logistic');
  await model.getByRole('button',{name:'Train and evaluate validation'}).click();
  await save.getByRole('textbox',{name:'F14 experiment title'}).fill('F14 logistic contender');
  await save.getByRole('button',{name:'Save F14 research run'}).click();
  await expect(save).toContainText('Local F14 receipt saved');

  const archive=await openArchive(page);
  await expect(archive.getByRole('region',{name:'F14 saved run list'})).toContainText('F14 baseline reference');
  await expect(archive.getByRole('region',{name:'F14 saved run list'})).toContainText('F14 logistic contender');
  await archive.getByRole('checkbox',{name:'F14 compare F14 baseline reference'}).check();
  await archive.getByRole('checkbox',{name:'F14 compare F14 logistic contender'}).check();
  const compare=archive.getByRole('region',{name:'F14 comparison',exact:true});
  await expect(compare).toContainText('Comparison: comparable');
  await expect(compare.getByRole('region',{name:'F14 comparison scores'}).getByRole('row')).toHaveCount(3);
  await archive.getByRole('textbox',{name:'F14 search runs'}).fill('logistic');
  await expect(archive.getByRole('region',{name:'F14 saved run list'})).not.toContainText('F14 baseline reference');
  await archive.getByRole('textbox',{name:'F14 search runs'}).clear();
  const detail=archive.getByRole('region',{name:'F14 run detail'});
  await detail.getByRole('button',{name:'Delete saved F14 run'}).click();
  await detail.getByRole('button',{name:'Confirm delete saved F14 run'}).click();
  await expect(archive.getByRole('status').first()).toContainText('1 saved F14 research run');
});

test('F14: kNN archive is receipt-only with no training vector persistence',async({page})=>{
  await page.goto('/app/datasets');
  await page.getByRole('button',{name:'Try sample dataset'}).click();
  const model=await openF12(page);
  await model.getByRole('combobox',{name:'F12 algorithm'}).selectOption('knn');
  await model.getByRole('button',{name:'Train and evaluate validation'}).click();
  const save=model.getByRole('region',{name:'F14 save research run'});
  await expect(save.getByRole('checkbox',{name:'F14 opt-in fitted artifact'})).toBeDisabled();
  await save.getByRole('textbox',{name:'F14 experiment title'}).fill('F14 kNN privacy study');
  await save.getByRole('button',{name:'Save F14 research run'}).click();
  await expect(save).toContainText('receipt only');
  const archive=await openArchive(page);
  const detail=archive.getByRole('region',{name:'F14 run detail'});
  await detail.getByRole('button',{name:'Verify saved model artifact'}).click();
  await expect(detail).toContainText('No fitted model was saved');
  await expect(detail.getByRole('textbox',{name:'F14 replay prepared vector'})).toHaveCount(0);
});
