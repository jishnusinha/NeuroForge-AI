import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  evaluateSamplePredictions, 
  computeSliceMetrics, 
  compareRunErrors, 
  createAnnotation 
} from '../client/src/ml/errorExplorer.js';

test('Phase 7: Evaluates sample predictions, confusion matrix cells, and confident errors', () => {
  const samples = [
    { id: 's1', actual: 1, predictedProb: 0.95 }, // TP (Confident)
    { id: 's2', actual: 1, predictedProb: 0.10 }, // FN (Confident wrong)
    { id: 's3', actual: 0, predictedProb: 0.85 }, // FP (Confident wrong)
    { id: 's4', actual: 0, predictedProb: 0.05 }, // TN (Confident)
    { id: 's5', actual: 1, predictedProb: 0.52 }, // TP (Borderline)
  ];

  const { sampleEvaluations, metrics } = evaluateSamplePredictions(samples, { threshold: 0.5 });

  assert.equal(metrics.total, 5);
  assert.equal(metrics.tp, 2); // s1, s5
  assert.equal(metrics.fp, 1); // s3
  assert.equal(metrics.fn, 1); // s2
  assert.equal(metrics.tn, 1); // s4
  assert.equal(metrics.correct, 3);
  assert.equal(metrics.accuracy, 3 / 5);

  // Confidently wrong count (s2 and s3)
  assert.equal(metrics.confidentlyWrongCount, 2);
  // Borderline count (s5 is correct with margin 0.02 <= 0.10)
  assert.equal(metrics.borderlineCount, 1);

  // Small sample caution triggered (< 20 samples)
  assert.equal(metrics.smallSampleCaution, true);

  // Sample cell assertions
  const s1 = sampleEvaluations.find(s => s.id === 's1');
  assert.equal(s1.cell, 'TP');
  assert.equal(s1.isCorrect, true);

  const s2 = sampleEvaluations.find(s => s.id === 's2');
  assert.equal(s2.cell, 'FN');
  assert.equal(s2.isCorrect, false);
  assert.equal(s2.isConfidentlyWrong, true);
});

test('Phase 7: Threshold tuning updates predictions dynamically without mutating base samples', () => {
  const baseSamples = [
    { id: 's1', actual: 1, predictedProb: 0.4 },
    { id: 's2', actual: 1, predictedProb: 0.6 },
    { id: 's3', actual: 0, predictedProb: 0.7 },
  ];

  // At default threshold 0.5:
  // s1 (0.4 < 0.5) => Pred 0 (FN)
  // s2 (0.6 >= 0.5) => Pred 1 (TP)
  // s3 (0.7 >= 0.5) => Pred 1 (FP)
  const evalDef = evaluateSamplePredictions(baseSamples, { threshold: 0.5 });
  assert.equal(evalDef.metrics.tp, 1);
  assert.equal(evalDef.metrics.fp, 1);
  assert.equal(evalDef.metrics.fn, 1);

  // At high threshold 0.8:
  // s1 => Pred 0 (FN)
  // s2 => Pred 0 (FN)
  // s3 => Pred 0 (TN)
  const evalHigh = evaluateSamplePredictions(baseSamples, { threshold: 0.8 });
  assert.equal(evalHigh.metrics.tp, 0);
  assert.equal(evalHigh.metrics.fp, 0);
  assert.equal(evalHigh.metrics.tn, 1);
  assert.equal(evalHigh.metrics.fn, 2);

  // Base samples remain completely unaltered
  assert.equal(baseSamples[0].predictedProb, 0.4);
  assert.equal(baseSamples[0].actual, 1);
});

test('Phase 7: Slice metrics analysis isolates subsets and cautions on small cohorts', () => {
  const sampleEvals = [];
  // 15 male samples, 25 female samples
  for (let i = 0; i < 15; i++) {
    sampleEvals.push({ id: `m-${i}`, cell: 'TP', features: { group: 'A' } });
  }
  for (let i = 0; i < 25; i++) {
    sampleEvals.push({ id: `f-${i}`, cell: 'TP', features: { group: 'B' } });
  }

  const sliceA = computeSliceMetrics(sampleEvals, s => s.features.group === 'A');
  assert.equal(sliceA.sampleCount, 15);
  assert.equal(sliceA.smallSampleCaution, true); // < 20 samples

  const sliceB = computeSliceMetrics(sampleEvals, s => s.features.group === 'B');
  assert.equal(sliceB.sampleCount, 25);
  assert.equal(sliceB.smallSampleCaution, false); // >= 20 samples
});

test('Phase 7: Compares two runs to detect corrected mistakes and newly introduced regressions', () => {
  const runA = [
    { id: 's1', isCorrect: false }, // Failed in A
    { id: 's2', isCorrect: false }, // Failed in A
    { id: 's3', isCorrect: true },  // Correct in A
    { id: 's4', isCorrect: true },  // Correct in A
  ];

  const runB = [
    { id: 's1', isCorrect: true },  // Corrected!
    { id: 's2', isCorrect: false }, // Still failing (shared error)
    { id: 's3', isCorrect: false }, // Regressed! (new error)
    { id: 's4', isCorrect: true },  // Still correct (shared correct)
  ];

  const comparison = compareRunErrors(runA, runB);
  assert.equal(comparison.totalCompared, 4);
  assert.equal(comparison.counts.correctedErrors, 1);
  assert.equal(comparison.counts.sharedErrors, 1);
  assert.equal(comparison.counts.regressedErrors, 1);
  assert.equal(comparison.counts.sharedCorrect, 1);

  assert.equal(comparison.correctedErrors[0].sampleA.id, 's1');
  assert.equal(comparison.regressedErrors[0].sampleA.id, 's3');
});

test('Phase 7: Creates immutable observation annotations tied to specific runs and samples', () => {
  const ann = createAnnotation({
    runId: 'run-xyz-123',
    sampleId: 'sample-42',
    text: 'Outlier due to sensor noise in feature x2',
    author: 'Principal Investigator',
  });

  assert.ok(ann.id.startsWith('ann-'));
  assert.equal(ann.runId, 'run-xyz-123');
  assert.equal(ann.sampleId, 'sample-42');
  assert.equal(ann.text, 'Outlier due to sensor noise in feature x2');
  assert.equal(ann.author, 'Principal Investigator');
  assert.ok(ann.createdAt);

  assert.throws(() => {
    createAnnotation({ runId: '', text: 'No run' });
  }, /INVALID_ANNOTATION/);
});
