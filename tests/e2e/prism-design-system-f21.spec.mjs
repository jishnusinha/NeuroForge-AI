import {test,expect} from '@playwright/test';
import {gallery} from '../support/f21-browser.mjs';
test('F21 component states preserve evidence semantics and keyboard tabs in every theme',async({page})=>{
 const panel=await gallery(page);
 for(const theme of ['midnight','slate','forest','paper']){
  await page.getByRole('combobox',{name:'Visual theme'}).selectOption(theme);
  await panel.getByRole('tab',{name:'Controls',exact:true}).click();
  await expect(panel.getByRole('button',{name:'Disabled action'})).toBeDisabled();
  await expect(panel.getByLabel('Example feature name')).toHaveAccessibleDescription('A label for this presentation fixture.');
  await panel.getByRole('tab',{name:'Controls',exact:true}).focus();await page.keyboard.press('ArrowRight');
  await expect(panel.getByRole('tab',{name:'Evidence',exact:true})).toBeFocused();
  await expect(panel.getByRole('row').filter({hasText:'Missing value'})).toContainText('Unavailable');
  await expect(panel.getByRole('row').filter({hasText:'Measured zero'}).getByRole('cell').last()).toHaveText('0');
  await page.keyboard.press('End');await expect(panel.getByRole('tab',{name:'Feedback',exact:true})).toBeFocused();await expect(panel.getByRole('status')).toHaveAccessibleName('Example loading state');
  await page.keyboard.press('Home');await expect(panel.getByRole('tab',{name:'Controls',exact:true})).toBeFocused();
 }
});
