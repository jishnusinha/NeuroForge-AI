import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,envelope} from './helpers/modelChartFixtures.mjs';
import {createModelChartSpec} from '../client/src/visualization/modelChartSpec.js';
import {explainLocalPrediction} from '../client/src/ml/modelWorkbench/localExplanations.js';
import {partialDependence} from '../client/src/ml/modelWorkbench/partialDependence.js';
import {permutationImportance} from '../client/src/ml/modelWorkbench/permutationImportance.js';
import {subgroupDiagnostics} from '../client/src/ml/modelWorkbench/subgroupDiagnostics.js';
import {sourceWhatIf,sourceFeatureControls} from '../client/src/ml/modelWorkbench/whatIfDiagnostics.js';
import {portableChart} from '../client/src/visualization/chartExport.js';
import {generateJavaScript} from '../client/src/visualization/codegen/javascriptCodegen.js';
const chart=(ctx,type,result)=>createModelChartSpec({...ctx,config:{type},explanation:envelope(ctx.candidate,result)});
test('F19 local waterfalls exactly reconstruct ridge, logistic log-odds and softmax class logits',async()=>{
  for(const algorithm of ['ridge','logistic','softmax']){const ctx=fixture(algorithm==='ridge'?'regression':'classification',algorithm,algorithm==='softmax'),r=explainLocalPrediction(ctx.matrix,ctx.candidate.model,ctx.matrix.membership.validation[0]);
    const {spec}=await chart(ctx,'model_contributions',r);assert.ok(Math.abs(spec.evidence.rows.at(-1).end-r.total)<1e-10);assert.equal(spec.plot.yLabel,r.scale);assert.equal(spec.privacy.observationLevel,true);assert.ok(generateJavaScript(spec).includes('restoreModelRenderers'));
  }
});
test('F19 permutation SD remains signed repetition variability and PDP includes the exact recorded ICE',async()=>{
  const ctx=fixture(),r=permutationImportance(ctx.matrix,ctx.candidate.model),{spec}=await chart(ctx,'model_importance',r);
  assert.deepEqual(spec.evidence.rows.map(r=>r.sd),r.features.map(r=>r.standardDeviation));assert.ok(spec.method.notes.some(n=>n.includes('not a confidence interval')));
  const pdp=partialDependence(ctx.matrix,ctx.candidate.model,{feature:ctx.matrix.features[0]}),p=(await chart(ctx,'model_dependence',pdp)).spec;
  assert.deepEqual(p.evidence.rows.filter(r=>r.series==='PDP mean').map(r=>r.y),pdp.points.map(r=>r.meanPrediction));assert.equal(p.evidence.rows.length,pdp.points.length*(1+pdp.curves.length));assert.ok(!JSON.stringify(portableChart(p,{consent:true})).includes('private-f19-'));
});
test('F19 what-if and insufficient subgroup evidence preserve existing scales and support',async()=>{
  const ctx=fixture(),control=sourceFeatureControls(ctx.plan,ctx.matrix).find(c=>c.editable&&c.type==='numeric');
  const whatif=sourceWhatIf(ctx.matrix,ctx.candidate.model,ctx.plan,ctx.matrix.membership.validation[0],{[control.name]:control.max});assert.equal((await chart(ctx,'model_whatif',whatif)).spec.evidence.rows.length,4);
  const result=subgroupDiagnostics(ctx.matrix,ctx.candidate.model,{feature:ctx.matrix.features[0],minSupport:30});const {spec}=await chart(ctx,'model_subgroups',result);assert.ok(spec.evidence.rows.every(r=>r.y===null&&r.support<30));
});
test('F19 all seven model families have faithful local visuals without training identities',async()=>{
  for(const algorithm of ['baseline','ridge','logistic','softmax','cart','forest','knn']){const ctx=fixture(algorithm==='ridge'?'regression':'classification',algorithm),r=explainLocalPrediction(ctx.matrix,ctx.candidate.model,ctx.matrix.membership.validation[0]);
    const {spec}=await chart(ctx,r.scale?'model_contributions':'model_model_specific',r);assert.ok(spec.evidence.rows.length);assert.ok(!JSON.stringify(portableChart(spec,{consent:true})).includes('private-f19-'));assert.ok(!JSON.stringify(spec).includes('neighbors'));
  }
});
