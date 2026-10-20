import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAndValidateCSV } from '../client/src/ml/datasetImport.js';
import { PreprocessingPipeline } from '../client/src/ml/preprocessingPipeline.js';
import { createStratifiedSplit, recordTestAccess } from '../client/src/ml/evaluationProtocol.js';

test('Phase 6: CSV Importer safely parses tabular data, computes profiles, and rejects formula injection', () => {
  const validCsv = `
x1,x2,category
1.0,10.0,A
2.0,20.0,A
3.0,30.0,B
4.0,40.0,B
5.0,50.0,A
`;
  const result = parseAndValidateCSV(validCsv, { maxRows: 100, maxCols: 5, requiredNumericCols: 2 });
  assert.equal(result.rowCount, 5);
  assert.deepEqual(result.headers, ['x1', 'x2', 'category']);
  assert.equal(result.summary[0].name, 'x1');
  assert.equal(result.summary[0].mean, 3);
  assert.equal(result.summary[0].min, 1);
  assert.equal(result.summary[0].max, 5);
  assert.equal(result.summary[2].type, 'categorical');

  // Formula injection rejection
  const formulaCsv = `
=cmd|' /C calc'!A0,x2,label
1.0,2.0,A
2.0,3.0,B
3.0,4.0,A
4.0,5.0,B
`;
  assert.throws(() => {
    parseAndValidateCSV(formulaCsv);
  }, /CSV_REJECTED/);

  // Insufficient numeric features
  const allTextCsv = `
col1,col2,col3
cat,dog,fish
cat,dog,fish
cat,dog,fish
cat,dog,fish
`;
  assert.throws(() => {
    parseAndValidateCSV(allTextCsv, { requiredNumericCols: 2 });
  }, /CSV_INSUFFICIENT_NUMERIC_FEATURES/);
});

test('Phase 6: Preprocessing pipeline guarantees strict anti-leakage (fitted only on training data)', () => {
  const trainRows = [
    { x1: 10, x2: 100, label: 0 },
    { x1: 20, x2: 200, label: 1 },
    { x1: 30, x2: 300, label: 0 },
    { x1: 40, x2: 400, label: 1 },
  ];

  // Pipeline with standardize and polynomial features
  const pipeline = new PreprocessingPipeline([
    { type: 'standardize' },
    { type: 'polynomial' },
  ]);

  pipeline.fit(trainRows, ['x1', 'x2']);

  const fittedMeanX1 = pipeline.fittedParams.colStats.x1.mean;
  const fittedStdX1 = pipeline.fittedParams.colStats.x1.std;
  assert.equal(fittedMeanX1, 25); // (10+20+30+40)/4 = 25

  // Transforming test rows containing extreme outliers must NOT alter fitted parameters
  const testRows = [
    { x1: 1000, x2: 10000, label: 1 },
    { x1: 5000, x2: 50000, label: 0 },
  ];

  const transformedTest = pipeline.transform(testRows);

  // Assert fitted parameters remain strictly identical
  assert.equal(pipeline.fittedParams.colStats.x1.mean, 25);
  assert.equal(pipeline.fittedParams.colStats.x1.std, fittedStdX1);

  // Check transformed outlier normalized with training statistics
  const expectedNormX1 = (1000 - 25) / fittedStdX1;
  assert.ok(Math.abs(transformedTest[0].x1 - expectedNormX1) < 1e-4);

  // Check polynomial interaction product was added
  assert.ok(transformedTest[0]['x1*x2'] !== undefined);
  assert.equal(transformedTest[0]['x1*x2'], transformedTest[0].x1 * transformedTest[0].x2);
});

test('Phase 6: Preprocessing pipeline serializes and deserializes accurately for inference', () => {
  const trainRows = [
    { x1: 2, x2: 20 },
    { x1: 4, x2: 40 },
    { x1: 6, x2: 60 },
    { x1: 8, x2: 80 },
  ];

  const originalPipeline = new PreprocessingPipeline([{ type: 'minmax' }]);
  originalPipeline.fit(trainRows, ['x1', 'x2']);

  const json = originalPipeline.toJSON();
  const restoredPipeline = PreprocessingPipeline.fromJSON(json);

  const querySample = [{ x1: 5, x2: 50 }];
  const originalOutput = originalPipeline.transform(querySample);
  const restoredOutput = restoredPipeline.transform(querySample);

  assert.deepEqual(originalOutput, restoredOutput);
  assert.equal(restoredOutput[0].x1, 0.5); // (5-2)/(8-2) = 0.5
  assert.equal(restoredOutput[0].x2, 0.5);
});

test('Phase 6: Stratified split preserves exact class distribution across partitions', () => {
  // 60 class A, 40 class B (60% / 40%)
  const rows = [];
  for (let i = 0; i < 60; i++) rows.push({ id: `a-${i}`, label: 'A', val: i });
  for (let i = 0; i < 40; i++) rows.push({ id: `b-${i}`, label: 'B', val: i });

  const splitResult = createStratifiedSplit(rows, 'label', {
    trainRatio: 0.7,
    valRatio: 0.15,
    testRatio: 0.15,
    seed: 1234,
  });

  const { train, validation, test: testSet, protocol } = splitResult;

  assert.equal(train.length + validation.length + testSet.length, 100);
  assert.equal(protocol.counts.total, 100);

  // Check proportions in train set (42 of A, 28 of B => 60% / 40%)
  const trainA = train.filter(r => r.label === 'A').length;
  const trainB = train.filter(r => r.label === 'B').length;
  assert.equal(trainA, 42);
  assert.equal(trainB, 28);
  assert.equal(trainA / (trainA + trainB), 0.6);

  // Check deterministic reproducibility with identical seed
  const splitResult2 = createStratifiedSplit(rows, 'label', {
    trainRatio: 0.7,
    valRatio: 0.15,
    testRatio: 0.15,
    seed: 1234,
  });
  assert.deepEqual(
    splitResult.train.map(r => r.id),
    splitResult2.train.map(r => r.id)
  );
});

test('Phase 6: Test set access is audited and recorded in evaluation protocol', () => {
  const rows = [
    { id: '1', label: 'A' },
    { id: '2', label: 'A' },
    { id: '3', label: 'B' },
    { id: '4', label: 'B' },
    { id: '5', label: 'A' },
    { id: '6', label: 'B' },
  ];

  const { protocol } = createStratifiedSplit(rows, 'label');
  assert.equal(protocol.testAccessHistory.length, 0);

  recordTestAccess(protocol, 'run-eval-alpha');
  assert.equal(protocol.testAccessHistory.length, 1);
  assert.equal(protocol.testAccessHistory[0].runId, 'run-eval-alpha');
  assert.ok(protocol.testAccessHistory[0].accessedAt);

  recordTestAccess(protocol, 'run-eval-beta');
  assert.equal(protocol.testAccessHistory.length, 2);
  assert.equal(protocol.testAccessHistory[1].runId, 'run-eval-beta');
});
