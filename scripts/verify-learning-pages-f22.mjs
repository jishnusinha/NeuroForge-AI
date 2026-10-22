import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {chromium,expect} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
const require=createRequire(new URL('../client/package.json',import.meta.url));
const {preview}=await import(pathToFileURL(require.resolve('vite')).href);
const server=await preview({root:'client',base:'/NeuroForge-AI/',build:{outDir:resolve(process.argv[2]||'.artifacts/f22/pages-build')},preview:{port:4192,host:'127.0.0.1',strictPort:true}});
const browser=await chromium.launch({args:['--use-angle=swiftshader']}),results=[];
try{
 for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:4192/NeuroForge-AI/#/app/playground');
  expect(await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>/CodeCompanion-/.test(r.name)).length)).toBe(0);
  await page.getByText('F22 — ML / DL Code Companion',{exact:true}).click();
  const panel=page.getByRole('region',{name:'F22 Code Companion',exact:true});
  await panel.getByRole('tab',{name:'From scratch',exact:true}).click();
  await expect(panel.locator('pre')).toContainText('import numpy');
  const pending=page.waitForEvent('download');await panel.getByRole('button',{name:'Download .py example',exact:true}).click();
  const download=await pending;expect(await readFile(await download.path(),'utf8')).toContain('synthetic example only');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
  await panel.screenshot({path:'.artifacts/f22/pages-code-'+width+'.png',animations:'disabled'});
  results.push({width,hashRoute:page.url(),errors,download:download.suggestedFilename()});await page.close();
 }
 await writeFile('.artifacts/f22/pages-smoke.json',JSON.stringify(results,null,2));
 console.log('F22 static hash routing, lazy companion and Python download passed at 390 and 1440px.');
}finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
