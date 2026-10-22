import {test,expect} from '@playwright/test';
import {gallery,noOverflow} from '../support/f21-browser.mjs';
test('F21 responsive controls reflow across seven widths and enlarged text',async({page})=>{
 test.setTimeout(90000);const panel=await gallery(page);
 for(const width of [360,390,430,768,1024,1440,1920]){await page.setViewportSize({width,height:900});await noOverflow(page);await expect(panel.getByLabel('Example feature name')).toBeVisible();}
 await page.setViewportSize({width:768,height:900});await page.addStyleTag({content:'html {font-size:32px !important}'});await noOverflow(page);await panel.getByRole('tab',{name:'Evidence',exact:true}).click();await expect(panel.getByRole('region',{name:'Example evidence table'})).toBeVisible();
 // 360 CSS px also represents the reflow width of a 1440px display at 400% page zoom.
 await page.setViewportSize({width:360,height:900});await noOverflow(page);
});
