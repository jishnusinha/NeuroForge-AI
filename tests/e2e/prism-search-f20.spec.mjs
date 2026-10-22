import {test,expect} from '@playwright/test';
import {openModel} from '../support/f19-browser.mjs';
test('F20 live search charts link recorded trials to the existing explicit promotion flow',async({page})=>{
  const model=await openModel(page);await page.locator('summary:visible').filter({hasText:'F15 — Advanced Model Selection'}).first().click();const selection=page.getByRole('region',{name:'F15 Model Selection Studio',exact:true});await selection.getByRole('button',{name:'Run F15 cross-validation search',exact:true}).click();await expect(selection.getByRole('region',{name:'F15 cross-validation results'})).toBeVisible();
  await selection.locator('summary:visible').filter({hasText:'F20 — Search analytics'}).click();const analytics=selection.getByRole('region',{name:'F20 search analytics'}),chart=analytics.getByRole('region',{name:'F20 scientific chart'});await expect(chart.locator('.prism-f18-canvas svg')).toBeVisible();
  await chart.getByRole('button',{name:'Data',exact:true}).click();await chart.getByRole('button',{name:'Link plotted row 1',exact:true}).click();await expect(selection.getByLabel('F15 configuration 1', {exact:true})).toBeChecked();await expect(model.getByRole('region',{name:'F12 validation results'})).toHaveCount(0);
  await selection.getByRole('button',{name:'Train selected configuration on original training split',exact:true}).click();await expect(model.getByRole('region',{name:'F12 validation results'})).toBeVisible();await expect(model.getByRole('region',{name:'F12 final test results'})).toHaveCount(0);
});
