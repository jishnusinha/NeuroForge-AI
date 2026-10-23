import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test('large local CSV scans in a worker, reports whole-file counts and requires explicit model sampling',async({page})=>{
 await page.goto('/app/datasets');
 const dataRows=Array.from({length:210000},(_,i)=>`record-${String(i).padStart(8,'0')},${String(i%2).padStart(12,'0')},${String((i*3)%997).padStart(10,'0')}`).join('\n');
 const csv=`row,value,target\n${dataRows}\n`;
 expect(Buffer.byteLength(csv)).toBeGreaterThan(2*1024*1024);
 await page.getByLabel('CSV file',{exact:true}).setInputFiles({name:'large-local.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
 const profile=page.getByRole('region',{name:'Whole file profile'});
 await expect(profile).toContainText('210,000 source rows',{timeout:90000});
 await expect(profile).toContainText('whole source stream');
 await expect(profile).toContainText('first 100 records and up to 100 columns');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'DataSheet',exact:true}).click();
 await page.getByRole('button',{name:'Open full-source DataSheet editor'}).click();
 const source=page.getByRole('region',{name:'Full source file browser'});
 await expect(source).toContainText('record-00000000');
 await source.getByRole('button',{name:'Next page'}).click();
 await expect(source).toContainText('record-00000100');
 await source.getByLabel('Full source filter column').selectOption('value');
 await source.getByLabel('Full source filter match').selectOption('equals');
 await source.getByLabel('Full source filter value').fill('1');
 await source.getByRole('button',{name:'Apply filter'}).click();
 await expect(source).toContainText('of 105,000');
 await expect(source.locator('tbody tr').first()).toContainText('1');
 await source.getByRole('button',{name:'Clear',exact:true}).click();
 await source.getByLabel('Full source sort column').selectOption('value');
 await source.getByLabel('Full source sort direction').selectOption('desc');
 await source.getByRole('button',{name:'Apply sort'}).click();
 await expect(source.locator('tbody tr').first()).toContainText('2record-00000001');
 await source.getByRole('button',{name:'Edit full source'}).click();
 await source.locator('tbody tr').first().locator('td').nth(1).getByRole('button').click();
 const edited=source.getByLabel('Edit source row 2 value');await edited.fill('7');await edited.press('Enter');
 await expect(source.locator('tbody tr').first()).toContainText('7');
 await expect(source.getByText('1 edited cells saved in this browser')).toBeVisible();
 const editedCsv=page.waitForEvent('download');await source.getByRole('button',{name:'Download edited full CSV'}).click();const editedFile=await editedCsv;
 expect(editedFile.suggestedFilename()).toBe('large-local-edited.csv');
 expect(await readFile(await editedFile.path(),'utf8')).toContain('record-00000001,7,3');
 await profile.getByRole('button',{name:'Use a reproducible sample for model preparation'}).click();
 await expect(profile).toContainText('2,000 of 210,000 source rows');
 await expect(profile).toContainText('seeded reservoir sample');
});

test('Academy gallery exposes ten case studies with reproducible dataset and method code downloads',async({page})=>{
 await page.goto('/app/learn/cases');
 const cards=page.locator('a[href^="/app/learn/cases/"]');await expect(cards).toHaveCount(10);
 await page.getByRole('link',{name:/Find rare manufacturing defects/}).click();
 await expect(page.getByRole('heading',{name:'Find rare manufacturing defects'})).toBeVisible();
 await expect(page.getByRole('img',{name:/Find rare manufacturing defects: generated data sample/})).toBeVisible();
 const csvDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Download CSV'}).click();const csvFile=await csvDownload;
 expect(csvFile.suggestedFilename()).toBe('manufacturing-defects.csv');
 const codeDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Download code'}).click();const code=await codeDownload;
 expect(code.suggestedFilename()).toBe('manufacturing-defects.py');
});

test('ten theme choices persist and update the declared light or dark mode',async({page})=>{
 await page.goto('/app/learn/cases');const picker=page.getByRole('combobox',{name:'Visual theme'});
 const expected=['midnight','slate','forest','paper','glacier','dusk','ocean','sand','rose','contrast'];
 await expect(picker.locator('option')).toHaveCount(10);
 for(const id of expected){await picker.selectOption(id);await expect(page.locator('html')).toHaveAttribute('data-theme',id);expect(await page.locator('html').evaluate(el=>el.classList.contains('dark'))).toBe(!['paper','glacier','sand','rose'].includes(id));}
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','contrast');
});
