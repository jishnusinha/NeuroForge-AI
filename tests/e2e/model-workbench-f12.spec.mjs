import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function openF12(page) {
  const f11=page.locator('summary:visible').filter({hasText:'Advanced Pipeline Studio (F11)'}).first();
  await expect(f11).toBeVisible();
  await f11.click();
  const f12=page.locator('summary:visible').filter({hasText:'F12 — Professional ML Workbench'}).first();
  await expect(f12).toBeVisible();
  await f12.click();
  const panel=page.getByRole('region',{name:'F12 Model Workbench'});
  await expect(panel).toBeVisible();
  return panel;
}

test('F12: train baseline and binary logistic, compare validation and protect final test',async({page})=>{
  await page.goto('/app/datasets');
  await page.getByRole('button',{name:'Try sample dataset'}).click();
  const panel=await openF12(page);
  await expect(panel).toContainText('binary classification');
  await panel.getByRole('button',{name:'Train and evaluate validation'}).click();
  await expect(panel.getByRole('region',{name:'F12 validation results'})).toBeVisible();
  await expect(panel.getByRole('region',{name:'F12 final test results'})).toHaveCount(0);
  await panel.getByRole('combobox',{name:'F12 algorithm'}).selectOption('logistic');
  await panel.getByRole('button',{name:'Train and evaluate validation'}).click();
  await expect(panel.getByRole('region',{name:'F12 model candidates'}).getByRole('button')).toHaveCount(2);
  await expect(panel.getByRole('region',{name:'F12 validation confusion matrix'})).toBeVisible();
  await panel.getByRole('button',{name:'Evaluate selected model on held-out test once'}).click();
  await expect(panel.getByRole('region',{name:'F12 final test results'})).toBeVisible();
  await expect(panel.getByRole('button',{name:'Train and evaluate validation'})).toBeDisabled();
  const download=page.waitForEvent('download');
  await panel.getByRole('button',{name:'Export F12 evidence JSON'}).click();
  const file=await download;
  expect(file.suggestedFilename()).toBe('neuroforge-f12-evidence.json');
  const report=JSON.parse(await readFile(await file.path(),'utf8'));
  expect(report.kind).toBe('neuroforge-f12-model-evidence');
  expect(report.candidates).toHaveLength(2);
  expect(report.finalTest.count).toBeGreaterThan(0);
  expect(report.pipelineDigest).toMatch(/^[a-f0-9]{64}$/);
  expect(report).not.toHaveProperty('rows');
});

test('F12: a continuous regression target and three prepared features train a ridge model',async({page})=>{
  await page.goto('/app/datasets');
  const rows=Array.from({length:48},(_,i)=>[i+1,(i%7)*2,Math.floor(i/5),10+2*(i+1)-3*((i%7)*2)+Math.floor(i/5)].join(','));
  await page.getByLabel('CSV file').setInputFiles({
    name:'f12-regression.csv',mimeType:'text/csv',
    buffer:Buffer.from(['x,y,z,target',...rows].join('\n')),
  });
  const trigger=page.locator('summary:visible').filter({hasText:'Advanced Pipeline Studio (F11)'}).first();
  await trigger.click();
  const f11=page.getByRole('region',{name:'F11 Pipeline Studio'});
  await f11.getByRole('combobox',{name:'F12 learning task'}).selectOption('regression');
  await f11.getByRole('group',{name:'Input features'}).getByRole('checkbox',{name:/^z/}).check();
  const f12=page.locator('summary:visible').filter({hasText:'F12 — Professional ML Workbench'}).first();
  await f12.click();
  const panel=page.getByRole('region',{name:'F12 Model Workbench'});
  await expect(panel).toContainText('3');
  await expect(panel).toContainText('regression');
  await panel.getByRole('combobox',{name:'F12 algorithm'}).selectOption('ridge');
  await panel.getByRole('button',{name:'Train and evaluate validation'}).click();
  await expect(panel.getByRole('region',{name:'F12 validation results'})).toContainText('RMSE');
  await expect(panel.getByRole('region',{name:'F12 validation prediction evidence'})).toBeVisible();
});

test('F12: multiclass kNN uses full prepared matrix and correct three-class confusion rows',async({page})=>{
  await page.goto('/app/datasets');
  const rows=Array.from({length:60},(_,i)=>{
    const group=i%3;return [(group===1?6:0)+(i%4)/10,(group===2?6:0)+(i%6)/10,['alpha','beta','gamma'][group]].join(',');
  });
  await page.getByLabel('CSV file').setInputFiles({
    name:'f12-multiclass.csv',mimeType:'text/csv',
    buffer:Buffer.from(['x,y,label',...rows].join('\n')),
  });
  const panel=await openF12(page);
  await expect(panel).toContainText('multiclass classification');
  await panel.getByRole('combobox',{name:'F12 algorithm'}).selectOption('knn');
  await panel.getByRole('button',{name:'Train and evaluate validation'}).click();
  const matrix=panel.getByRole('region',{name:'F12 validation confusion matrix'});
  await expect(matrix).toBeVisible();
  await expect(matrix.getByRole('row')).toHaveCount(4);
  await expect(panel.getByRole('region',{name:'F12 validation results'})).toContainText('Macro F1');
});
