import {test,expect} from '@playwright/test';

async function open(page){
  await page.goto('/app/datasets');
  await page.getByRole('button',{name:'Try sample dataset'}).click();
  await expect(page.getByRole('region',{name:'CSV preparation',exact:true})).toHaveCount(1);
  await page.getByRole('button',{name:'DataSheet',exact:true}).click();
  return page.getByLabel('DataSheet workspace',{exact:true});
}
test('F17 editing, atomic paste, undo, refresh recovery and new version preparation',async({page})=>{
  let workspace=await open(page);
  await workspace.getByRole('grid').focus();
  await workspace.getByRole('grid').press('ArrowRight');
  await workspace.getByRole('button',{name:'Create working copy'}).click();
  await expect(workspace.getByRole('grid')).toHaveAttribute('aria-readonly','false');
  const original=await workspace.getByLabel('Edit cell value',{exact:true}).inputValue();
  await workspace.getByLabel('Edit cell value',{exact:true}).fill('123');
  await workspace.getByRole('button',{name:'Apply cell',exact:true}).click();
  await expect(workspace).toContainText('1 changed cells');
  await workspace.getByLabel('Paste TSV',{exact:true}).fill('7\tbad');
  await workspace.getByRole('button',{name:'Apply paste',exact:true}).click();
  await expect(workspace.getByRole('alert')).toContainText('F17_INVALID_NUMBER');
  await expect(workspace).toContainText('1 changed cells');
  await workspace.getByRole('button',{name:'Undo',exact:true}).click();
  await expect(workspace).toContainText('0 changed cells');
  await expect(workspace.getByLabel('Selected source cell')).toContainText(original);
  await workspace.getByRole('button',{name:'Redo',exact:true}).click();
  await workspace.getByRole('button',{name:'Save draft locally',exact:true}).click();
  await expect(workspace).toContainText('Draft saved locally');
  await page.reload();
  await page.getByRole('button',{name:/Recover draft:/}).click();
  workspace=page.getByLabel('DataSheet workspace',{exact:true});
  await expect(workspace).toContainText('1 changed cells');
  await workspace.getByRole('button',{name:'Review changes',exact:true}).click();
  await expect(workspace.getByLabel('Before and after changes')).toContainText('123');
  await workspace.getByRole('button',{name:'Commit new dataset version',exact:true}).click();
  await expect(page.getByRole('region',{name:'Dataset profile dashboard'})).toContainText('edited version');
  await page.getByRole('button',{name:'DataSheet',exact:true}).click();
  await expect(page.getByRole('grid')).toHaveAttribute('aria-readonly','true');
  await expect(page.getByRole('gridcell',{name:/B1, feature_y, 123/})).toHaveCount(1);
});

test('F17 search, sorting, range statistics and explicit chart scope',async({page})=>{
  const workspace=await open(page);
  await workspace.getByRole('button',{name:'Sort column label',exact:true}).click();
  await workspace.getByRole('grid').focus();
  await workspace.getByRole('grid').press('Control+Home');
  await workspace.getByRole('grid').press('Shift+ArrowDown');
  await expect(workspace.getByRole('region',{name:'Selected range statistics'})).toContainText('Count: 2');
  await workspace.getByLabel('Search DataSheet',{exact:true}).fill('no-matching-value');
  await expect(workspace.getByRole('grid')).toHaveAttribute('aria-rowcount','1');
  await workspace.getByLabel('Search DataSheet',{exact:true}).fill('feature_x');
  await workspace.getByRole('button',{name:'Analyze visible rows / Chart',exact:true}).click();
  await expect(page.getByRole('button',{name:/Clear DataSheet analysis scope/})).toContainText('120');
});

test('F17 IndexedDB revisions conflict atomically and owner scopes isolate recovery',async({page})=>{
  const workspace=await open(page);
  await workspace.getByRole('button',{name:'Create working copy'}).click();
  await workspace.getByRole('button',{name:'Save draft locally',exact:true}).click();
  await expect(workspace).toContainText('Draft saved locally');
  // A second tab writes the same recovery revision.
  const other=await page.context().newPage();
  await other.goto('/app/datasets');
  await other.getByRole('button',{name:/Recover draft:/}).click();
  await other.getByRole('button',{name:'Save draft locally',exact:true}).click();
  await expect(other.getByLabel('DataSheet workspace',{exact:true})).toContainText('Draft saved locally');
  await workspace.getByRole('button',{name:'Save draft locally',exact:true}).click();
  await expect(workspace.getByRole('alert')).toContainText('F17_REVISION_CONFLICT');
  await page.evaluate(()=>localStorage.setItem('neuroforge_account_id','different-owner'));
  await page.reload();
  await expect(page.getByRole('button',{name:/Recover draft:/})).toHaveCount(0);
  await other.close();
});

test('F17 quota failures remain visible and never claim a saved draft',async({page})=>{
  const workspace=await open(page);
  await workspace.getByRole('button',{name:'Create working copy'}).click();
  await page.evaluate(()=>Object.defineProperty(navigator.storage,'estimate',{configurable:true,value:async()=>({usage:0,quota:0})}));
  await workspace.getByRole('button',{name:'Save draft locally',exact:true}).click();
  await expect(workspace.getByRole('alert')).toContainText('LOCAL_QUOTA_BUDGET_EXCEEDED');
  await expect(workspace).not.toContainText('Draft saved locally');
  await page.getByRole('button',{name:'Refresh saved DataSheets'}).click();
  await expect(page.getByRole('button',{name:/Recover draft:/})).toHaveCount(0);
});

