import test from 'node:test';
import assert from 'node:assert/strict';
import { CHALLENGE_TEMPLATES, gradeInvestigation } from '../client/src/ml/challenges.js';
import { createEvidenceReport } from '../client/src/ml/evidenceReport.js';

test('Phase 10: Challenge templates define reproducible investigations with objective and rubrics', () => {
  assert.ok(CHALLENGE_TEMPLATES.length >= 3);
  const hiddenChallenge = CHALLENGE_TEMPLATES.find(c => c.id === 'challenge-hidden-layer');
  assert.ok(hiddenChallenge);
  assert.equal(hiddenChallenge.rubric.type, 'nonlinear_separation');
  assert.equal(hiddenChallenge.dataset, 'xor');
  assert.ok(hiddenChallenge.hints.length >= 2);
});

test('Phase 10: Rubric grading evaluates scientific outcomes without brittle floating-point equality', () => {
  // Run with hidden layer and 92% validation accuracy + observation
  const successfulRun = {
    name: 'XOR Non-linear Model',
    hyperparameters: {
      layers: [
        { type: 'Input', units: 2 },
        { type: 'Dense', units: 4, role: 'hidden' },
        { type: 'Output', units: 1 },
      ],
    },
    metrics: { valAccuracy: 0.92, loss: 0.15 },
  };

  const passResult = gradeInvestigation(
    'challenge-hidden-layer', 
    successfulRun, 
    'The hidden layer projects input points into 4-dimensional space, rendering the XOR problem linearly separable.'
  );

  assert.equal(passResult.passed, true);
  assert.equal(passResult.score, 100);
  assert.equal(passResult.checks.length, 3);
  assert.equal(passResult.checks[0].passed, true); // has hidden layer
  assert.equal(passResult.checks[1].passed, true); // accuracy >= 85%
  assert.equal(passResult.checks[2].passed, true); // recorded observation

  // Failed run: linear model with 0 hidden layers
  const linearRun = {
    name: 'XOR Linear Model',
    hyperparameters: {
      layers: [
        { type: 'Input', units: 2 },
        { type: 'Output', units: 1 },
      ],
    },
    metrics: { valAccuracy: 0.50, loss: 0.69 },
  };

  const failResult = gradeInvestigation('challenge-hidden-layer', linearRun, '');
  assert.equal(failResult.passed, false);
  assert.ok(failResult.score < 100);
});

test('Phase 10: Creates evidence-backed reports resolving directly to recorded run metrics', () => {
  const run1 = {
    _id: 'run-alpha',
    name: 'Baseline Perceptron',
    algorithm: 'Dense Perceptron',
    hyperparameters: { lr: 0.01, epochs: 20 },
    metrics: { loss: 0.45, valLoss: 0.48, accuracy: 0.60, valAccuracy: 0.58 },
    metricHistory: [{ epoch: 1 }, { epoch: 20 }],
  };

  const report = createEvidenceReport({
    title: 'Benchmarking Linear vs Non-linear Architectures',
    author: 'Lead Researcher',
    projectId: 'proj-001',
    runs: [run1],
    selectedSampleIds: ['sample-1', 'sample-7'],
    observations: 'Single layer fails to achieve greater than 60% accuracy due to class entanglement.',
    limitations: 'Evaluated solely on 2D synthetic datasets.',
  });

  assert.ok(report.id.startsWith('rep-'));
  assert.equal(report.title, 'Benchmarking Linear vs Non-linear Architectures');
  assert.equal(report.runSummaries.length, 1);
  assert.equal(report.runSummaries[0].runId, 'run-alpha');
  assert.equal(report.runSummaries[0].finalMetrics.valAccuracy, 0.58);
  assert.ok(report.markdownContent.includes('# Benchmarking Linear vs Non-linear Architectures'));
  assert.ok(report.markdownContent.includes('sample-1, sample-7'));

  // Requires at least one run
  assert.throws(() => {
    createEvidenceReport({ title: 'Empty', runs: [] });
  }, /REPORT_RUNS_REQUIRED/);
});
