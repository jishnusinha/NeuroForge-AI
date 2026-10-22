import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {chromium,expect} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
const require=createRequire(new URL('../client/package.json',import.meta.url));
const {preview}=await import(pathToFileURL(require.resolve('vite')).href);
await mkdir('.artifacts/f21',{recursive:true});
const server=await preview({root:'client',base:'/NeuroForge-AI/',build:{outDir:'../.artifacts/f21/pages-build'},preview:{port:4190,host:'127.0.0.1',strictPort:true}});
const browser=await chromium.launch({args:['--use-angle=swiftshader']}),results=[];
try{
 for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:4190/NeuroForge-AI/#/app/datasets');
  await page.getByRole('button',{name:'Try sample dataset',exact:true}).click();
  await page.getByRole('button',{name:'Chart Studio',exact:true}).click();
  const panel=page.getByRole('region',{name:'F18 Chart Studio',exact:true});
  await expect(panel.locator('.prism-f18-canvas svg').first()).toBeVisible();
  const pending=page.waitForEvent('download');
  await panel.getByRole('button',{name:'Download reproduction bundle (.zip)',exact:true}).click();
  const download=await pending;expect(download.suggestedFilename()).toBe('neuroforge-reproduction.zip');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
  await panel.screenshot({path:'.artifacts/f21/pages-chart-'+width+'.png',animations:'disabled'});
  results.push({width,hashRoute:page.url(),errors,download:download.suggestedFilename()});await page.close();
 }
 await writeFile('.artifacts/f21/pages-smoke.json',JSON.stringify(results,null,2));
 console.log('Static Pages hash routing, sample chart and ZIP export passed at 390 and 1440px.');
}finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
