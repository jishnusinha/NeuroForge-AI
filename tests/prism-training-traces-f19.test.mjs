import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers/modelChartFixtures.mjs';
import {fitWorkbenchModel,predictWorkbenchModel} from '../client/src/ml/modelWorkbench/models.js';
import {createModelChartSpec} from '../client/src/visualization/modelChartSpec.js';
test('F19 genuine logistic/softmax traces leave fitted parameters and predictions bit-for-bit unchanged',async()=>{
  for(const algorithm of ['logistic','softmax']){const ctx=fixture('classification',algorithm,algorithm==='softmax'),points=[];
    const plain=fitWorkbenchModel(ctx.matrix,algorithm,{epochs:20}),traced=fitWorkbenchModel(ctx.matrix,algorithm,{epochs:20,onTrainingTrace:p=>points.push(p)});
    assert.deepEqual(plain,traced);assert.deepEqual(predictWorkbenchModel(plain,[[1,2]]),predictWorkbenchModel(traced,[[1,2]]));assert.equal(points.length,20);assert.ok(points.every((p,i)=>p.epoch===i+1&&Number.isFinite(p.loss)&&p.loss>=0));
    const train=ctx.matrix.rows.filter(r=>r.split==='train'),probabilities=predictWorkbenchModel(plain,train.map(r=>r.values));
    const crossEntropy=train.reduce((s,r,i)=>s-Math.log(Math.max(probabilities[i].probabilities[plain.classes.indexOf(r.target)],1e-15)),0)/train.length;
    const weights=algorithm==='logistic'?[plain.parameters.weights]:plain.parameters.weights;
    const expected=crossEntropy+plain.parameters.lambda/2*weights.flatMap(w=>w.slice(1)).reduce((s,w)=>s+w*w,0);
    assert.ok(Math.abs(points.at(-1).loss-expected)<1e-12);
    const spec=(await createModelChartSpec({...ctx,config:{type:'training_loss'}})).spec;assert.deepEqual(spec.evidence.rows.map(r=>r.y),points.map(p=>p.loss));
  }
});
test('F19 noniterative models never invent training traces',async()=>{
  for(const algorithm of ['baseline','knn','cart','forest','ridge']){const ctx=fixture(algorithm==='ridge'?'regression':'classification',algorithm);assert.equal(ctx.candidate.trainingTrace,null);assert.equal((await createModelChartSpec({...ctx,config:{type:'training_loss'}})).spec.evidence.status,'unavailable');}
});
