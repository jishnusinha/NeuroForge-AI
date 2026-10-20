import {test,expect} from '@playwright/test';

test('F7: Academy tracks only correctly answered checkpoints across reloads',async({page})=>{
  await page.goto('/app/academy');
  const tracks=page.getByRole('region',{name:'Learning paths'});
  await expect(tracks).toBeVisible();
  await expect(tracks.getByText('Model foundations')).toBeVisible();
  const leakage=page.getByText('Why must preprocessing fit training data only?');
  await expect(leakage).toBeVisible();
  const card=page.locator('.rounded-2xl').filter({has:leakage}).last();
  await card.getByRole('button',{name:'Fit preprocessing using training rows only, then transform held-out rows'}).click();
  await expect(card.getByText('Correct. Checkpoint completed.')).toBeVisible();
  await expect(page.getByText(/Checkpoints completed: 1 \/ 6/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Checkpoints completed: 1 \/ 6/)).toBeVisible();
});

test('F7: Wrong hypothesis cannot grant course completion',async({page})=>{
  await page.goto('/app/academy/lesson-counterfactual');
  await page.getByRole('button',{name:'A prediction-changing edit proves that intervention will work in reality'}).click();
  await expect(page.getByText('Try again, then inspect the explanation.')).toBeVisible();
  await expect(page.getByText(/Checkpoints completed: 0 \/ 6/)).toBeVisible();
  await page.getByRole('button',{name:'A model-based counterfactual is not a causal guarantee'}).click();
  await expect(page.getByText('Correct. Checkpoint completed.')).toBeVisible();
});
