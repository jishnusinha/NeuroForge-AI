import {test,expect} from '@playwright/test';

test('F8: Studio optimizer simulator computes and displays real parameter trajectories',async({page})=>{
  await page.goto('/app/studio');
  const lab=page.getByRole('region',{name:'Optimizer landscape simulator'});
  await expect(lab).toBeVisible();
  await expect(lab.getByRole('img',{name:/sgd trajectory on simulated quadratic loss/})).toBeVisible();
  const table=lab.getByRole('region',{name:'Optimizer numeric history'});
  await expect(table.getByRole('row')).toHaveCount(47);
  await lab.getByRole('combobox',{name:'Simulated optimizer'}).selectOption('adam');
  await expect(lab.getByRole('img',{name:/adam trajectory on simulated quadratic loss/})).toBeVisible();
  await expect(lab.getByText('Completed',{exact:true}).first()).toBeVisible();
});

test('F8: unstable gradient descent is flagged without fabricated convergence',async({page})=>{
  await page.goto('/app/studio');
  const lab=page.getByRole('region',{name:'Optimizer landscape simulator'});
  await lab.getByRole('slider',{name:'Simulator learning rate'}).fill('1');
  await expect(lab.getByText('Diverged',{exact:true})).toBeVisible();
  await expect(lab.getByRole('status')).toContainText('last finite recorded update');
});
