import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateOptimizer,quadraticLoss} from '../client/src/ml/optimizerLandscape.js';

test('F8 stable SGD actually descends a quadratic to its known minimum',()=>{
 const run=simulateOptimizer({method:'sgd',learningRate:.1,steps:80});
 assert.equal(run.status,'completed');
 assert.equal(run.history.length,81);
 assert.ok(run.finalLoss<run.initialLoss);
 assert.ok(run.finalLoss<1e-4);
 assert.equal(quadraticLoss(0,0),0);
});

test('F8 SGD marks unstable learning rates as divergent instead of pretending convergence',()=>{
 const run=simulateOptimizer({method:'sgd',learningRate:1,steps:100});
 assert.equal(run.status,'diverged');
 assert.ok(run.completedSteps<100);
 assert.ok(run.finalLoss>run.initialLoss);
});

test('F8 Adam and momentum have deterministic finite bounded trajectories',()=>{
 for(const method of ['momentum','adam']){
  const first=simulateOptimizer({method,learningRate:.05,steps:50});
  const second=simulateOptimizer({method,learningRate:.05,steps:50});
  assert.deepEqual(first,second);
  assert.equal(first.status,'completed');
  assert.ok(first.history.every(row=>Number.isFinite(row.loss)&&row.loss>=0));
  assert.ok(first.finalLoss<first.initialLoss);
 }
});

test('F8 malformed optimizer specifications are rejected rather than simulated',()=>{
 assert.throws(()=>simulateOptimizer({method:'imaginary'}),/INVALID_OPTIMIZER/);
 assert.throws(()=>simulateOptimizer({learningRate:0}),/INVALID_OPTIMIZER_SETTINGS/);
 assert.throws(()=>simulateOptimizer({steps:10000}),/INVALID_OPTIMIZER_SETTINGS/);
 assert.throws(()=>simulateOptimizer({startX:1e90}),/INVALID_OPTIMIZER_SETTINGS/);
});
