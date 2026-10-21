import { test, expect } from '@playwright/test';

async function openF12(page){
  const f11=page.locator('summary:visible').filter({hasText:'Advanced Pipeline Studio (F11)'}).first();
  await expect(f11).toBeVisible();await f11.click();
  const f12=page.locator('summary:visible').filter({hasText:'F12 — Professional ML Workbench'}).first();
  await expect(f12).toBeVisible();await f12.click();
  return page.getByRole('region',{name:'F12 Model Workbench'});
}
async function openF15(page){
  const trigger=page.locator('summary:visible').filter({hasText:'F15 — Advanced Model Selection'}).first();
  await expect(trigger).toBeVisible();await trigger.click();
  const panel=page.getByRole('region',{name:'F15 Model Selection Studio'});
  await expect(panel).toBeVisible();
  return panel;
}
test('F15: cross-validate CART on original training only, promote, explain and archive research receipt',async({page})=>{
  await page.goto('/app/datasets');
  await page.getByRole('button',{name:'Try sample dataset'}).click();
  const model=await openF12(page);
  const selection=await openF15(page);
  await selection.getByRole('combobox',{name:'F15 search algorithm'}).selectOption('cart');
  await selection.getByRole('button',{name:'Run F15 cross-validation search'}).click();
  const evidence=selection.getByRole('region',{name:'F15 cross-validation results'});
  await expect(evidence).toBeVisible({timeout:30000});
  await expect(evidence.getByRole('region',{name:'F15 fold score table'}).getByRole('row')).toHaveCount(4);
  await expect(evidence).toContainText('original training observations');
  await expect(model.getByRole('region',{name:'F12 final test results'})).toHaveCount(0);
  await selection.getByRole('button',{name:'Train selected configuration on original training split'}).click();
  await expect(model.getByRole('region',{name:'F12 validation results'})).toBeVisible();
  const saved=model.getByRole('region',{name:'F14 save research run'});
  await saved.getByRole('textbox',{name:'F14 experiment title'}).fill('F15 CART CV experiment');
  await expect(saved.getByRole('checkbox',{name:'F14 opt-in fitted artifact'})).toBeDisabled();
  await saved.getByRole('button',{name:'Save F14 research run'}).click();
  await expect(saved).toContainText('Local F14 receipt saved');
  const f13=page.locator('summary:visible').filter({hasText:'F13 — Explainability & Diagnostics Studio'}).first();
  await f13.click();
  const explanation=page.getByRole('region',{name:'F13 Explainability Studio'});
  await explanation.getByRole('group',{name:'F13 diagnostic views'})
    .getByRole('button',{name:'Local explanation'}).click();
  await expect(explanation).toContainText('Exact decision path');
  await page.goto('/app/experiments');
  const archive=page.getByRole('region',{name:'F14 research run archive'});
  await expect(archive.getByRole('region',{name:'F14 saved run list'})).toContainText('F15 CART CV experiment');
  await expect(archive.getByRole('region',{name:'F14 run detail'})).toContainText('F15 model selection');
  await expect(archive.getByRole('region',{name:'F14 run detail'})).toContainText('inner folds');
});

test('F15: multiclass softmax search runs in browser worker and produces class-specific logits',async({page})=>{
  await page.goto('/app/datasets');
  const lines=Array.from({length:90},(_,i)=>{
    const group=i%3,offset=(i%7)/20;
    return [(group===1?5:group===2?0:-5)+offset,(group===2?5:0)+offset,
      ['alpha','beta','gamma'][group]].join(',');
  });
  await page.getByLabel('CSV file').setInputFiles({name:'f15-softmax.csv',mimeType:'text/csv',
    buffer:Buffer.from(['x,y,target',...lines].join('\n'))});
  const model=await openF12(page);
  const selection=await openF15(page);
  await selection.getByRole('combobox',{name:'F15 search algorithm'}).selectOption('softmax');
  await selection.getByRole('button',{name:'Run F15 cross-validation search'}).click();
  await expect(selection.getByRole('region',{name:'F15 cross-validation results'})).toBeVisible({timeout:30000});
  await selection.getByRole('button',{name:'Train selected configuration on original training split'}).click();
  await expect(model.getByRole('region',{name:'F12 validation confusion matrix'})).toBeVisible();
  const f13=page.locator('summary:visible').filter({hasText:'F13 — Explainability & Diagnostics Studio'}).first();
  await f13.click();
  const panel=page.getByRole('region',{name:'F13 Explainability Studio'});
  await panel.getByRole('group',{name:'F13 diagnostic views'}).getByRole('button',{name:'Local explanation'}).click();
  await expect(panel).toContainText('one class logit');
});

test('F15: regression CART CV uses RMSE and does not unlock original held-out test',async({page})=>{
  await page.goto('/app/datasets');
  const lines=Array.from({length:75},(_,i)=>{
    const x=i%17-8,y=Math.floor(i/5)-6;
    return[x,y,3+2*x-4*y].join(',');
  });
  await page.getByLabel('CSV file').setInputFiles({name:'f15-regression.csv',mimeType:'text/csv',
    buffer:Buffer.from(['x,y,target',...lines].join('\n'))});
  const f11=page.locator('summary:visible').filter({hasText:'Advanced Pipeline Studio (F11)'}).first();
  await f11.click();
  await page.getByRole('region',{name:'F11 Pipeline Studio'})
    .getByRole('combobox',{name:'F12 learning task'}).selectOption('regression');
  const f12=page.locator('summary:visible').filter({hasText:'F12 — Professional ML Workbench'}).first();
  await f12.click();
  const model=page.getByRole('region',{name:'F12 Model Workbench'});
  const selection=await openF15(page);
  await selection.getByRole('combobox',{name:'F15 search algorithm'}).selectOption('cart');
  await expect(selection.getByRole('combobox',{name:'F15 selection metric'})).toHaveValue('rmse');
  await selection.getByRole('button',{name:'Run F15 cross-validation search'}).click();
  const results=selection.getByRole('region',{name:'F15 cross-validation results'});
  await expect(results).toBeVisible({timeout:30000});
  await expect(results).toContainText('rmse');
  await selection.getByRole('button',{name:'Train selected configuration on original training split'}).click();
  await expect(model.getByRole('region',{name:'F12 validation results'})).toContainText('RMSE');
  await expect(model.getByRole('region',{name:'F12 final test results'})).toHaveCount(0);
  await expect(model.getByRole('button',{name:'Evaluate selected model on held-out test once'})).toBeVisible();
});
