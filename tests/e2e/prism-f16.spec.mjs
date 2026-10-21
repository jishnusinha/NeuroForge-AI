import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function openPrism(page){
  await page.goto('/app/datasets');
  await page.getByRole('button',{name:'Try sample dataset'}).click();
  const lab=page.getByRole('region',{name:'Dataset profile dashboard'});
  await lab.getByRole('button',{name:'Distributions'}).click();
  const chart=lab.getByRole('region',{name:'PRISM scientific histogram'});
  await expect(chart).toBeVisible();
  return {lab,chart};
}

test('F16 PRISM: observed F10 histogram, exact data view, portable Python and summary-only exports',async({page})=>{
  const {lab,chart}=await openPrism(page);
  await expect(chart).toContainText('120 filtered rows');
  await expect(chart).toContainText('120 observed');
  await expect(chart.getByRole('img',{name:/feature_x observed histogram/})).toBeVisible();
  await chart.getByRole('group',{name:'PRISM chart views'}).getByRole('button',{name:'Data'}).click();
  const table=chart.getByRole('region',{name:'PRISM histogram data table'});
  await expect(table).toBeVisible();
  await expect(table.getByRole('row')).toHaveCount(10); // 8 bins + header + total
  await expect(table).toContainText('Observed total');

  await chart.getByRole('group',{name:'PRISM chart views'}).getByRole('button',{name:'Python'}).click();
  await expect(chart).toContainText('import seaborn as sns');
  await expect(chart).toContainText('import matplotlib.pyplot as plt');
  await expect(chart).toContainText('neuroforge-chart-data.csv');
  await chart.getByRole('button',{name:'Copy Python'}).click();
  await expect(chart.getByRole('status')).toContainText(/copied|Clipboard unavailable/);

  const csvDownload=page.waitForEvent('download');
  await chart.getByRole('button',{name:'Data CSV'}).click();
  const csvFile=await csvDownload;
  expect(csvFile.suggestedFilename()).toBe('neuroforge-chart-data.csv');
  const csv=await readFile(await csvFile.path(),'utf8');
  expect(csv).toMatch(/^bin,from,to,count\r?\n/);
  const rows=csv.trim().split(/\r?\n/).slice(1).map(row=>row.split(',').map(Number));
  expect(rows).toHaveLength(8);
  expect(rows.reduce((sum,row)=>sum+row[3],0)).toBe(120);
  expect(csv).not.toContain('sample-0');

  const jsonDownload=page.waitForEvent('download');
  await chart.getByRole('button',{name:'Chart JSON'}).click();
  const jsonFile=await jsonDownload;
  expect(jsonFile.suggestedFilename()).toBe('neuroforge-chart.json');
  const evidence=JSON.parse(await readFile(await jsonFile.path(),'utf8'));
  expect(evidence.kind).toBe('neuroforge-prism-chart');
  expect(evidence.chartType).toBe('histogram');
  expect(evidence.population.observedCount).toBe(120);
  expect(evidence.bins).toHaveLength(8);
  expect(evidence.scopeDigest).toMatch(/^[a-f0-9]{64}$/);
  expect(evidence).not.toHaveProperty('rows');
  expect(JSON.stringify(evidence)).not.toContain('sample-0');

  const pyDownload=page.waitForEvent('download');
  await chart.getByRole('button',{name:'Python script'}).click();
  const pyFile=await pyDownload;
  expect(pyFile.suggestedFilename()).toBe('neuroforge-chart.py');
  expect(await readFile(await pyFile.path(),'utf8')).toContain('ax.bar(');

  await lab.getByRole('slider',{name:'Histogram bins'}).press('End');
  await chart.getByRole('group',{name:'PRISM chart views'}).getByRole('button',{name:'Data'}).click();
  await expect(chart.getByRole('region',{name:'PRISM histogram data table'}).getByRole('row')).toHaveCount(18);
});

test('F16 PRISM: active F10 filters define one measured chart scope; categorical fallback remains',async({page})=>{
  const {lab,chart}=await openPrism(page);
  await lab.getByRole('combobox',{name:'Filter column'}).selectOption('label');
  await lab.getByRole('textbox',{name:'Filter value'}).fill('1');
  await lab.getByRole('button',{name:'Add filter'}).click();
  await expect(lab).toContainText('120 original / 60 analyzed');
  await expect(chart).toContainText('60 filtered rows');
  await expect(chart).toContainText('60 observed');
  const download=page.waitForEvent('download');
  await chart.getByRole('button',{name:'Chart JSON'}).click();
  const report=JSON.parse(await readFile(await (await download).path(),'utf8'));
  expect(report.population.sourceCount).toBe(120);
  expect(report.population.selectedCount).toBe(60);
  expect(report.bins.reduce((sum,bin)=>sum+bin.count,0)).toBe(60);
  await lab.getByRole('combobox',{name:'Distribution column'}).selectOption('label');
  await expect(chart).toBeVisible();
  await expect(chart).toContainText('60 filtered rows');
});

test('F16 PRISM: theme-aware responsive chart controls, zoom and numeric-missing handling',async({page})=>{
  await page.goto('/app/datasets');
  const csv='metric,category,label\n1,A,0\n2,B,1\n,B,0\n4,B,1\n5,A,0\n6,A,1\n7,A,0\n8,B,1\n9,A,0\n10,A,1\n';
  await page.getByLabel('CSV file').setInputFiles({
    name:'prism-numerical.csv',mimeType:'text/csv',buffer:Buffer.from(csv),
  });
  const lab=page.getByRole('region',{name:'Dataset profile dashboard'});
  await lab.getByRole('button',{name:'Distributions'}).click();
  const chart=lab.getByRole('region',{name:'PRISM scientific histogram'});
  await expect(chart).toContainText('10 filtered rows');
  await expect(chart).toContainText('9 observed');
  await expect(chart).toContainText('1 missing');
  await chart.getByRole('button',{name:'PRISM zoom in'}).click();
  await expect(chart).toContainText('125%');
  await chart.getByRole('button',{name:'PRISM reset zoom'}).click();
  await expect(chart).toContainText('100%');
  await expect(chart.getByRole('button',{name:'Expand PRISM chart'})).toBeVisible();
  await expect(chart.getByRole('button',{name:'Data CSV'})).toBeVisible();
  await expect(chart.getByRole('button',{name:'Python script'})).toBeVisible();
  await lab.getByRole('combobox',{name:'Distribution column'}).selectOption('category');
  await expect(chart).toHaveCount(0);
  await expect(lab.getByRole('region',{name:'Distribution values'})).toBeVisible();
});
