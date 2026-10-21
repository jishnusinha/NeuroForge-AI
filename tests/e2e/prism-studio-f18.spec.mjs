import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

async function openStudio(page){
  await page.goto('/app/datasets');await page.getByRole('button',{name:'Try sample dataset'}).click();
  await page.getByRole('button',{name:'Chart Studio',exact:true}).click();
  const studio=page.getByRole('region',{name:'F18 Chart Studio',exact:true});
  await expect(studio.getByRole('region',{name:'F18 scientific chart'})).toBeVisible();
  return studio;
}
const plot=studio=>studio.getByRole('region',{name:'F18 scientific chart',exact:true});
async function ready(studio){await expect(studio.locator('.prism-f18-canvas svg').first()).toBeVisible();}
async function download(page,button){const pending=page.waitForEvent('download');await button.click();const file=await pending;return readFile(await file.path());}

test('F18 universal histogram keeps exact evidence, code, safe JSON and SVG/Canvas publication exports',async({page})=>{
  const studio=await openStudio(page);await ready(studio);
  await plot(studio).getByRole('button',{name:'Data',exact:true}).click();
  const json=JSON.parse((await download(page,plot(studio).getByRole('button',{name:'Download chart JSON',exact:true}))).toString());
  expect(json.schemaVersion).toBe(2);expect(json.evidence.rows.reduce((n,r)=>n+r.count,0)).toBe(120);
  expect(JSON.stringify(json)).not.toContain('sample-');expect(json.exportManifest.mode).toBe('aggregate_plot_data');
  const csv=(await download(page,plot(studio).getByRole('button',{name:'Download plotted CSV',exact:true}))).toString().trim().split(/\r?\n/);
  const countIndex=csv[0].split(',').indexOf('count');expect(csv.slice(1).reduce((n,line)=>n+Number(line.split(',')[countIndex]),0)).toBe(120);
  await plot(studio).getByRole('button',{name:'Python',exact:true}).click();await expect(plot(studio).locator('pre')).toContainText('plot-data reproduction');
  expect((await download(page,plot(studio).getByRole('button',{name:'Download .py',exact:true}))).toString()).toContain('pd.read_csv');
  await plot(studio).getByRole('button',{name:'JavaScript',exact:true}).click();await expect(plot(studio).locator('pre')).toContainText('chart.setOption(spec.renderOption)');
  await plot(studio).getByRole('button',{name:'Chart',exact:true}).click();await ready(studio);
  expect((await download(page,plot(studio).getByRole('button',{name:'Export SVG',exact:true}))).toString()).toContain('<svg');
  await studio.getByLabel('F18 renderer',{exact:true}).selectOption('canvas');
  await expect(studio.locator('.prism-f18-canvas canvas').first()).toBeVisible();
  const png=await download(page,plot(studio).getByRole('button',{name:'Export PNG',exact:true}));expect(png.subarray(1,4).toString()).toBe('PNG');
  expect((await download(page,plot(studio).getByRole('button',{name:'Export SVG',exact:true}))).toString()).toContain('<svg');
  await page.getByRole('combobox',{name:'Visual theme'}).selectOption('paper');
  await expect(studio.locator('.prism-f18-canvas canvas').first()).toBeVisible();
});

test('F18 gallery renders distribution, relationship and quality families using equivalent data views',async({page})=>{
  const studio=await openStudio(page);
  for(const type of ['kde','box','violin','ecdf','count','scatter','scatter_matrix','hexbin','trend','correlation','correlation_rank','missingness','completeness','quality','types','duplicates']){
    await studio.getByLabel('F18 chart type',{exact:true}).selectOption(type);await ready(studio);
    await expect(studio.getByRole('alert')).toHaveCount(0);
    await plot(studio).getByRole('button',{name:'Data',exact:true}).click();
    await expect(studio.getByRole('region',{name:'F18 exact plotted data',exact:true})).toBeVisible();
    await expect(studio.getByRole('region',{name:'F18 exact plotted data',exact:true}).getByRole('row')).not.toHaveCount(0);
  }
});

