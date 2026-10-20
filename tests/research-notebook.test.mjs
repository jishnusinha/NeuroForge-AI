import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRunComparison,notebookRunId} from '../client/src/ml/researchNotebook.js';

test('F6 run comparison ranks only recorded numeric validation metrics',()=>{
  const runs=[
    {_id:'b',name:'B',metrics:{valAccuracy:.8},dataset:{name:'Two Moons'}},
    {_id:'a',name:'A',metrics:{valAccuracy:0},dataset:{name:'Two Moons'}},
    {_id:'c',name:'C',metrics:{},dataset:{name:'Two Moons'}},
  ];
  const report=buildRunComparison(runs,'valAccuracy');
  assert.deepEqual(report.rows.map(row=>row.id),['b','a','c']);
  assert.equal(report.rows[1].metric,0);
  assert.equal(report.rows[2].metric,null);
  assert.equal(report.measured,2);
  assert.equal(report.mixedDatasets,false);
});

test('F6 comparisons flag dataset incompatibility and never invent missing loss',()=>{
  const runs=[
    {_id:'x',dataset:{name:'XOR'},metrics:{valLoss:.4}},
    {shareId:'y',dataset:{name:'Blobs'},metrics:{trainLoss:.1}},
  ];
  const report=buildRunComparison(runs,'valLoss');
  assert.equal(report.mixedDatasets,true);
  assert.equal(report.rows[0].id,'x');
  assert.equal(report.rows[1].metric,null);
  assert.equal(notebookRunId(runs[1]),'y');
  assert.throws(()=>buildRunComparison(runs,'pretendAccuracy'),/UNSUPPORTED_NOTEBOOK_METRIC/);
});

test('F6 lower-is-better loss metrics sort ascending and missing remains last',()=>{
  const runs=[
    {_id:'a',metrics:{valLoss:.6}},{_id:'b',metrics:{valLoss:.3}},{_id:'c',metrics:{}},
  ];
  assert.deepEqual(buildRunComparison(runs,'valLoss').rows.map(item=>item.id),['b','a','c']);
  assert.equal(buildRunComparison(runs,'valLoss').compared,3);
});
