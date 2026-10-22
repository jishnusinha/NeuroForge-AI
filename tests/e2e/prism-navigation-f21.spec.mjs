import {test,expect} from '@playwright/test';
test('F21 research and model journeys preserve routes and expose breadcrumbs',async({page})=>{
 await page.goto('/app');await page.getByRole('link',{name:'Open model workflow',exact:true}).click();await expect(page).toHaveURL(/datasets\?stage=modeling/);await expect(page.getByRole('navigation',{name:'Breadcrumb'})).toContainText('Data');
 await page.locator('#main-content').focus();await page.keyboard.press('Control+k');await page.getByRole('combobox',{name:'Search commands'}).fill('Research Intelligence');await page.getByRole('option',{name:/Research Intelligence/}).click();await expect(page).toHaveURL(/experiments\?view=research/);await expect(page.getByRole('region',{name:'F20 Research Intelligence'})).toBeVisible();
});
test('F21 global shortcuts leave text entry alone and query changes retain dataset context',async({page})=>{
 await page.goto('/app/datasets');await page.getByRole('button',{name:'Try sample dataset',exact:true}).click();
 const input=page.getByRole('textbox').first();await input.fill('focus fixture');await input.focus();await page.keyboard.press('Control+k');await page.keyboard.press('Alt+n');await expect(page.getByRole('dialog',{name:'Quick commands'})).toHaveCount(0);await expect(page).toHaveURL(/datasets$/);await expect(input).toHaveValue('focus fixture');
 await page.locator('#main-content').focus();await page.keyboard.press('Control+k');await page.getByRole('combobox',{name:'Search commands'}).fill('Model Workbench');await page.getByRole('option',{name:/Model Workbench/}).click();await expect(page).toHaveURL(/datasets\?stage=modeling/);await expect(page.getByRole('navigation',{name:'Dataset investigation stages'})).toContainText('120 source rows');
});