test('F18 selected DataSheet population links back to stable source rows and observation exports are opt-in',async({page})=>{
  await page.goto('/app/datasets');await page.getByRole('button',{name:'Try sample dataset'}).click();
  await page.getByRole('button',{name:'DataSheet',exact:true}).click();
  const sheet=page.getByLabel('DataSheet workspace',{exact:true}),grid=sheet.getByRole('grid');
  await grid.focus();await grid.press('Control+Home');
  for(let i=0;i<5;i++)await grid.press('Shift+ArrowDown');await grid.press('Shift+ArrowRight');
  await sheet.getByRole('button',{name:'Chart selected cells',exact:true}).click();
  const studio=page.getByRole('region',{name:'F18 Chart Studio',exact:true});await ready(studio);
  await expect(plot(studio)).toContainText('Selection');await expect(plot(studio)).toContainText('6 observations');
  await expect(plot(studio).getByRole('button',{name:'Download plotted CSV',exact:true})).toBeDisabled();
  const metadata=JSON.parse((await download(page,plot(studio).getByRole('button',{name:'Download chart JSON',exact:true}))).toString());
  expect(metadata.exportManifest.mode).toBe('metadata_only');expect(metadata.evidence.rows).toHaveLength(0);
  await studio.getByLabel('Allow observation-level chart exports',{exact:true}).check();
  const full=JSON.parse((await download(page,plot(studio).getByRole('button',{name:'Download chart JSON',exact:true}))).toString());
  expect(full.evidence.rows).toHaveLength(6);expect(full.source.selectionDigest).toMatch(/^[a-f0-9]{64}$/);expect(JSON.stringify(full)).not.toContain('sample-');
  await plot(studio).getByRole('button',{name:'Data',exact:true}).click();await studio.getByRole('button',{name:'Link plotted row 2',exact:true}).click();
  await plot(studio).getByRole('button',{name:'Chart',exact:true}).click();await studio.getByRole('button',{name:'Show linked DataSheet',exact:true}).click();
  await expect(sheet).toContainText('Linked chart highlights: 1 original observations');
  await expect(sheet.locator('[data-linked="true"] [role="rowheader"]')).toHaveAttribute('title','Source row sample-1');
});

test('F18 saved configurations recover against matching source and preserve source fingerprint',async({page})=>{
  let studio=await openStudio(page);
  await studio.getByLabel('F18 chart type',{exact:true}).selectOption('box');await ready(studio);
  await studio.getByRole('button',{name:'Save chart configuration',exact:true}).click();await expect(studio).toContainText('Chart configuration saved locally');
  await page.reload();studio=await openStudio(page);
  await studio.getByText('Saved charts (1)',{exact:true}).click();
  await studio.getByRole('button',{name:'Box plot · revision 1',exact:true}).click();
  await expect(studio.getByLabel('F18 chart type',{exact:true})).toHaveValue('box');await ready(studio);
  await expect(studio).toContainText('Saved configuration restored');
});

test('F18 pipeline views replay training fits without changing existing F12 evidence or split membership',async({page})=>{
  await page.goto('/app/datasets');await page.getByRole('button',{name:'Try sample dataset'}).click();
  await page.locator('summary:visible').filter({hasText:'Advanced Pipeline Studio (F11)'}).first().click();
  await page.locator('summary:visible').filter({hasText:'Professional ML Workbench'}).first().click();
  const model=page.getByRole('region',{name:'F12 Model Workbench'});
  await model.getByRole('button',{name:'Train and evaluate validation'}).click();
  const original=await model.getByRole('region',{name:'F12 validation results'}).innerText();
  await page.locator('summary:visible').filter({hasText:'Visualize fitted preprocessing'}).first().click();
  const studio=page.getByRole('region',{name:'F18 fitted pipeline visualization',exact:true});await ready(studio);
  for(const type of ['pipeline_distribution','pipeline_missingness','pipeline_scaling','pipeline_expansion','pipeline_lineage','pipeline_split','pipeline_summary','pipeline_invalid']){
    await studio.getByLabel('F18 chart type',{exact:true}).selectOption(type);await ready(studio);
    await plot(studio).getByRole('button',{name:'Methods',exact:true}).click();
    await expect(studio).toContainText('No fitting, split creation, model evaluation');
  }
  await studio.getByLabel('F18 pipeline partition',{exact:true}).selectOption('test');
  await expect(studio).toContainText('18 observations');
  expect(await model.getByRole('region',{name:'F12 validation results'}).innerText()).toBe(original);
  await expect(model.getByRole('region',{name:'F12 final test results'})).toHaveCount(0);
});

test('F18 2000-row SVG/Canvas benchmark loads on demand and disposes the chart surface',async({page},testInfo)=>{
  const scripts=[];page.on('response',response=>{if(response.url().includes('/assets/'))scripts.push(response.url());});
  await page.goto('/');await expect(page.locator('body')).toBeVisible();
  expect(scripts.some(url=>url.includes('ChartStudio-'))).toBe(false);
  await page.goto('/app/datasets');
  const headers=Array.from({length:20},(_,i)=>'measure_'+i);
  await page.getByLabel('CSV file').setInputFiles({name:'f18-full.csv',mimeType:'text/csv',buffer:Buffer.from([headers.join(','),...Array.from({length:2000},(_,i)=>headers.map((_,c)=>i*(c+1)).join(','))].join('\n'))});
  expect(scripts.some(url=>url.includes('ChartStudio-'))).toBe(false);
  await page.getByRole('button',{name:'Chart Studio',exact:true}).click();
  const studio=page.getByRole('region',{name:'F18 Chart Studio',exact:true});
  await studio.getByLabel('F18 chart type',{exact:true}).selectOption('scatter');await ready(studio);
  const measurements=[];
  for(const renderer of ['svg','canvas']){
    await studio.getByLabel('F18 renderer',{exact:true}).selectOption(renderer);
    await expect(studio.locator('.prism-f18-canvas '+renderer).first()).toBeVisible();
    await expect(studio.getByTestId('f18-render-benchmark')).toContainText(renderer.toUpperCase()+' ready');
    const text=await studio.getByTestId('f18-render-benchmark').innerText();
    const initMs=Number(text.match(/ready in ([\d.]+) ms/)[1]);expect(initMs).toBeLessThan(15000);
    measurements.push({renderer,rows:2000,initMs});
  }
  await testInfo.attach('f18-render-benchmark',{body:JSON.stringify(measurements),contentType:'application/json'});
  await studio.locator('.prism-f18-canvas').screenshot({path:testInfo.outputPath('f18-scatter-canvas.png')});
  await plot(studio).getByRole('button',{name:'Data',exact:true}).click();
  expect(await studio.getByRole('region',{name:'F18 exact plotted data',exact:true}).getByRole('row').count()).toBe(101);
  await expect(studio.locator('.prism-f18-canvas')).toHaveCount(0);
  await page.getByRole('button',{name:'Overview',exact:true}).click();await expect(page.getByRole('region',{name:'F18 scientific chart'})).toHaveCount(0);
});

