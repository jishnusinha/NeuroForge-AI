import test from 'node:test';
import assert from 'node:assert/strict';
import { solveOLS, trainLinearRegressionGD } from '../client/src/ml/linearRegression.js';
import { stepKMeans, runKMeans } from '../client/src/ml/kmeans.js';
import { createKNN } from '../client/src/ml/knn.js';
import { generateTwoMoons, generateGaussianBlobs, trainTestSplit } from '../client/src/ml/datasets.js';
import { trainLogisticRegression } from '../client/src/ml/logisticRegression.js';
import { comparisonCompatible, fingerprint, metricAt, detectsOverfitting } from '../client/src/ml/experiments.js';

test('OLS computes actual residual error for constant input features', () => {
  const result = solveOLS([{x: 1, y: 0}, {x: 1, y: 2}]);
  assert.equal(result.mse, 1); assert.equal(result.mae, 1); assert.equal(result.predict(1), 1);
});
test('gradient descent returns its fitted parameters rather than the analytical optimum', () => {
  const result = trainLinearRegressionGD([{x: 0, y: 0}, {x: 1, y: 2}, {x: 2, y: 4}], [], 0.001, 1);
  assert.ok(Math.abs(result.slope - 0.0066666667) < 1e-6);
  assert.equal(result.predict(1), result.slope + result.intercept);
});
test('KNN does not claim accuracy without evaluation data', () => {
  assert.equal(createKNN([{x:0,y:0,label:0}]).evaluate([]), null);
});
test('K-means step inertia matches returned centroid and converges', () => {
  const points = [{x:0,y:0}, {x:2,y:0}];
  const result = stepKMeans(points, [{x:0,y:0,cluster:0}]);
  assert.equal(result.inertia, 2); assert.equal(result.centroids[0].x, 1);
  assert.equal(runKMeans(points, 1).finalInertia, 2);
});
test('binary logistic regression rejects multiclass data and repeats with a fixed seed', () => {
  const {train,test} = trainTestSplit(generateTwoMoons());
  assert.deepEqual(trainLogisticRegression(train,test).weights, trainLogisticRegression(train,test).weights);
  assert.throws(() => trainLogisticRegression(generateGaussianBlobs()), /Binary/);
  assert.equal(trainLogisticRegression(train).testAccuracy,null);
  const result = trainLogisticRegression(train,test);
  assert.equal(Object.values(result.confusion).reduce((a,b)=>a+b,0),test.length);
});
test('logistic decision boundary follows selected probability threshold', () => {
  const {train,test} = trainTestSplit(generateTwoMoons());
  const model = trainLogisticRegression(train,test,0.1,0.001,80,0.8);
  const boundary = model.getBoundaryLine(-1,1);
  assert.ok(Math.abs(model.predictProbability(-1,boundary.yAtXMin) - 0.8) < 1e-8);
});
test('comparison requires recorded matching evaluation data and leaves missing metrics unavailable', () => {
  const a = {task:'classification',dataset:{fingerprint:'abc',splitFingerprint:'def',preprocessing:'none'}};
  assert.equal(comparisonCompatible(a,structuredClone(a)),true);
  assert.equal(comparisonCompatible(a,{...a,dataset:{...a.dataset,splitFingerprint:'other'}}),false);
  assert.equal(comparisonCompatible({dataset:{name:'XOR'}},{dataset:{name:'XOR'}}),false);
  assert.equal(metricAt({metrics:{}},1).acc,null);
  assert.equal(metricAt({metricHistory:[{epoch:10,loss:0.2}]},5).loss,null);
  assert.equal(detectsOverfitting({metricHistory:[{epoch:1,loss:.5,valLoss:.6},{epoch:2,loss:.3,valLoss:.4},{epoch:3,loss:.1,valLoss:.7}]}),true);
  assert.equal(fingerprint([{id:'a',x:0,y:1,label:0},{id:'b',x:1,y:0,label:1}]), fingerprint([{id:'b',x:1,y:0,label:1},{id:'a',x:0,y:1,label:0}]));
});