test('F17 fill, keyboard history and bundle export/import preserve typed transactions',async({page})=>{
  const workspace=await open(page);
  await workspace.getByRole('button',{name:'Create working copy'}).click();
  const grid=workspace.getByRole('grid');
  await grid.focus();await grid.press('Control+Home');await grid.press('Shift+ArrowDown');
  await workspace.getByRole('button',{name:'Fill down',exact:true}).click();
  await expect(workspace).toContainText('1 changed cells');
  await grid.focus();await grid.press('Control+z');
  await expect(workspace).toContainText('0 changed cells');
  await grid.press('Control+y');
  await expect(workspace).toContainText('1 changed cells');
  const pending=page.waitForEvent('download');
  await workspace.getByRole('button',{name:'Export working copy',exact:true}).click();
  const file=await pending, path=await file.path();
  await page.reload();
  await page.getByLabel('Import DataSheet bundle',{exact:true}).setInputFiles(path);
  await expect(page.getByLabel('DataSheet workspace',{exact:true})).toContainText('1 changed cells');
});

test('F17 committing edits clears fitted F12 evidence and rebuilds preparation',async({page})=>{
  const workspace=await open(page);
  const openModel=async()=>{
    await page.locator('summary:visible').filter({hasText:'Advanced Pipeline Studio (F11)'}).first().click();
    await page.locator('summary:visible').filter({hasText:'Professional ML Workbench'}).first().click();
    return page.getByRole('region',{name:'F12 Model Workbench'});
  };
  let models=await openModel();
  await models.getByRole('button',{name:'Train and evaluate validation'}).click();
  await expect(models.getByRole('region',{name:'F12 validation results'})).toBeVisible();
  await workspace.getByRole('button',{name:'Create working copy'}).click();
  await workspace.getByLabel('Edit cell value',{exact:true}).fill('123');
  await workspace.getByRole('button',{name:'Apply cell',exact:true}).click();
  await workspace.getByRole('button',{name:'Review changes',exact:true}).click();
  await workspace.getByRole('button',{name:'Commit new dataset version',exact:true}).click();
  await expect(page.getByRole('region',{name:'Dataset profile dashboard'})).toContainText('edited version');
  models=await openModel();
  await expect(page.getByRole('region',{name:'CSV preparation',exact:true})).toHaveCount(1);
  await expect(models.getByRole('region',{name:'F12 validation results'})).toHaveCount(0);
  await expect(models.getByRole('region',{name:'F12 model candidates'}).getByRole('button')).toHaveCount(0);
});

test('F17 clipboard keeps sorted stable observations and trailing missing rows',async({page,context})=>{
  await context.grantPermissions(['clipboard-read','clipboard-write']);
  await page.goto('/app/datasets');
  await page.getByLabel('CSV file').setInputFiles({name:'clipboard.csv',mimeType:'text/csv',buffer:Buffer.from('value,category\n1,a\n,b\n3,c\n4,d')});
  await page.getByRole('button',{name:'DataSheet',exact:true}).click();
  const workspace=page.getByLabel('DataSheet workspace',{exact:true}),grid=workspace.getByRole('grid');
  await grid.focus();await grid.press('Control+Home');await grid.press('Shift+ArrowDown');await grid.press('Shift+ArrowDown');
  await workspace.getByRole('button',{name:'Sort column value',exact:true}).click();
  await workspace.getByRole('button',{name:'Sort column value',exact:true}).click();
  await workspace.getByRole('button',{name:'Copy selection',exact:true}).click();
  await expect(workspace).toContainText('Selection copied as safe TSV');
  expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe('3\r\n1\r\n\r\n');
});

test('F17 full-size fill remains virtualized and reverses as one transaction',async({page})=>{
  await page.goto('/app/datasets');
  const headers=Array.from({length:20},(_,i)=>'c'+i);
  const csv=[headers.join(','),...Array.from({length:2000},(_,r)=>headers.map((_,c)=>r*20+c).join(','))].join('\n');
  await page.getByLabel('CSV file').setInputFiles({name:'full-sheet.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  await page.getByRole('button',{name:'DataSheet',exact:true}).click();
  const workspace=page.getByLabel('DataSheet workspace',{exact:true}),grid=workspace.getByRole('grid');
  await workspace.getByRole('button',{name:'Create working copy'}).click();
  await grid.focus();await grid.press('Control+Home');await grid.press('Control+Shift+End');
  await expect(workspace.getByRole('region',{name:'Selected range statistics'})).toContainText('Count: 40000');
  await workspace.getByRole('button',{name:'Fill down',exact:true}).click();
  await expect(workspace).toContainText('39980 changed cells');
  expect(await grid.getByRole('gridcell').count()).toBeLessThan(300);
  await workspace.getByRole('button',{name:'Review changes',exact:true}).click();
  await expect(workspace.getByLabel('Before and after changes').getByRole('row')).toHaveCount(101);
  await workspace.getByRole('button',{name:'Undo',exact:true}).click();
  await expect(workspace).toContainText('0 changed cells');
  await expect(workspace.getByLabel('Selected source cell')).toContainText('39999');
});
