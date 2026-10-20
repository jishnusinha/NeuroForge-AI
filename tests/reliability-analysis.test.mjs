import test from 'node:test';
import assert from 'node:assert/strict';
import {calibrationEvidence,subgroupEvidence,featureShiftEvidence} from '../client/src/ml/reliabilityAnalysis.js';

test('F9 calibration and Brier score use actual observed labels and probabilities',()=>{
 const rows=[{probability:0,label:0},{probability:.25,label:0},{probability:.75,label:1},{probability:1,label:1}];
 const result=calibrationEvidence(rows,4);
 assert.equal(result.count,4);
 assert.equal(result.brier,(.25**2+.25**2)/4);
 assert.ok(result.expectedCalibrationError>=0);
 assert.equal(result.bins.reduce((s,b)=>s+b.count,0),4);
 assert.equal(result.bins.at(-1).count,2);
});

test('F9 calibration missing bins are N/A not zero and invalid evidence is excluded',()=>{
 const result=calibrationEvidence([{probability:.1,label:0},{probability:NaN,label:1},{probability:.5,label:null}]);
 assert.equal(result.count,1);
 assert.equal(result.bins.filter(b=>b.meanProbability===null).length,4);
 assert.equal(calibrationEvidence([]).expectedCalibrationError,null);
 assert.throws(()=>calibrationEvidence([],11),/INVALID_CALIBRATION/);
});

test('F9 subgroup evaluation respects only measured features and binary labels',()=>{
 const rows=[{x:-2,y:0,label:0,probability:.1},{x:-1,y:0,label:1,probability:.8},{x:1,y:0,label:1,probability:.2}];
 const groups=subgroupEvidence(rows,'x',0,.5);
 assert.deepEqual(groups.map(g=>g.count),[2,1]);
 assert.deepEqual(groups.map(g=>g.accuracy),[1,0]);
 assert.deepEqual(groups.map(g=>g.positives),[1,1]);
 assert.throws(()=>subgroupEvidence(rows,'unapproved'),/INVALID_SUBGROUP/);
});

test('F9 synthetic feature shifts actually rerun predictions and cannot change source data',()=>{
 const classifier=(x)=>1/(1+Math.exp(-x));
 const original=[{x:-1,y:0,label:0,probability:classifier(-1)},
   {x:1,y:0,label:1,probability:classifier(1)}];
 const copy=structuredClone(original);
 const baseline=featureShiftEvidence(original,classifier,{deltaX:0});
 assert.equal(baseline.flipRate,0);
 const shifted=featureShiftEvidence(original,classifier,{deltaX:2});
 assert.equal(shifted.count,2);
 assert.equal(shifted.flipRate,.5);
 assert.ok(shifted.meanProbabilityDelta>0);
 assert.deepEqual(original,copy);
 assert.throws(()=>featureShiftEvidence(original,()=>NaN,{deltaX:1}),/INVALID_MODEL_SHIFT/);
});
