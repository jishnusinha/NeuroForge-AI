import {test,expect} from '@playwright/test';
import {studio} from '../support/f21-browser.mjs';
import {download} from '../support/f19-browser.mjs';
test('F21 reproduction bundle includes exact evidence and observation consent is enforced',async({page})=>{
 const panel=await studio(page),chart=panel.getByRole('region',{name:'F18 scientific chart',exact:true});
 const bytes=await download(page,chart.getByRole('button',{name:'Download reproduction bundle (.zip)',exact:true}));expect(bytes.readUInt32LE(0)).toBe(0x04034b50);const content=bytes.toString();for(const file of ['neuroforge-chart.json','neuroforge-chart-data.csv','neuroforge-chart.py','neuroforge-chart.js','README.txt'])expect(content).toContain(file);expect(content).toContain('aggregate_plot_data');
 await chart.getByRole('button',{name:'Chart',exact:true}).focus();await page.keyboard.press('ArrowRight');await expect(chart.getByRole('button',{name:'Data',exact:true})).toBeFocused();await expect(chart.getByRole('region',{name:'F18 exact plotted data'})).toBeVisible();
 await panel.getByLabel('F18 chart type',{exact:true}).selectOption('scatter');await expect(chart.getByRole('button',{name:'Download reproduction bundle (.zip)',exact:true})).toBeDisabled();await chart.getByLabel('Allow observation-level chart exports').check();await expect(chart.getByRole('button',{name:'Download reproduction bundle (.zip)',exact:true})).toBeEnabled();
});
