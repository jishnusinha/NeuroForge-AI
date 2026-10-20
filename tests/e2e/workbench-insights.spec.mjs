import { test, expect } from '@playwright/test';

test('F2: sample dataset supports relationship plot, class counts and keyboard evidence', async ({page}) => {
  await page.goto('/app/datasets');
  await page.getByRole('button',{name:'Try sample dataset'}).click();
  const dashboard=page.getByRole('region',{name:'Dataset profile dashboard'});
  await dashboard.getByRole('button',{name:'Relationships'}).click();
  await expect(dashboard.getByRole('combobox',{name:'X feature'})).toHaveValue('feature_x');
  await expect(dashboard.getByRole('combobox',{name:'Y feature'})).toHaveValue('feature_y');
  await expect(dashboard.getByRole('img',{name:/Observed scatter plot of feature_x versus feature_y/})).toBeVisible();
  await expect(dashboard.getByRole('region',{name:'Scatter point evidence'}).getByRole('row')).toHaveCount(31);
  await dashboard.getByRole('button',{name:'Class balance'}).click();
  const balanced=dashboard.getByRole('region',{name:'Class distribution'});
  await expect(balanced).toBeVisible();
  await expect(balanced.getByRole('row')).toHaveCount(3);
  await dashboard.getByRole('button',{name:'Outliers & quality'}).click();
  await expect(dashboard.getByRole('combobox',{name:'Outlier feature'})).toBeVisible();
  await expect(dashboard.getByRole('region',{name:'Flagged outlier observations'})).toBeVisible();
});

test('F2: imported CSV shows real 3:1 class ratio, scatter groups, and flags the extreme original row', async ({page}) => {
  await page.goto('/app/datasets');
  const csv='feature_x,feature_y,label,segment\n1,2,0,A\n2,4,0,A\n3,6,0,A\n4,8,0,A\n5,10,0,A\n6,12,0,A\n7,14,1,B\n80,160,1,B\n';
  await page.getByLabel('CSV file').setInputFiles({name:'imbalanced.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  const dash=page.getByRole('region',{name:'Dataset profile dashboard'});
  await expect(dash.getByText('imbalanced.csv')).toBeVisible();
  await dash.getByRole('button',{name:'Relationships'}).click();
  await dash.getByRole('combobox',{name:'Color by category'}).selectOption('segment');
  await expect(dash.getByRole('img',{name:/Observed scatter plot of feature_x versus feature_y/})).toBeVisible();
  await expect(dash.getByLabel('Scatter color legend')).toContainText('B');
  await dash.getByRole('button',{name:'Class balance'}).click();
  await dash.getByRole('combobox',{name:'Class or category column'}).selectOption('segment');
  await expect(dash.getByText('3:1',{exact:true})).toBeVisible();
  await expect(dash.getByText(/Class imbalance flagged for review/)).toBeVisible();
  await dash.getByRole('button',{name:'Outliers & quality'}).click();
  await expect(dash.getByText('1 flagged',{exact:true})).toBeVisible();
  const flagged=dash.getByRole('region',{name:'Flagged outlier observations'});
  await expect(flagged.getByRole('row')).toHaveCount(2);
  await expect(flagged.getByRole('row').last()).toContainText('80');
  await dash.getByRole('button',{name:'Row preview'}).click();
  await expect(dash.getByRole('region',{name:'Uploaded row preview'})).toContainText('80');
});

test('F2: constant target remains selectable and clearly warns about single-class data', async ({page}) => {
  await page.goto('/app/datasets');
  const csv='feature_x,feature_y,label\n1,2,0\n2,4,0\n3,6,0\n4,8,0\n';
  await page.getByLabel('CSV file').setInputFiles({name:'one-class.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  const dashboard=page.getByRole('region',{name:'Dataset profile dashboard'});
  await dashboard.getByRole('button',{name:'Class balance'}).click();
  await expect(dashboard.getByRole('combobox',{name:'Class or category column'})).toHaveValue('label');
  await expect(dashboard.getByText('Only one class is observed. Binary classification needs more than one class.')).toBeVisible();
});
