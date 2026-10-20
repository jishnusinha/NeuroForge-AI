import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function openStudio(page) {
  // Several CSV preparation regions can be mounted during navigation; select the
  // visible editor belonging to the active imported dataset.
  const trigger=page.locator('summary:visible').filter({hasText:'Advanced Pipeline Studio (F11)'}).first();
  await expect(trigger).toBeVisible();
  await trigger.click();
  const studio=page.getByRole('region',{name:'F11 Pipeline Studio'});
  await expect(studio).toBeVisible();
  return studio;
}

test('F11: editable train-fitted pipeline has measured before/after preview and launches legacy lab',async({page})=>{
  await page.goto('/app/datasets');
  await page.getByRole('button',{name:'Try sample dataset'}).click();
  const studio=await openStudio(page);
  const preview=studio.getByRole('region',{name:'F11 fitted pipeline preview'});
  await expect(preview).toBeVisible();
  await expect(preview).toContainText('2 numeric output features');
  await expect(preview.getByRole('table')).toBeVisible();
  await studio.getByRole('button',{name:'Configure pipeline step 2'}).click();
  await studio.getByRole('combobox',{name:'Scaling strategy'}).selectOption('robust');
  await expect(preview).toContainText('robust');
  await studio.getByRole('button',{name:'Save local recipe'}).click();
  await expect(studio.getByRole('status').last()).toContainText('saved locally');
  await studio.getByRole('combobox',{name:'Scaling strategy'}).selectOption('minmax');
  await studio.getByRole('button',{name:'Restore local recipe'}).click();
  await expect(studio.getByRole('combobox',{name:'Scaling strategy'})).toHaveValue('robust');
  const downloading=page.waitForEvent('download');
  await studio.getByRole('button',{name:'Export recipe JSON'}).click();
  const file=await downloading;
  const recipe=JSON.parse(await readFile(await file.path(),'utf8'));
  expect(recipe.schemaVersion).toBe(1);
  expect(recipe.nodes).toHaveLength(2);
  await studio.getByRole('button',{name:'Launch F11 pipeline in Playground'}).click();
  await expect(page).toHaveURL(/\/app\/playground$/);
  await expect(page.getByRole('button',{name:'Recalculate Model Boundary',exact:true})).toBeVisible();
});

test('F11: categorical expansion displays correct output budget and blocks incompatible lab launch',async({page})=>{
  await page.goto('/app/datasets');
  const records=Array.from({length:30},(_,i)=>[i+1,i*2+3,i%2===0?'A':'B',i<15?0:1].join(','));
  await page.getByLabel('CSV file').setInputFiles({
    name:'f11-categories.csv',mimeType:'text/csv',
    buffer:Buffer.from(['x,y,group,label',...records].join('\n')),
  });
  const studio=await openStudio(page);
  await studio.getByRole('group',{name:'Input features'}).getByLabel('group').check();
  await expect(studio).toContainText('F11_UNENCODED_OR_MISSING');
  await studio.getByRole('combobox',{name:'New pipeline step type'}).selectOption('category.onehot');
  await studio.getByRole('button',{name:'Add step'}).click();
  await expect(studio.getByRole('region',{name:'F11 fitted pipeline preview'})).toContainText('4 numeric output features');
  await expect(studio.getByRole('button',{name:'Launch F11 pipeline in Playground'})).toBeDisabled();
  await studio.getByRole('button',{name:'Configure pipeline step 3'}).click();
  await expect(studio.getByRole('combobox',{name:'Unknown-category policy'})).toHaveValue('allZero');
  await studio.getByRole('button',{name:'Move step 3 up'}).click();
  await expect(studio.getByRole('region',{name:'F11 fitted pipeline preview'})).toBeVisible();
  await studio.getByRole('button',{name:'Remove step 2'}).click();
  await expect(studio).toContainText('F11_UNENCODED_OR_MISSING');
});

test('F11: numeric step order changes real execution and can be corrected without changing source',async({page})=>{
  await page.goto('/app/datasets');
  const records=Array.from({length:36},(_,i)=>[
    i%3===0?'':i+1,
    i%4===0?'':i*2+3,
    i<18?0:1,
  ].join(','));
  await page.getByLabel('CSV file').setInputFiles({
    name:'f11-missing.csv',mimeType:'text/csv',
    buffer:Buffer.from(['x,y,label',...records].join('\n')),
  });
  const studio=await openStudio(page);
  await expect(studio.getByRole('region',{name:'F11 fitted pipeline preview'})).toBeVisible();
  await studio.getByRole('button',{name:'Move step 2 up'}).click();
  await expect(studio.getByRole('status')).toContainText('F11_NONFINITE');
  await studio.getByRole('button',{name:'Move step 1 down'}).click();
  await expect(studio.getByRole('region',{name:'F11 fitted pipeline preview'})).toBeVisible();
  await studio.getByRole('button',{name:'Launch F11 pipeline in Studio'}).click();
  await expect(page).toHaveURL(/\/app\/studio$/);
});
