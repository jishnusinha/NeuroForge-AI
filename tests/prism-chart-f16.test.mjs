import test from 'node:test';
import assert from 'node:assert/strict';
import { distributionEvidence } from '../client/src/ml/edaStatistics.js';
import { applyEdaFilters } from '../client/src/ml/edaFilters.js';
import { createHistogramChartSpec, createChartEvidenceBundle,
  validatePrismChartSpec } from '../client/src/visualization/chartSpec.js';
import { histogramChartCsv, histogramChartJson,
  generateHistogramPython } from '../client/src/visualization/pythonCodegen.js';

const source={
  headers:['feature','segment','comment'],
  rows:[
    {id:'src-0',feature:1,segment:'A',comment:'ok'},
    {id:'src-1',feature:2,segment:'A',comment:'safe'},
    {id:'src-2',feature:3,segment:'B',comment:'note'},
    {id:'src-3',feature:4,segment:'B',comment:'note'},
    {id:'src-4',feature:null,segment:'B',comment:'missing'},
    {id:'src-5',feature:5,segment:'A',comment:'ok'},
    {id:'src-6',feature:6,segment:'A',comment:'ok'},
    {id:'src-7',feature:7,segment:'B',comment:'ok'},
  ],
};

test('PRISM F16 chart spec reuses exact F10 histogram evidence without mutating original observations',()=>{
  const before=structuredClone(source);
  const chart=createHistogramChartSpec({dataset:source,column:'feature',binCount:4,sourceName:'Baseline'});
  const evidence=distributionEvidence(source.rows,'feature','numeric',4);
  assert.equal(chart.kind,'neuroforge-prism-chart');
  assert.equal(chart.schemaVersion,1);
  assert.equal(chart.chartType,'histogram');
  assert.equal(chart.method,'equal-width-observed');
  assert.equal(chart.population.sourceCount,8);
  assert.equal(chart.population.selectedCount,8);
  assert.equal(chart.population.observedCount,7);
  assert.equal(chart.population.missingCount,1);
  assert.deepEqual(chart.bins.map(({from,to,count})=>({from,to,count})),evidence.bins);
  assert.equal(chart.bins.reduce((sum,bin)=>sum+bin.count,0),7);
  assert.deepEqual(source,before);
  assert.ok(!JSON.stringify(chart).includes('"src-0"'));
  assert.ok(!JSON.stringify(chart).includes('"rows"'));
  validatePrismChartSpec(chart);
});

test('PRISM F16 filters produce an exact changed chart population and bin counts',()=>{
  const filtered=applyEdaFilters(source,[{column:'segment',operator:'equals',value:'B'}]);
  const scope={headers:source.headers,rows:filtered.rows};
  const spec=createHistogramChartSpec({dataset:scope,column:'feature',sourceCount:8,binCount:8});
  assert.equal(spec.population.sourceCount,8);
  assert.equal(spec.population.selectedCount,4);
  assert.equal(spec.population.observedCount,3);
  assert.equal(spec.population.missingCount,1);
  assert.equal(spec.bins.reduce((sum,bin)=>sum+bin.count,0),3);
  assert.deepEqual(source.rows.map(row=>row.segment),['A','A','B','B','B','A','A','B']);
});

test('PRISM F16 CSV and Python source encode measured bins, never source row observations',()=>{
  const spec=createHistogramChartSpec({dataset:source,column:'feature',binCount:8});
  const csv=histogramChartCsv(spec);
  const lines=csv.trim().split('\r\n');
  assert.equal(lines[0],'bin,from,to,count');
  const exported=lines.slice(1).map(line=>{
    const [index,from,to,count]=line.split(',').map(Number);
    return {index,from,to,count};
  });
  assert.deepEqual(exported,spec.bins);
  assert.equal(exported.reduce((n,item)=>n+item.count,0),7);
  const code=generateHistogramPython(spec);
  assert.match(code,/import matplotlib\.pyplot as plt/);
  assert.match(code,/import seaborn as sns/);
  assert.match(code,/pd\.read_csv\("neuroforge-chart-data\.csv"\)/);
  assert.match(code,/spec\["population"\]\["observedCount"\]/);
  assert.match(code,/align="edge"/);
  assert.ok(!code.includes('src-0'));
  const json=JSON.parse(histogramChartJson(spec));
  assert.deepEqual(json,spec);
});

