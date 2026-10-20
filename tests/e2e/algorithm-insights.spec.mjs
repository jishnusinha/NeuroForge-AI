import { test, expect } from '@playwright/test';

test('F4: real CART tree trains from the sample and displays validation-only evidence', async ({page}) => {
  await page.goto('/app/datasets');
  await page.getByRole('button',{name:'Try sample dataset'}).click();
  const dashboard=page.getByRole('region',{name:'Dataset profile dashboard'});
  await dashboard.getByRole('button',{name:'Algorithms'}).click();
  const tree=dashboard.getByRole('region',{name:'Decision tree results'});
  await expect(tree).toBeVisible();
  await expect(tree.getByText('Validation accuracy')).toBeVisible();
  await expect(tree.getByRole('region',{name:'Decision tree rules'})).toBeVisible();
  await dashboard.getByRole('slider',{name:'Tree maximum depth'}).fill('2');
  await expect(tree).toBeVisible();
  await expect(tree.getByText('Held-out test')).toBeVisible();
});

test('F4: PCA numerical projection reports explained variance and original observations',async ({page})=>{
  await page.goto('/app/datasets');
  await page.getByRole('button',{name:'Try sample dataset'}).click();
  const dashboard=page.getByRole('region',{name:'Dataset profile dashboard'});
  await dashboard.getByRole('button',{name:'Algorithms'}).click();
  await dashboard.getByRole('button',{name:'PCA projection'}).click();
  const result=dashboard.getByRole('region',{name:'PCA results'});
  await expect(result).toBeVisible();
  await expect(result.getByText('PC1 explained variance')).toBeVisible();
  await expect(result.getByRole('img',{name:/PCA projection/})).toBeVisible();
  await expect(result.getByRole('table',{name:/First .* displayed actual projections/})).toBeVisible();
});
