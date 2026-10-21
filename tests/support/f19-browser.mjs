import {expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
export async function openModel(page,{regression=false,multi=false}={}){
  await page.goto('/app/datasets');
  if(regression||multi){const rows=Array.from({length:90},(_,i)=>[i/10,i%7,regression?2*i/10-i%7:['a','b','c'][i%3]].join(','));await page.getByLabel('CSV file').setInputFiles({name:'f19.csv',mimeType:'text/csv',buffer:Buffer.from(['x,y,target',...rows].join('\n'))});}
  else await page.getByRole('button',{name:'Try sample dataset'}).click();
  await page.locator('summary:visible').filter({hasText:'Advanced Pipeline Studio (F11)'}).first().click();
  if(regression)await page.getByRole('combobox',{name:'F12 learning task'}).selectOption('regression');
  await page.locator('summary:visible').filter({hasText:'F12 — Professional ML Workbench'}).first().click();
  return page.getByRole('region',{name:'F12 Model Workbench',exact:true});
}
export async function train(panel,algorithm){await panel.getByLabel('F12 algorithm',{exact:true}).selectOption(algorithm);await panel.getByRole('button',{name:'Train and evaluate validation',exact:true}).click();await expect(panel.getByRole('region',{name:'F12 validation results',exact:true})).toContainText(algorithm);}
export async function openEvaluation(panel){await panel.locator('summary:visible').filter({hasText:'F19 — Model Evaluation Studio'}).first().click();const studio=panel.getByRole('region',{name:'F19 Model Evaluation Studio',exact:true}).first();await ready(studio);return studio;}
export const chart=parent=>parent.getByRole('region',{name:'F19 scientific chart',exact:true});
export async function ready(parent){await expect(chart(parent).locator('.prism-f18-canvas svg').first()).toBeVisible();}
export async function download(page,button){const waiting=page.waitForEvent('download');await button.click();const file=await waiting;return readFile(await file.path());}
export async function json(page,parent){return JSON.parse((await download(page,chart(parent).getByRole('button',{name:'Download chart JSON',exact:true}))).toString());}
