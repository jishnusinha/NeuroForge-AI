import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateWhatIf,localWhatIfSensitivity,nearestClassFlip} from '../client/src/ml/whatIf.js';

const logistic=(x,y)=>1/(1+Math.exp(-(2*x-y)));

test('F5 what-if uses real supplied model inference and computes correct probability deltas',()=>{
  const probe=evaluateWhatIf(logistic,0,1);
  assert.equal(probe.predictedClass,0);
  assert.ok(Math.abs(probe.predictedProbability-(1/(1+Math.exp(1))))<1e-12);
  const sensitivity=localWhatIfSensitivity(logistic,0,1,.5,.5);
  assert.ok(sensitivity.xPlusDelta>0);
  assert.ok(sensitivity.yPlusDelta<0);
  assert.equal(sensitivity.baseline.predictedClass,0);
});

test('F5 counterfactual search finds an actual class flip under bounded perturbations',()=>{
  const result=nearestClassFlip(logistic,{x:0,y:1},{stepX:.25,stepY:.25,radius:8});
  assert.equal(result.baseline.predictedClass,0);
  assert.ok(result.candidate);
  assert.equal(result.candidate.predictedClass,1);
  assert.equal(evaluateWhatIf(logistic,result.candidate.x,result.candidate.y).predictedClass,1);
  assert.ok(result.evaluated<=288);
  assert.ok(result.candidate.normalizedDistance>0);
});

test('F5 constraints and no-flip cases never invent counterfactual evidence',()=>{
  const constant=()=>.85;
  const none=nearestClassFlip(constant,{x:0,y:0},{stepX:.5,stepY:.5,radius:3});
  assert.equal(none.candidate,null);
  assert.equal(none.evaluated,48);
  const locked=nearestClassFlip(logistic,{x:0,y:1},{stepX:.25,stepY:.25,radius:4,lockX:true,lockY:true});
  assert.equal(locked.candidate,null);
  assert.equal(locked.evaluated,0);
  const bounded=nearestClassFlip(logistic,{x:0,y:1},{stepX:1,stepY:1,radius:4,xBounds:[0,0],yBounds:[1,1]});
  assert.equal(bounded.candidate,null);
  assert.equal(bounded.evaluated,0);
});

test('F5 invalid model probabilities and unbounded grids fail closed',()=>{
  assert.throws(()=>evaluateWhatIf(()=>NaN,0,1),/MODEL_INVALID/);
  assert.throws(()=>evaluateWhatIf(()=>1.5,0,1),/MODEL_INVALID/);
  assert.throws(()=>evaluateWhatIf(logistic,NaN,0),/INVALID_WHAT_IF/);
  assert.throws(()=>nearestClassFlip(logistic,{x:1,y:1},{stepX:0}),/INVALID_COUNTERFACTUAL/);
  assert.throws(()=>nearestClassFlip(logistic,{x:1,y:1},{radius:100}),/INVALID_COUNTERFACTUAL/);
});
