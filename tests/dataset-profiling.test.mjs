import test from 'node:test';
import assert from 'node:assert/strict';
import { histogram, pearsonPairwise, profileDataset, quantile } from '../client/src/ml/datasetProfiling.js';

test('F2 profiles mixed types, missing values, quantiles and exact duplicates', () => {
  const data = {headers:['age','income','group'], rows:[
    {age:10,income:20,group:'A'}, {age:20,income:40,group:'B'},
    {age:30,income:null,group:'A'}, {age:40,income:80,group:null},
    {age:40,income:80,group:null},
  ]};
  const result=profileDataset(data);
  assert.equal(result.rowCount,5); assert.equal(result.columnCount,3);
  assert.equal(result.missingCells,3); assert.equal(result.duplicateRows,1);
  assert.deepEqual(result.columns.map(c=>c.type),['numeric','numeric','categorical']);
  assert.equal(result.columns[0].median,30);
  assert.equal(result.columns[0].mean,28);
  assert.equal(result.columns[1].missing,1);
  assert.equal(result.columns[1].median,60);
  assert.deepEqual(result.columns[2].categories,[{label:'A',count:2},{label:'B',count:1}]);
});

test('F2 histogram conserves observed rows and puts maximum in last bin',()=>{
  const bins=histogram([0,1,2,3,4,5,6,7,8]);
  assert.equal(bins.length,8);
  assert.equal(bins.reduce((sum,bin)=>sum+bin.count,0),9);
  assert.equal(bins.at(-1).to,8);
  assert.deepEqual(histogram([3,3,3]),[{from:3,to:3,count:3}]);
  assert.deepEqual(histogram([null,NaN]),[]);
  assert.equal(quantile([2,4,6,8],.5),5);
  assert.equal(quantile([],.5),null);
});

test('F2 pairwise-complete correlation never imputes or invents constant-feature coefficients',()=>{
  const rows=[
    {a:1,b:2,c:4},{a:2,b:4,c:4},{a:3,b:6,c:4},
    {a:4,b:null,c:4},{a:5,b:10,c:4},
  ];
  const pair=pearsonPairwise(rows,'a','b');
  assert.equal(pair.count,4);
  assert.ok(Math.abs(pair.r-1)<1e-12);
  assert.deepEqual(pearsonPairwise(rows,'a','c'),{r:null,count:5});
  assert.deepEqual(pearsonPairwise([{a:1,b:2},{a:2,b:3}],'a','b'),{r:null,count:2});
});

test('F2 numeric profiling preserves all-missing and sparse categories without synthetic data',()=>{
  const parsed={headers:['kind','empty'],rows:[
    {kind:'x',empty:null},{kind:'x',empty:null},{kind:'y',empty:null},{kind:'z',empty:null},
  ]};
  const data=profileDataset(parsed);
  assert.equal(data.columns[1].type,'categorical');
  assert.equal(data.columns[1].missing,4);
  assert.equal(data.columns[1].mean,null);
  assert.equal(data.numericNames.length,0);
  assert.equal(data.correlations.length,0);
  assert.deepEqual(data.columns[0].categories,[{label:'x',count:2},{label:'y',count:1},{label:'z',count:1}]);
});
