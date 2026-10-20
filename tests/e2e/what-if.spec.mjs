import {test,expect} from '@playwright/test';

test('F5: fitted Playground classifier supports genuine What-If probes and bounded search',async({page})=>{
  await page.goto('/app/playground');
  await page.getByRole('button',{name:'Recalculate Model Boundary',exact:true}).click();
  const lab=page.getByRole('region',{name:'Model-backed What-If Lab'});
  await expect(lab).toBeVisible();
  await expect(lab.getByText('Live predicted class / probability')).toBeVisible();
  await lab.getByRole('slider',{name:'What-If X coordinate'}).fill('0');
  await lab.getByRole('button',{name:'Find nearest class flip'}).click();
  const result=lab.getByRole('region',{name:'Counterfactual search evidence'});
  await expect(result).toBeVisible();
  await expect(result).toContainText('real bounded model probes');
  await expect(result.getByText(/Observed class flip found|No class-changing candidate found/)).toBeVisible();
});

test('F5: locking both axes clearly reports absence of searched counterfactual',async({page})=>{
  await page.goto('/app/playground');
  await page.getByRole('button',{name:'Recalculate Model Boundary',exact:true}).click();
  const lab=page.getByRole('region',{name:'Model-backed What-If Lab'});
  await lab.getByRole('checkbox',{name:'Lock X'}).check();
  await lab.getByRole('checkbox',{name:'Lock Y'}).check();
  await lab.getByRole('button',{name:'Find nearest class flip'}).click();
  await expect(lab.getByRole('region',{name:'Counterfactual search evidence'})).toContainText('Evaluated 0 real bounded model probes');
  await expect(lab.getByText('No class-changing candidate found in the allowed search grid.',{exact:false})).toBeVisible();
});
