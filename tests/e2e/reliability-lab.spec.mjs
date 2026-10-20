import { test, expect } from '@playwright/test';

test('F9: fitted Playground reliability lab shows observed calibration and subgroup tables',async({page})=>{
  await page.goto('/app/playground');
  await page.getByRole('button',{name:'Recalculate Model Boundary',exact:true}).click();
  const lab=page.getByRole('region',{name:'Reliability and shift lab'});
  await expect(lab).toBeVisible();
  await expect(lab.getByText('Brier score',{exact:true})).toBeVisible();
  const table=lab.getByRole('region',{name:'Validation calibration table'});
  await expect(table).toBeVisible();
  await expect(table.getByRole('row')).toHaveCount(6);
  await lab.getByRole('combobox',{name:'Reliability grouping feature'}).selectOption('y');
  await expect(lab.getByRole('region',{name:'Subgroup error table'}).getByRole('row')).toHaveCount(3);
});

test('F9: hypothetical distribution shift reruns predictions without modifying source data',async({page})=>{
  await page.goto('/app/playground');
  await page.getByRole('button',{name:'Recalculate Model Boundary',exact:true}).click();
  const lab=page.getByRole('region',{name:'Reliability and shift lab'});
  await lab.getByRole('spinbutton',{name:'Shift feature X'}).fill('1');
  const shift=lab.getByRole('region',{name:'Synthetic shift results'});
  await expect(shift).toContainText('Observed prediction flips');
  await expect(shift).toContainText('Mean probability change');
  await expect(lab.getByRole('status')).toContainText('No saved dataset or model weights were changed.');
  await expect(page.getByRole('button',{name:'Save Run',exact:true})).toBeEnabled();
});
