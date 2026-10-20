import test from 'node:test';
import assert from 'node:assert/strict';
import { applyEdaFilters, validateEdaFilters, sortEdaRows } from '../client/src/ml/edaFilters.js';
import { missingnessEvidence } from '../client/src/ml/edaMissingness.js';
import { spearmanPairwise, correlationEvidence, distributionEvidence } from '../client/src/ml/edaStatistics.js';
import { qualityEvidence } from '../client/src/ml/edaQuality.js';
import { buildEdaReport, edaReportMarkdown } from '../client/src/ml/edaEvidence.js';

const dataset = {
  headers: ['x','y','group','note'],
  rows: [
    {id:'a',x:1,y:2,group:'A',note:'ok'},
    {id:'b',x:2,y:4,group:'A',note:'ok'},
    {id:'c',x:3,y:6,group:'B',note:null},
    {id:'d',x:4,y:8,group:'B',note:'flag'},
    {id:'e',x:5,y:10,group:'B',note:'ok'},
    {id:'f',x:null,y:12,group:'A',note:'ok'},
    {id:'g',x:1,y:2,group:'A',note:'ok'},
  ],
};

test('F10 filter engine composes conditions without editing source rows or identifiers',()=>{
  const before=structuredClone(dataset);
  const filters=validateEdaFilters([{id:'1',column:'group',operator:'equals',value:'B'},
    {id:'2',column:'x',operator:'gte',value:'4'}],dataset.headers);
  const result=applyEdaFilters(dataset,filters);
  assert.deepEqual(result.rows.map(row=>row.id),['d','e']);
  assert.equal(result.sourceCount,7);
  assert.equal(result.excludedCount,5);
  assert.deepEqual(dataset,before);
  assert.deepEqual(applyEdaFilters(dataset,[{column:'note',operator:'missing'}]).rows.map(row=>row.id),['c']);
  assert.deepEqual(applyEdaFilters(dataset,[{column:'x',operator:'between',value:2,valueTo:4}]).rows.map(row=>row.id),['b','c','d']);
  assert.deepEqual(applyEdaFilters(dataset,[{column:'note',operator:'contains',value:'FLA'}]).rows.map(row=>row.id),['d']);
  assert.deepEqual(sortEdaRows(dataset.rows,'x','desc').map(row=>row.id),['e','d','c','b','a','g','f']);
});

test('F10 invalid filters fail explicitly instead of silently dropping conditions',()=>{
  assert.throws(()=>applyEdaFilters(dataset,[{column:'not-a-column',operator:'equals',value:'A'}]),/EDA_INVALID_FILTER/);
  assert.throws(()=>applyEdaFilters(dataset,[{column:'x',operator:'between',value:10,valueTo:5}]),/EDA_INVALID_FILTER_VALUE/);
  assert.throws(()=>applyEdaFilters(dataset,[{column:'x',operator:'gte',value:'NaN'}]),/EDA_INVALID_FILTER_VALUE/);
});

test('F10 missingness uses exact counts and bounds its visualization',()=>{
  const e=missingnessEvidence(dataset, dataset.headers, 3);
  assert.equal(e.incomplete,2);
  assert.equal(e.complete,5);
  assert.equal(e.columns.find(x=>x.column==='x').missing,1);
  assert.equal(e.columns.find(x=>x.column==='note').missing,1);
  assert.equal(e.coMissing[0][3],0);
  assert.ok(e.displayRows.length<=3);
  assert.equal(missingnessEvidence({...dataset,rows:[]}).complete,0);
});

test('F10 Spearman averages tied ranks, ignores incomplete pairs and preserves unavailable evidence',()=>{
  const e=spearmanPairwise(dataset.rows,'x','y');
  assert.equal(e.count,6);
  assert.equal(e.r,1);
  const increasing=spearmanPairwise([{a:1,b:10},{a:2,b:20},{a:3,b:30}],'a','b');
  assert.equal(increasing.r,1);
  const degenerate=spearmanPairwise([{a:1,b:10},{a:1,b:20},{a:1,b:30}],'a','b');
  assert.equal(degenerate.r,null);
  const matrix=correlationEvidence(dataset,['x','y'],'spearman');
  assert.equal(matrix.matrix[0][1].count,6);
  assert.throws(()=>correlationEvidence(dataset,['x','y'],'magical'),/EDA_UNKNOWN/);
});

test('F10 distributions sum to the observed population, not the plotted sample',()=>{
  const numeric=distributionEvidence(dataset.rows,'x','numeric',4);
  assert.equal(numeric.bins.reduce((sum,b)=>sum+b.count,0),6);
  assert.equal(numeric.missing,1);
  const categorical=distributionEvidence(dataset.rows,'group','categorical');
  assert.equal(categorical.categories.reduce((sum,b)=>sum+b.count,0),7);
});

test('F10 quality review identifies actual duplicate records without changing them',()=>{
  const before=structuredClone(dataset);
  const result=qualityEvidence(dataset);
  const duplicates=result.findings.find(item=>item.id==='exact-duplicates');
  assert.equal(duplicates.count,1);
  assert.deepEqual(duplicates.rowIds,['g']);
  const missing=result.findings.find(item=>item.id==='missing:x');
  assert.deepEqual(missing.rowIds,['f']);
  assert.deepEqual(dataset,before);
});

test('F10 evidence export includes fingerprint, filters and measured scope without raw rows', async()=>{
  const report=await buildEdaReport(dataset,[{id:'g',column:'group',operator:'equals',value:'B'}],'Not causal.','Example');
  assert.match(report.datasetDigest,/^[a-f0-9]{64}$/);
  assert.equal(report.sourceCount,7);
  assert.equal(report.selectedCount,3);
  assert.equal(report.observations,'Not causal.');
  assert.equal(JSON.stringify(report).includes('\"rows\"'),false);
  const again=await buildEdaReport(dataset,[],'','Example');
  assert.equal(again.datasetDigest,report.datasetDigest);
  assert.match(edaReportMarkdown(report),/Raw observations were not exported/);
});
