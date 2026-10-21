import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,envelope} from './helpers/modelChartFixtures.mjs';
import {createModelChartSpec} from '../client/src/visualization/modelChartSpec.js';
import {portableChart,chartCsv} from '../client/src/visualization/chartExport.js';
import {evaluateWorkbenchPredictions} from '../client/src/ml/modelWorkbench/metrics.js';
import {predictWorkbenchModel} from '../client/src/ml/modelWorkbench/models.js';
import {explainLocalPrediction} from '../client/src/ml/modelWorkbench/localExplanations.js';
test('F19 cannot access final reports without matching explicit access record; validation chart never reads test values',async()=>{
  const ctx=fixture();
  for(const r of ctx.matrix.rows.filter(r=>r.split==='test'))Object.defineProperty(r,'target',{get(){throw new Error('TEST_TARGET_READ');}});
  const result=await createModelChartSpec({...ctx,config:{type:'confusion'}});assert.equal(result.spec.modelContext.split,'validation');
  const other=fixture(),report=evaluateWorkbenchPredictions(other.matrix,predictWorkbenchModel(other.candidate.model,other.matrix.rows.filter(r=>r.split==='test').map(r=>r.values)),'test');
  await assert.rejects(createModelChartSpec({...other,report,config:{type:'confusion'}}),/FINAL_TEST_SEALED/);
  const finalTest={candidateId:other.candidate.id,report,accessedAt:new Date().toISOString()};
  const final=await createModelChartSpec({...other,report,finalTest,config:{type:'confusion'}});assert.equal(final.spec.source.population,'model_test');
});
test('F19 rejects report replacement, altered membership, metric mismatch, and stale explanation identity',async()=>{
  const ctx=fixture(),config={type:'confusion'};
  await assert.rejects(createModelChartSpec({...ctx,config,report:structuredClone(ctx.candidate.validation)}),/RECORDED_REPORT/);
  const e=envelope(ctx.candidate,explainLocalPrediction(ctx.matrix,ctx.candidate.model,ctx.matrix.membership.validation[0]));e.candidateId='stale';
  await assert.rejects(createModelChartSpec({...ctx,config:{type:'model_contributions'},explanation:e}),/EXPLANATION_CONTEXT/);
  ctx.candidate.validation.metrics.accuracy=123;await assert.rejects(createModelChartSpec({...ctx,config}),/REPORT_EVIDENCE/);
});
test('F19 detects overlapping memberships and rejects configuration payloads outside the model controls',async()=>{
  const ctx=fixture();await assert.rejects(createModelChartSpec({...ctx,config:{type:'confusion',rowIds:['secret']}}),/INVALID_CONFIGURATION/);
  ctx.matrix.membership.validation[0]=ctx.matrix.membership.test[0];await assert.rejects(createModelChartSpec({...ctx,config:{type:'confusion'}}),/MEMBERSHIP_MISMATCH/);
});
test('F19 portable exports withhold row-level statistics and all private row identities',async()=>{
  const ctx=fixture('regression'),local=explainLocalPrediction(ctx.matrix,ctx.candidate.model,ctx.matrix.membership.validation[0]);
  const {spec}=await createModelChartSpec({...ctx,config:{type:'model_contributions'},explanation:envelope(ctx.candidate,local)});
  const meta=portableChart(spec);assert.deepEqual(meta.evidence.stats,{withheld:true});assert.deepEqual(meta.evidence.rows,[]);assert.ok(!meta.renderOption);assert.throws(()=>chartCsv(spec),/CONSENT/);
  assert.equal(meta.plot.yLabel,'Observation evidence withheld');
  for(const consent of [true,false])assert.ok(!JSON.stringify(portableChart(spec,{consent})).includes('private-f19-'));
});
