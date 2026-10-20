import { test, expect } from '@playwright/test';

test('F2: example dataset is profiled, charted and reusable in Playground', async ({ page }) => {
  await page.goto('/app/datasets');
  await page.getByRole('button', { name: 'Try sample dataset' }).click();
  const dashboard=page.getByRole('region',{name:'Dataset profile dashboard'});
  await expect(dashboard).toBeVisible();
  await expect(dashboard.getByText('Two Moons sample (seed 42)')).toBeVisible();
  await expect(dashboard.getByText('120', {exact:true}).first()).toBeVisible();
  await dashboard.getByRole('button',{name:'Distributions'}).click();
  await dashboard.getByRole('combobox',{name:'Distribution column'}).selectOption('feature_y');
  await expect(dashboard.getByRole('region',{name:'Distribution values'})).toBeVisible();
  await dashboard.getByRole('button',{name:'Correlations'}).click();
  await expect(dashboard.getByRole('region',{name:'Correlation matrix'})).toBeVisible();
  await dashboard.getByRole('button',{name:'Row preview'}).click();
  await expect(dashboard.getByRole('region',{name:'Uploaded row preview'}).getByRole('row')).toHaveCount(13);
  await page.getByRole('button',{name:'Prepare for Playground'}).click();
  await expect(page).toHaveURL(/\/app\/playground$/);
  await expect(page.getByRole('button',{name:'Recalculate Model Boundary',exact:true})).toBeVisible();
});

test('F2: a mixed and incomplete CSV is locally profiled without needing two numeric columns', async ({ page }) => {
  await page.goto('/app/datasets');
  const csv='age,segment,comment\n10,A,ok\n20,B,ok\n30,A,\n40,B,note\n40,B,note\n';
  await page.getByLabel('CSV file').setInputFiles({name:'mixed.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  const dashboard=page.getByRole('region',{name:'Dataset profile dashboard'});
  await expect(dashboard).toBeVisible();
  await expect(dashboard.getByText('mixed.csv')).toBeVisible();
  await expect(dashboard.getByRole('table',{name:'Column summary and missingness'})).toContainText('comment');
  await expect(dashboard.getByRole('table',{name:'Column summary and missingness'})).toContainText('20.0%');
  await dashboard.getByRole('button',{name:'Distributions'}).click();
  await dashboard.getByRole('combobox',{name:'Distribution column'}).selectOption('segment');
  await expect(dashboard.getByRole('table',{name:'Distribution of segment'})).toContainText('A');
  await dashboard.getByRole('button',{name:'Correlations'}).click();
  await expect(dashboard.getByText('At least two numeric columns are required for a correlation matrix.')).toBeVisible();
  await page.getByRole('button',{name:'Prepare for Playground'}).click();
  await expect(page.getByRole('alert')).toContainText('require two numeric input columns');
  await expect(page).toHaveURL(/\/app\/datasets$/);
});
