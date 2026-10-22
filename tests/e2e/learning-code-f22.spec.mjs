import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {openModel} from '../support/f19-browser.mjs';
async function openCompanion(page){await page.getByText('F22 — ML / DL Code Companion',{exact:true}).click();return page.getByRole('region',{name:'F22 Code Companion',exact:true});}
async function downloaded(page,button){const promise=page.waitForEvent('download');await button.click();return readFile(await(await promise).path(),'utf8');}
test('F22 Playground companion is lazy, follows settings, copies and downloads reviewed examples',async({page})=>{
 await page.addInitScript(()=>{window.__copiedCode='';Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.__copiedCode=value;}}});});
 await page.goto('/app/playground');expect(await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>/CodeCompanion-/.test(r.name)).length)).toBe(0);
 const panel=await openCompanion(page);await expect(panel).toContainText('Synthetic example only');await panel.getByRole('tab',{name:'From scratch',exact:true}).click();await expect(panel.locator('pre')).toContainText('numpy');
 const python=await downloaded(page,panel.getByRole('button',{name:'Download .py example',exact:true}));expect(python).toContain('synthetic example only');expect(python).toContain('32');
 await panel.getByRole('button',{name:'Copy Python example',exact:true}).click();expect(await page.evaluate(()=>window.__copiedCode)).toBe(python);
 await panel.getByLabel('F22 code language').selectOption('javascript');await expect(panel.locator('pre')).toContainText('const C =');
 const js=await downloaded(page,panel.getByRole('button',{name:'Download .mjs example',exact:true}));expect(js).toContain('JSON.stringify');
 await panel.getByRole('tab',{name:'Observed evidence',exact:true}).click();await expect(panel.getByRole('table')).toContainText('Unavailable');await expect(panel.getByRole('table')).not.toContainText('synthetic_example_only');
 await expect(page.getByRole('button',{name:'Save Run',exact:true})).toBeDisabled();
 await page.getByRole('combobox',{name:'Algorithm',exact:true}).selectOption('Linear Regression');
 await page.getByLabel('Regression solver',{exact:true}).selectOption('gd');
 await page.getByLabel('Regression learning rate',{exact:true}).fill('0.2');
 const changed=JSON.parse(await downloaded(page,panel.getByRole('button',{name:'Download example context',exact:true})));
 expect(changed.context.method).toBe('gd');expect(changed.context.features).toBe(1);expect(changed.context.learningRate).toBe(.2);
});
test('F22 Studio examples reflect dimensions, optimizer and seed without implicit training',async({page})=>{
 await page.goto('/app/studio');await page.getByRole('spinbutton',{name:'Model seed',exact:true}).fill('73');const panel=await openCompanion(page);await panel.getByRole('tab',{name:'Framework',exact:true}).click();await expect(panel.locator('pre')).toContainText('torch.manual_seed(73)');await expect(panel).toContainText('Dense(2, 4)');
 await panel.getByLabel('F22 code language').selectOption('javascript');await expect(panel.locator('pre')).toContainText("import * as tf from '@tensorflow/tfjs'");await expect(panel.locator('pre')).toContainText('model.fit');
 const metadata=JSON.parse(await downloaded(page,panel.getByRole('button',{name:'Download example context',exact:true})));expect(metadata.context.seed).toBe(73);expect(metadata.context.layers.map(l=>l.units)).toEqual([2,4,1]);expect(metadata.provenance).toContain('not exact browser-run reproduction');
 await expect(page.getByRole('button',{name:'Save Run',exact:true})).toBeDisabled();
});
test('F22 model entry preserves final-test isolation and imported names stay out of code',async({page})=>{
 const model=await openModel(page);const panel=await openCompanion(page);await panel.getByRole('tab',{name:'Experiment recipe',exact:true}).click();await expect(panel).toContainText('feature_1');const metadata=await downloaded(page,panel.getByRole('button',{name:'Download example context',exact:true}));expect(metadata).not.toContain('feature_x');expect(metadata).not.toContain('sourceRowIds');expect(metadata).not.toContain('fittedPipeline');
 await expect(model.getByRole('region',{name:'F12 final test results',exact:true})).toHaveCount(0);await expect(model.getByRole('region',{name:'F12 validation results',exact:true})).toHaveCount(0);
 await panel.getByRole('tab',{name:'Concept',exact:true}).focus();await page.keyboard.press('ArrowRight');await expect(panel.getByRole('tab',{name:'From scratch',exact:true})).toBeFocused();
});
test('F22 code controls and source reflow in four themes and unsupported methods are explicit',async({page},info)=>{
 await page.goto('/app/playground');const panel=await openCompanion(page);await panel.getByRole('tab',{name:'Framework',exact:true}).click();
 for(const theme of ['midnight','slate','forest','paper']){await page.getByRole('combobox',{name:'Visual theme'}).selectOption(theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(panel.locator('pre')).toBeVisible();await panel.screenshot({path:info.outputPath('code-'+theme+'.png')});}
 await panel.getByLabel('F22 teaching mode').selectOption('advanced');await expect(panel.locator('pre')).toContainText('loss.backward');
 // Selecting an unreviewed model never silently substitutes logistic code.
 await page.getByRole('combobox',{name:'Algorithm',exact:true}).selectOption('K-Nearest Neighbors (KNN)');await expect(panel).toContainText('no reviewed F22.0 template');await expect(panel.getByRole('button',{name:/Copy/})).toHaveCount(0);
});
