import { test,expect } from '@playwright/test';

async function openSheet(page){
  const lab=page.getByRole('region',{name:'Dataset profile dashboard'});
  await expect(lab).toBeVisible();
  await lab.getByRole('button',{name:'DataSheet',exact:true}).click();
  const sheet=lab.getByRole('region',{name:'F17 PRISM DataSheet'});
  const grid=sheet.getByRole('grid',{name:'PRISM DataSheet cells'});
  await expect(grid).toBeVisible();
  return {lab,sheet,grid};
}

test('F17.0: PRISM spreadsheet navigates filtered original cells and inspects stable source IDs',async({page})=>{
  await page.goto('/app/datasets');
  await page.getByRole('button',{name:'Try sample dataset'}).click();
  const {lab,sheet,grid}=await openSheet(page);
  await expect(grid).toHaveAttribute('aria-readonly','true');
  await expect(grid).toHaveAttribute('aria-rowcount','121');
  await expect(grid).toHaveAttribute('aria-colcount','4');
  await expect(sheet.getByLabel('Selected cell address')).toHaveText('A1');
  await expect(sheet).toContainText('Source · Read-only');
  await expect(sheet).toContainText('120 filtered observations');

  const resize=sheet.getByRole('button',{name:'Resize DataSheet column feature_x'});
  const originalWidth=await resize.evaluate(element=>element.parentElement.getBoundingClientRect().width);
  await resize.focus();
  await resize.press('ArrowRight');
  const resizedWidth=await resize.evaluate(element=>element.parentElement.getBoundingClientRect().width);
  expect(resizedWidth).toBeGreaterThan(originalWidth);

  await grid.focus();
  await grid.press('ArrowRight');
  await expect(sheet.getByLabel('Selected cell address')).toHaveText('B1');
  await grid.press('ArrowDown');
  await expect(sheet.getByLabel('Selected cell address')).toHaveText('B2');
  await expect(sheet.getByRole('gridcell',{name:/B2, feature_y/})).toHaveAttribute('aria-selected','true');
  await grid.press('Control+End');
  await expect(sheet.getByLabel('Selected cell address')).toHaveText('C120');
  await expect(sheet.getByRole('gridcell',{name:/C120, label/})).toBeVisible();
  await expect(sheet.getByRole('region',{name:'DataSheet source inspector'})).toContainText('sample-119');
  await grid.press('Control+Home');
  await expect(sheet.getByLabel('Selected cell address')).toHaveText('A1');

  await sheet.getByRole('button',{name:'Keyboard'}).click();
  await expect(sheet.getByRole('note')).toContainText('Arrow keys');
  await sheet.getByRole('button',{name:/Inspect in Row Explorer/}).click();
  await expect(lab.getByRole('region',{name:'Filtered source row table'})).toBeVisible();
  await expect(lab).toContainText('Selected original row: sample-0');
});

test('F17.0: F10 filter changes DataSheet population without changing source identities',async({page})=>{
  await page.goto('/app/datasets');
  await page.getByRole('button',{name:'Try sample dataset'}).click();
  const {lab}=await openSheet(page);
  await lab.getByRole('combobox',{name:'Filter column'}).selectOption('label');
  await lab.getByRole('textbox',{name:'Filter value'}).fill('1');
  await lab.getByRole('button',{name:'Add filter'}).click();
  await expect(lab).toContainText('120 original / 60 analyzed');
  const sheet=lab.getByRole('region',{name:'F17 PRISM DataSheet'});
  const grid=sheet.getByRole('grid',{name:'PRISM DataSheet cells'});
  await expect(grid).toHaveAttribute('aria-rowcount','61');
  await expect(sheet.getByRole('region',{name:'DataSheet source inspector'})).toContainText('sample-60');
  await grid.focus();
  await grid.press('ArrowDown');
  await expect(sheet.getByRole('region',{name:'DataSheet source inspector'})).toContainText('sample-61');
  await lab.getByRole('button',{name:'Row Explorer',exact:true}).click();
  await expect(lab.getByRole('region',{name:'Filtered source row table'})).toContainText('sample-61');
  await lab.getByRole('button',{name:'DataSheet',exact:true}).click();
  await expect(lab.getByRole('region',{name:'DataSheet source inspector'})).toContainText('sample-61');
  await lab.getByRole('button',{name:/Clear all/}).click();
  await expect(lab).toContainText('120 original / 120 analyzed');
  await expect(grid).toHaveAttribute('aria-rowcount','121');
});

test('F17.0: a 2000-by-20 sheet virtualizes both axes and remains read-only',async({page})=>{
  await page.goto('/app/datasets');
  const headers=Array.from({length:20},(_,i)=>'measure_'+i);
  const lines=Array.from({length:2000},(_,row)=>
    headers.map((_,col)=>row*20+col).join(','));
  await page.getByLabel('CSV file').setInputFiles({
    name:'f17-large-grid.csv',mimeType:'text/csv',
    buffer:Buffer.from([headers.join(','),...lines].join('\n')),
  });
  const {sheet,grid}=await openSheet(page);
  await expect(grid).toHaveAttribute('aria-rowcount','2001');
  await expect(grid).toHaveAttribute('aria-colcount','21');
  await expect(sheet).toContainText('2,000 filtered observations');
  const initialRows=await grid.getByRole('row').count();
  const initialCells=await grid.getByRole('gridcell').count();
  expect(initialRows).toBeLessThan(35);
  expect(initialCells).toBeLessThan(210);
  await grid.focus();
  await grid.press('Control+End');
  await expect(sheet.getByLabel('Selected cell address')).toHaveText('T2000');
  await expect(sheet.getByRole('region',{name:'DataSheet source inspector'})).toContainText('sample-1999');
  await expect(grid.getByRole('gridcell',{name:/T2000, measure_19/})).toBeVisible();
  expect(await grid.getByRole('gridcell').count()).toBeLessThan(210);
  await grid.press('Delete');
  await expect(sheet).toContainText('Read-only · No dataset mutation');
  await grid.press('Control+Home');
  await expect(sheet.getByLabel('Selected cell address')).toHaveText('A1');
  await expect(grid.getByRole('gridcell',{name:/A1, measure_0, 0/})).toBeVisible();
});

test('F17.0: missing source values remain missing and old Row Explorer stays available',async({page})=>{
  await page.goto('/app/datasets');
  const csv='age,segment,outcome\n10,A,0\n,B,1\n30,A,0\n40,B,1\n50,A,0\n';
  await page.getByLabel('CSV file').setInputFiles({
    name:'f17-missing.csv',mimeType:'text/csv',buffer:Buffer.from(csv),
  });
  const {lab,sheet,grid}=await openSheet(page);
  await grid.focus();
  await grid.press('ArrowDown');
  await expect(sheet.getByLabel('Selected cell address')).toHaveText('A2');
  await expect(grid.getByRole('gridcell',{name:/A2, age, Missing/})).toHaveAttribute('aria-selected','true');
  await expect(sheet.getByRole('region',{name:'DataSheet source inspector'})).toContainText('sample-1');
  await expect(sheet).toContainText('Missing');
  await lab.getByRole('button',{name:'Row Explorer',exact:true}).click();
  const legacy=lab.getByRole('region',{name:'Filtered source row table'});
  await expect(legacy).toBeVisible();
  await expect(legacy).toContainText('Missing');
  await expect(legacy).toContainText('sample-1');
});