test('PRISM F16 chart JSON exports scoped SHA-256 provenance, without original rows or IDs',async()=>{
  const spec=createHistogramChartSpec({dataset:source,column:'feature',binCount:4});
  const stamped=await createChartEvidenceBundle(spec,source);
  const again=await createChartEvidenceBundle(spec,source);
  assert.match(stamped.scopeDigest,/^[0-9a-f]{64}$/);
  assert.equal(stamped.scopeDigest,again.scopeDigest);
  assert.equal(stamped.scope,'current-filtered-dataset');
  assert.deepEqual(stamped.bins,spec.bins);
  assert.ok(!histogramChartJson(stamped).includes('src-0'));
  assert.ok(!histogramChartJson(stamped).includes('"rows"'));
  const altered={...source,rows:source.rows.map((r,i)=>i===0?{...r,comment:'DIFFERENT'}:r)};
  const different=await createChartEvidenceBundle(spec,altered);
  assert.notEqual(stamped.scopeDigest,different.scopeDigest);
  const fake={...spec,bins:spec.bins.map((bin,i)=>i===0?{...bin,count:bin.count+1}:bin)};
  await assert.rejects(createChartEvidenceBundle(fake,source),/PRISM_INVALID_CHART_SPEC|PRISM_CHART_SCOPE_MISMATCH/);
});

test('PRISM F16 constant numeric and no-observation columns are honestly represented',()=>{
  const constant={headers:['x'],rows:[{id:'a',x:7},{id:'b',x:7},{id:'c',x:7},{id:'d',x:null}]};
  const spec=createHistogramChartSpec({dataset:constant,column:'x',binCount:10});
  assert.deepEqual(spec.bins,[{index:1,from:7,to:7,count:3}]);
  assert.match(generateHistogramPython(spec),/Constant columns use a visible one-unit bar/);
  assert.equal(spec.population.missingCount,1);
  const empty={headers:['x'],rows:[{id:'a',x:null},{id:'b',x:null}]};
  const none=createHistogramChartSpec({dataset:empty,column:'x'});
  assert.equal(none.bins.length,0);
  assert.equal(none.population.observedCount,0);
  validatePrismChartSpec(none);
});

test('PRISM F16 validates numeric bounds, counts, selected scope and source capacity',async()=>{
  const spec=createHistogramChartSpec({dataset:source,column:'feature'});
  assert.throws(()=>createHistogramChartSpec({dataset:source,column:'missing'}),/PRISM_INVALID_HISTOGRAM_SOURCE/);
  assert.throws(()=>createHistogramChartSpec({dataset:source,column:'feature',binCount:100}),/PRISM_INVALID_HISTOGRAM_SOURCE/);
  assert.throws(()=>createHistogramChartSpec({dataset:source,column:'feature',sourceCount:3}),/PRISM_INVALID_HISTOGRAM_SOURCE/);
  assert.throws(()=>validatePrismChartSpec({...spec,population:{...spec.population,observedCount:999}}),/PRISM_INVALID_CHART_SPEC/);
  await assert.rejects(createChartEvidenceBundle(spec,{headers:source.headers,rows:source.rows.slice(0,3)}),
    /PRISM_CHART_SCOPE_MISMATCH/);
});

test('PRISM F16 generated Python never executes source column text as code',()=>{
  const hostile='field\"); __import__(\'os\').system(\'echo unsafe\'); #';
  const dataset={headers:[hostile],rows:[{id:'s1',[hostile]:1},{id:'s2',[hostile]:2}]};
  const spec=createHistogramChartSpec({dataset,column:hostile,binCount:4});
  const code=generateHistogramPython(spec);
  assert.equal(code.includes('echo unsafe'),false);
  assert.ok(histogramChartJson(spec).includes('echo unsafe'));
  assert.match(code,/ax\.set_xlabel\(spec\["column"\]\)/);
});