test('F18 working-copy plots are labeled and do not change committed preparation values',async({page})=>{
  await page.goto('/app/datasets');await page.getByRole('button',{name:'Try sample dataset'}).click();
  const preparation=page.getByRole('region',{name:'CSV preparation',exact:true});
  const before=await preparation.innerText();
  await page.getByRole('button',{name:'DataSheet',exact:true}).click();
  const sheet=page.getByLabel('DataSheet workspace',{exact:true});
  await sheet.getByRole('button',{name:'Create working copy',exact:true}).click();
  await sheet.getByLabel('Edit cell value',{exact:true}).fill('123');await sheet.getByRole('button',{name:'Apply cell',exact:true}).click();
  await sheet.getByRole('button',{name:'Chart current sheet view',exact:true}).click();
  const studio=page.getByRole('region',{name:'F18 Chart Studio',exact:true});await ready(studio);
  await expect(studio).toContainText('Working copy chart');await expect(plot(studio)).toContainText('Working Copy');
  expect(await preparation.innerText()).toBe(before);
  const spec=JSON.parse((await download(page,plot(studio).getByRole('button',{name:'Download chart JSON',exact:true}))).toString());
  expect(spec.source.population).toBe('working_copy');expect(Math.max(...spec.evidence.rows.map(row=>row.to))).toBe(123);
});

test('F18 pointer brushing links source observations and clearing restores the sheet view',async({page})=>{
  const studio=await openStudio(page);await studio.getByLabel('F18 chart type',{exact:true}).selectOption('scatter');await ready(studio);
  await studio.getByRole('button',{name:'Brush observations',exact:true}).click();
  await studio.locator('.prism-f18-canvas').scrollIntoViewIfNeeded();
  const box=await studio.locator('.prism-f18-canvas').boundingBox();
  await page.mouse.move(box.x+box.width*.4,box.y+box.height*.25);await page.mouse.down();
  await page.mouse.move(box.x+box.width*.85,box.y+box.height*.75,{steps:12});await page.mouse.up();
  const sheet=page.getByLabel('DataSheet workspace',{exact:true});
  await expect(sheet).toContainText(/Linked chart highlights: [1-9]\d* original observations/);
  await studio.getByRole('button',{name:'Show linked DataSheet',exact:true}).click();
  await expect(sheet.getByRole('grid')).toHaveAttribute('aria-rowcount','121');
  await page.getByRole('button',{name:'Chart Studio',exact:true}).click();await ready(studio);
  await studio.getByRole('button',{name:'Clear chart selection',exact:true}).click();
  await studio.getByRole('button',{name:'Show linked DataSheet',exact:true}).click();
  await expect(sheet).not.toContainText('Linked chart highlights:');
  await expect(sheet.getByRole('grid')).toHaveAttribute('aria-rowcount','121');
});

test('F18 missingness findings apply an explicit F10 filter and retain observation identities',async({page})=>{
  await page.goto('/app/datasets');
  await page.getByLabel('CSV file').setInputFiles({name:'missing.csv',mimeType:'text/csv',buffer:Buffer.from('x,y,label\n1,2,0\n,3,1\n3,4,0\n,5,1\n5,6,0')});
  await page.getByRole('button',{name:'Chart Studio',exact:true}).click();
  const studio=page.getByRole('region',{name:'F18 Chart Studio',exact:true});
  await studio.getByLabel('F18 chart type',{exact:true}).selectOption('completeness');await ready(studio);
  await plot(studio).getByRole('button',{name:'Data',exact:true}).click();
  await studio.getByRole('button',{name:'Filter DataSheet to missing x',exact:true}).click();
  const sheet=page.getByLabel('DataSheet workspace',{exact:true});
  await expect(sheet.getByRole('grid')).toHaveAttribute('aria-rowcount','3');
  await expect(sheet.locator('[role="rowheader"]').first()).toHaveAttribute('title','Source row sample-1');
  await expect(sheet.locator('[role="rowheader"]').last()).toHaveAttribute('title','Source row sample-3');
});
