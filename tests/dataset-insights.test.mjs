import test from 'node:test';
import assert from 'node:assert/strict';
import { eligibleGroupColumns, scatterEvidence, classBalance, tukeyOutliers, qualitySignals } from '../client/src/ml/datasetInsights.js';
import { profileDataset } from '../client/src/ml/datasetProfiling.js';

const records=[
  {id:'r1',x:1,y:2,label:0,group:'A'},
  {id:'r2',x:2,y:4,label:0,group:'A'},
  {id:'r3',x:3,y:6,label:0,group:'A'},
  {id:'r4',x:4,y:8,label:0,group:'A'},
  {id:'r5',x:5,y:10,label:0,group:'A'},
  {id:'r6',x:6,y:12,label:0,group:'A'},
  {id:'r7',x:7,y:14,label:1,group:'B'},
  {id:'r8',x:80,y:160,label:1,group:'B'},
];

test('F2 relationship scatter excludes incomplete pairs and retains real group labels',()=>{
  const rows=[...records,{id:'missing-x',x:null,y:5,label:1,group:'B'}];
  const evidence=scatterEvidence(rows,'x','y','group',3);
  assert.equal(evidence.count,8);assert.equal(evidence.excluded,1);
  assert.ok(evidence.sampled<=3);assert.deepEqual(evidence.groups,['A','B']);
  assert.equal(evidence.xDomain.max,80);
  assert.equal(evidence.points[0].id,'r1');
  assert.equal(evidence.points[0].group,'A');
  assert.equal(rows[8].x,null);
});

test('F2 relationships support constant and entirely absent paired axes',()=>{
  const constant=scatterEvidence([{id:'a',x:5,y:5},{id:'b',x:5,y:5}],'x','y');
  assert.deepEqual(constant.xDomain,{min:4.5,max:5.5});
  const empty=scatterEvidence([{x:1,y:null}],'x','y');
  assert.equal(empty.count,0);assert.equal(empty.excluded,1);
  assert.deepEqual(empty.points,[]);
});

test('F2 class imbalance counts only observed categories, retains a single-class warning',()=>{
  const result=classBalance([...records,{id:'blank',group:null}],'group');
  assert.equal(result.observed,8);assert.equal(result.missing,1);
  assert.equal(result.ratio,3);assert.equal(result.status,'imbalanced');
  assert.deepEqual(result.categories,[{label:'A',count:6,percentage:75},{label:'B',count:2,percentage:25}]);
  assert.equal(classBalance([{label:0},{label:0}],'label').status,'single_class');
  assert.equal(classBalance([{label:null}],'label').available,false);
});

test('F2 IQR flags only values outside real fences and reports degenerate evidence',()=>{
  const result=tukeyOutliers(records,'x');
  assert.equal(result.count,1);assert.equal(result.examples[0].id,'r8');
  assert.equal(result.examples[0].value,80);assert.equal(result.observed,8);
  assert.equal(result.examples[0].rowNumber,8);
  assert.equal(tukeyOutliers([{x:2},{x:2},{x:2},{x:2}],'x').available,false);
  assert.match(tukeyOutliers([{x:1},{x:2},{x:3}],'x').reason,/four/);
});

test('F2 quality flags missingness/duplicates and class selector excludes high cardinality',()=>{
  const parsed={headers:['x','label','const'],rows:[
    {x:1,label:'A',const:2},{x:2,label:'B',const:2},
    {x:2,label:'B',const:2},{x:null,label:null,const:2},
  ]};
  const report=profileDataset(parsed),signals=qualitySignals(report);
  assert.deepEqual(signals.map(s=>s.id),['duplicates','missing','constant','sparse']);
  assert.deepEqual(eligibleGroupColumns(report),['x','label']);
  assert.equal(report.duplicateRows,1);
  assert.equal(report.missingCells,2);
});
