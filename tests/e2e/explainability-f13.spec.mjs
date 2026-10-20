import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function openF12(page) {
  const f11=page.locator('summary:visible').filter({hasText:'Advanced Pipeline Studio (F11)'}).first();
  await expect(f11).toBeVisible();
  await f11.click();
  const f12=page.locator('summary:visible').filter({hasText:'F12 — Professional ML Workbench'}).first();
  await expect(f12).toBeVisible();
  await f12.click();
  return page.getByRole('region',{name:'F12 Model Workbench'});
}
async function openF13(page) {
  const trigger=page.locator('summary:visible').filter({hasText:'F13 — Explainability & Diagnostics Studio'}).first();
  await expect(trigger).toBeVisible();
  await trigger.click();
  const panel=page.getByRole('region',{name:'F13 Explainability Studio'});
  await expect(panel).toBeVisible();
  return panel;
}
async function view(panel,name) {
  await panel.getByRole('group',{name:'F13 diagnostic views'}).getByRole('button',{name,exact:true}).click();
}

test('F13: actual fitted logistic explanations, validation permutation worker, raw what-if, and privacy-safe export',async({page})=>{
  await page.goto('/app/datasets');
  await page.getByRole('button',{name:'Try sample dataset'}).click();
  const workbench=await openF12(page);
  await workbench.getByRole('combobox',{name:'F12 algorithm'}).selectOption('logistic');
  await workbench.getByRole('button',{name:'Train and evaluate validation'}).click();
  await expect(workbench.getByRole('region',{name:'F12 validation results'})).toBeVisible();

  const panel=await openF13(page);
  await expect(panel).toContainText('Validation:');
  await panel.getByRole('button',{name:'Measure feature importance'}).click();
  await expect(panel.getByRole('region',{name:'F13 importance evidence table'})).toBeVisible({timeout:30000});
  await expect(panel.getByRole('region',{name:'F13 importance evidence table'}).getByRole('row')).toHaveCount(3);
  await expect(workbench.getByRole('region',{name:'F12 final test results'})).toHaveCount(0);

  await view(panel,'Local explanation');
  await expect(panel.getByRole('region',{name:'F13 local contribution evidence'})).toBeVisible();
  await expect(panel).toContainText('log-odds');

  await view(panel,'PDP / ICE');
  await panel.getByRole('button',{name:'Calculate partial dependence'}).click();
  await expect(panel.getByRole('region',{name:'F13 partial dependence evidence'})).toBeVisible();

  await view(panel,'What-if');
  const input=panel.getByRole('spinbutton',{name:'F13 hypothetical numeric value'});
  await expect(input).toBeVisible();
  const min=Number(await input.getAttribute('min'));
  const max=Number(await input.getAttribute('max'));
  await input.fill(String(min+(max-min)/2));
  await panel.getByRole('button',{name:'Evaluate hypothetical prediction'}).click();
  await expect(panel).toContainText('Hypothetical prediction');

  await view(panel,'Subgroups');
  await panel.getByRole('button',{name:'Analyze validation subgroups'}).click();
  await expect(panel.getByRole('region',{name:'F13 subgroup evidence'})).toBeVisible();

  const waiting=page.waitForEvent('download');
  await panel.getByRole('button',{name:'Export explanation evidence JSON'}).click();
  const file=await waiting;
  expect(file.suggestedFilename()).toBe('neuroforge-f13-explanation.json');
  const result=JSON.parse(await readFile(await file.path(),'utf8'));
  expect(result.kind).toBe('neuroforge-f13-explanation-evidence');
  expect(result.scope.name).toBe('validation');
  expect(result.permutation.featureScores.length).toBe(2);
  expect(result.local.method).toBe('exact-log-odds');
  expect(result.dependence.points.length).toBeGreaterThan(0);
  expect(result.whatIf.method).toBe('frozen-source-pipeline-replay');
  expect(result.subgroups.groups).toHaveLength(2);
  expect(result.pipeline.digest).toMatch(/^[0-9a-f]{64}$/);
  expect(JSON.stringify(result)).not.toContain('"rows":');
  expect(JSON.stringify(result)).not.toContain('"parameters":');
  expect(JSON.stringify(result)).not.toContain('"rowId":');
});

test('F13: continuous regression exposes exact ridge contributions and partial dependence',async({page})=>{
  await page.goto('/app/datasets');
  const rows=Array.from({length:72},(_,i)=>{
    const x=i%17-8,z=Math.floor(i/7)-5;
    return [x,z,5+2*x-3*z].join(',');
  });
  await page.getByLabel('CSV file').setInputFiles({name:'f13-regression.csv',
    mimeType:'text/csv',buffer:Buffer.from(['x,z,target',...rows].join('\n'))});
  const f11=page.locator('summary:visible').filter({hasText:'Advanced Pipeline Studio (F11)'}).first();
  await f11.click();
  await page.getByRole('region',{name:'F11 Pipeline Studio'}).getByRole('combobox',{name:'F12 learning task'}).selectOption('regression');
  const f12=page.locator('summary:visible').filter({hasText:'F12 — Professional ML Workbench'}).first();
  await f12.click();
  const workbench=page.getByRole('region',{name:'F12 Model Workbench'});
  await workbench.getByRole('combobox',{name:'F12 algorithm'}).selectOption('ridge');
  await workbench.getByRole('button',{name:'Train and evaluate validation'}).click();
  const panel=await openF13(page);
  await view(panel,'Local explanation');
  await expect(panel.getByRole('region',{name:'F13 local contribution evidence'})).toBeVisible();
  await expect(panel).toContainText('reconstruct the regression prediction');
  await view(panel,'PDP / ICE');
  await panel.getByRole('button',{name:'Calculate partial dependence'}).click();
  await expect(panel.getByRole('region',{name:'F13 partial dependence evidence'})).toBeVisible();
});

test('F13: multiclass kNN neighbor evidence never exposes training observation identities',async({page})=>{
  await page.goto('/app/datasets');
  const rows=Array.from({length:72},(_,i)=>{
    const c=i%3;return [(c===1?8:0)+(i%5)/10,(c===2?8:0)+(i%7)/10,['A','B','C'][c]].join(',');
  });
  await page.getByLabel('CSV file').setInputFiles({name:'f13-multiclass.csv',mimeType:'text/csv',
    buffer:Buffer.from(['x,y,label',...rows].join('\n'))});
  const workbench=await openF12(page);
  await workbench.getByRole('combobox',{name:'F12 algorithm'}).selectOption('knn');
  await workbench.getByRole('button',{name:'Train and evaluate validation'}).click();
  const panel=await openF13(page);
  await view(panel,'Local explanation');
  await expect(panel.getByRole('region',{name:'F13 kNN class vote evidence'})).toBeVisible();
  await expect(panel).toContainText('Neighbor distances');
  await expect(panel).toContainText('not displayed');
  await view(panel,'PDP / ICE');
  await panel.getByRole('combobox',{name:'F13 dependence class'}).selectOption('1');
  await panel.getByRole('button',{name:'Calculate partial dependence'}).click();
  await expect(panel.getByRole('region',{name:'F13 partial dependence evidence'})).toBeVisible();
});
