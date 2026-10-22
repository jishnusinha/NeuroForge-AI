import {expect} from '@playwright/test';
export async function gallery(page){await page.goto('/app?design=gallery');await page.getByText('PRISM component gallery',{exact:true}).first().click();return page.getByRole('region',{name:'PRISM component gallery',exact:true});}
export async function studio(page){await page.goto('/app/datasets');await page.getByRole('button',{name:'Try sample dataset',exact:true}).click();await page.getByRole('button',{name:'Chart Studio',exact:true}).click();const panel=page.getByRole('region',{name:'F18 Chart Studio',exact:true});await expect(panel.locator('.prism-f18-canvas svg').first()).toBeVisible();return panel;}
export async function noOverflow(page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
