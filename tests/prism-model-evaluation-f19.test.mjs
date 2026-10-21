import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,probabilityFixture} from './helpers/modelChartFixtures.mjs';
import {createModelChartSpec} from '../client/src/visualization/modelChartSpec.js';
import {probabilityDiagnostics} from '../client/src/visualization/adapters/modelEvaluationAdapter.js';
import {chartOptions} from '../client/src/visualization/chartOptions.js';
import {evaluateWorkbenchPredictions} from '../client/src/ml/modelWorkbench/metrics.js';
const chart=(ctx,type,config={})=>createModelChartSpec({...ctx,config:{type,...config}});
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-12,`${a} != ${b}`);
test('F19 regression plots reuse exact recorded targets, residual signs, identity and measured metrics',async()=>{
  const ctx=fixture('regression'),before=structuredClone(ctx);
  for(const type of ['actual_predicted','residuals','residual_distribution','error_range']){const {spec}=await chart(ctx,type);assert.deepEqual(spec.evidence.stats,{...ctx.candidate.validation.metrics,count:ctx.candidate.validation.count});assert.ok(chartOptions(spec).series.length);}
  const r=await chart(ctx,'residuals');assert.deepEqual(r.spec.evidence.rows.map(r=>r.y),ctx.candidate.validation.evidence.map(r=>r.target-r.predicted));
  const h=await chart(ctx,'residual_distribution');assert.equal(h.spec.evidence.rows.reduce((s,r)=>s+r.count,0),ctx.candidate.validation.count);assert.deepEqual(ctx,before);
});
test('F19 confusion counts and class metrics exactly match binary and multiclass F12 reports',async()=>{
  for(const multi of [false,true]){const ctx=fixture('classification',multi?'softmax':'logistic',multi),report=ctx.candidate.validation;
    const {spec}=await chart(ctx,'confusion');assert.deepEqual(spec.evidence.rows.map(r=>r.count),report.confusion.flat());assert.equal(chartOptions(spec).visualMap.max,Math.max(1,...report.confusion.flat()));
    assert.equal(chartOptions(spec).yAxis.inverse,true);
    const normalized=(await chart(ctx,'confusion',{rowNormalized:true})).spec;assert.equal(chartOptions(normalized).visualMap.max,1);
    const per=(await chart(ctx,'per_class')).spec;assert.deepEqual(per.evidence.rows.map(r=>r.y),report.perClass.flatMap(r=>[r.precision,r.recall,r.f1]));
  }
});
test('F19 ROC, PR, Brier and ECE agree with independent four-observation fixture',async()=>{
  const ctx=probabilityFixture(),d=probabilityDiagnostics(ctx.candidate.validation,[0,1],1);
  close(d.auc,.75);close(d.averagePrecision,5/6);close(d.brier,.158125);close(d.ece,.3375);close(d.prevalence,.5);
  assert.deepEqual(d.curve.map(r=>[r.fpr,r.recall]),[[0,0],[0,.5],[.5,.5],[.5,1],[1,1]]);
  for(const type of ['roc','precision_recall','calibration','confidence']){const {spec}=await chart(ctx,type,{classIndex:1});assert.ok(spec.evidence.rows.length);assert.equal(spec.privacy.observationLevel,false);}
  const confidence=(await chart(ctx,'confidence')).spec;assert.equal(confidence.evidence.rows.reduce((n,r)=>n+r.count,0),4);assert.equal(chartOptions(confidence).xAxis.type,'category');
});
test('F19 tied thresholds enter together; single-outcome and empty probability evidence stay unavailable',async()=>{
  const ctx=probabilityFixture([0,1,0,1],[.5,.5,.5,.5]),d=probabilityDiagnostics(ctx.candidate.validation,[0,1]);
  assert.equal(d.curve.length,2);close(d.auc,.5);close(d.averagePrecision,.5);
  const single=probabilityFixture([0,0,0,0],[.1,.1,.1,.1]);assert.equal((await chart(single,'roc')).spec.evidence.status,'unavailable');assert.equal((await chart(single,'precision_recall')).spec.evidence.status,'unavailable');
  assert.equal((await chart(single,'calibration')).spec.evidence.rows.filter(r=>r.support===0).length,9);
  single.candidate.validation.evidence.forEach(r=>r.probabilities=null);assert.equal((await chart(single,'confidence')).spec.evidence.status,'unavailable');
});
test('F19 class ordering, normalization and task compatibility fail closed',async()=>{
  const ctx=probabilityFixture();await assert.rejects(chart(ctx,'roc',{classIndex:3}),/UNKNOWN_CLASS/);await assert.rejects(chart(ctx,'residuals'),/INCOMPATIBLE_TASK/);
  ctx.candidate.validation.evidence[0].probabilities=[.2,.2];await assert.rejects(chart(ctx,'confusion'),/PROBABILITY/);
});
test('F19 mixed primitive class labels remain distinct in heatmaps and zero-support rows stay unavailable',async()=>{
  const ctx=probabilityFixture();ctx.matrix.rows.forEach(r=>r.target=r.target===0?1:'1');ctx.matrix.task.classes=[1,'1'];ctx.candidate.model.classes=[1,'1'];
  ctx.candidate.validation=evaluateWorkbenchPredictions(ctx.matrix,[.1,.4,.35,.8].map(p=>({predicted:p>.5?'1':1,probabilities:[1-p,p]})));
  const result=await chart(ctx,'confusion');assert.equal(new Set(result.spec.evidence.rows.map(r=>r.x)).size,2);assert.equal(chartOptions(result.spec).xAxis.data.length,2);
  const zero=probabilityFixture([0,0,0,0],[.1,.1,.1,.1]),normalized=await chart(zero,'confusion',{rowNormalized:true});assert.ok(normalized.spec.evidence.rows.filter(r=>r.y==='1').every(r=>r.value===null));
});
