import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildTFModel, trainTFModel, extractModelWeights, inspectForwardPass, predictGridSurface } from '../client/src/ml/tfModelEngine.js';
import { generateXOR, trainTestSplit } from '../client/src/ml/datasets.js';
const require = createRequire(new URL('../client/package.json',import.meta.url));
const tf = require('@tensorflow/tfjs');
const layers = [{type:'Input',units:2,activation:'Linear'},{type:'Dense',units:4,activation:'ReLU'},{type:'Output',units:1,activation:'Sigmoid'}];
test('seeded training records real validation metrics, supports cancellation and releases tensors', async () => {
  await tf.setBackend('cpu');
  const baseline = tf.memory().numTensors;
  const a = buildTFModel(layers,.04), b = buildTFModel(layers,.04);
  try {
    await assert.rejects(trainTFModel(a,[{x:0,y:0,label:0},{x:1,y:1,label:0}]), /both training classes/);
    assert.deepEqual(extractModelWeights(a),extractModelWeights(b));
    const original = extractModelWeights(a);
    inspectForwardPass(a,[.8,.8]); inspectForwardPass(a,[-.8,.8]);
    assert.deepEqual(extractModelWeights(a),original);
    const data = trainTestSplit(generateXOR(40,.05));
    const logs = [];
    const checkpoints = await trainTFModel(a,data.train,data.test,3,8,(epoch,row) => logs.push({epoch,...row}));
    assert.equal(logs.length,3); assert.ok(Number.isFinite(logs.at(-1).valAccuracy));
    assert.equal(checkpoints.at(-1).epoch,3);
    await trainTFModel(b,data.train,data.test,3,8);
    assert.deepEqual(extractModelWeights(a),extractModelWeights(b));
    const stop = {current:false}; const seen=[];
    await trainTFModel(a,data.train,data.test,20,8,(epoch) => {seen.push(epoch);stop.current=true;},stop);
    assert.ok(seen.length < 20);
  } finally { for (const model of [a,b]) { model.optimizer.dispose(); model.dispose(); } }
  assert.equal(tf.memory().numTensors,baseline);
});

test('decision surface predicts cell centers in Cartesian row order', () => {
  const model=buildTFModel([layers[0],layers[2]],.04);
  const kernel=tf.tensor2d([[2],[-3]]), bias=tf.tensor1d([1]);
  try {
    model.layers[0].setWeights([kernel,bias]);
    const actual=predictGridSurface(model,2,-1,1).grid.flat();
    const expected=[-1.5,.5,1.5,3.5].map(z=>1/(1+Math.exp(-z)));
    actual.forEach((value,index)=>assert.ok(Math.abs(value-expected[index])<1e-6));
  } finally { kernel.dispose(); bias.dispose(); model.optimizer.dispose(); model.dispose(); }
});

test('eight repeated train/inspect/dispose cycles keep tensor counts bounded', async context => {
  const initial=tf.memory().numTensors;
  const data=trainTestSplit(generateXOR(40,.05,42));
  const counts=[];
  for (let cycle=0;cycle<8;cycle++) {
    const model=buildTFModel(layers,.04);
    try {
      await trainTFModel(model,data.train,data.test,3,8);
      extractModelWeights(model); inspectForwardPass(model,[.8,.8]);
    } finally { model.optimizer.dispose(); model.dispose(); }
    counts.push(tf.memory().numTensors);
  }
  assert.ok(counts.every(count=>count===initial));
  context.diagnostic(JSON.stringify({backend:tf.getBackend(),initialTensors:initial,afterEachCycle:counts}));
});

test('the default XOR showcase learns a nonlinear boundary with the hidden layer', async () => {
  const data = trainTestSplit(generateXOR(180,.12,42),.8,42);
  const baseline = buildTFModel([layers[0],layers[2]],.04);
  const hidden = buildTFModel(layers,.04);
  try {
    const linearHistory = await trainTFModel(baseline,data.train,data.test,60,16);
    const hiddenHistory = await trainTFModel(hidden,data.train,data.test,60,16);
    assert.ok(hiddenHistory.at(-1).valAccuracy >= .9);
    assert.ok(hiddenHistory.at(-1).valAccuracy > linearHistory.at(-1).valAccuracy);
  } finally { for (const model of [baseline,hidden]) { model.optimizer.dispose(); model.dispose(); } }
});
