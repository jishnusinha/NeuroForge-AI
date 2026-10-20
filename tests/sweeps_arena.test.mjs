import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  generateGridManifest, 
  aggregateRepeatedTrials, 
  diffHyperparameters, 
  rankSweepResults 
} from '../client/src/ml/sweeps.js';

test('Phase 9: Grid search manifest generator bounds total jobs against resource budget', () => {
  const grid = {
    learningRate: [0.001, 0.01, 0.1], // 3
    batchSize: [16, 32],              // 2
  };
  const seeds = [42, 101, 202]; // 3
  // 3 * 2 * 3 = 18 total jobs

  const manifest = generateGridManifest(grid, { seeds, maxTotalJobs: 25 });
  assert.equal(manifest.totalConfigs, 6);
  assert.equal(manifest.seedsPerConfig, 3);
  assert.equal(manifest.totalJobs, 18);
  assert.equal(manifest.jobs.length, 18);
  assert.ok(manifest.sweepId.startsWith('sweep-'));
  assert.equal(manifest.jobs[0].status, 'pending');

  // Budget exceeded: 6 configs * 5 seeds = 30 jobs > 20 max
  assert.throws(() => {
    generateGridManifest(grid, { seeds: [1, 2, 3, 4, 5], maxTotalJobs: 20 });
  }, /SWEEP_BUDGET_EXCEEDED/);
});

test('Phase 9: Repeated trials aggregates runs with identical hyperparameters across seeds', () => {
  const runs = [
    { hyperparameters: { lr: 0.01, hidden: 4 }, seed: 42, metrics: { valLoss: 0.25 } },
    { hyperparameters: { lr: 0.01, hidden: 4 }, seed: 101, metrics: { valLoss: 0.20 } },
    { hyperparameters: { lr: 0.01, hidden: 4 }, seed: 202, metrics: { valLoss: 0.30 } },
    { hyperparameters: { lr: 0.05, hidden: 8 }, seed: 42, metrics: { valLoss: 0.50 } },
  ];

  const aggregated = aggregateRepeatedTrials(runs, 'valLoss');
  assert.equal(aggregated.length, 2);

  const cfg1 = aggregated.find(g => g.config.lr === 0.01);
  assert.equal(cfg1.trialCount, 3);
  assert.equal(cfg1.smallTrialCaution, true); // < 5 trials
  assert.ok(Math.abs(cfg1.mean - 0.25) < 1e-6); // (0.25 + 0.20 + 0.30) / 3 = 0.25
  assert.equal(cfg1.min, 0.20);
  assert.equal(cfg1.max, 0.30);
  assert.ok(cfg1.std > 0);
});

test('Phase 9: Parameter diff isolates configuration changes between baseline and candidate', () => {
  const base = { lr: 0.01, batchSize: 32, optimizer: 'adam' };
  const candidate = { lr: 0.05, batchSize: 32, optimizer: 'sgd' };

  const diff = diffHyperparameters(base, candidate);
  assert.equal(diff.hasDifferences, true);
  assert.equal(diff.differenceCount, 2); // lr and optimizer

  const lrDiff = diff.diffs.find(d => d.parameter === 'lr');
  assert.equal(lrDiff.valueA, 0.01);
  assert.equal(lrDiff.valueB, 0.05);

  const identicalDiff = diffHyperparameters(base, base);
  assert.equal(identicalDiff.hasDifferences, false);
  assert.equal(identicalDiff.differenceCount, 0);
});

test('Phase 9: Ranks sweep results strictly by validation metrics without contaminating test data', () => {
  const aggregatedResults = [
    { config: { id: 'c1' }, mean: 0.35 },
    { config: { id: 'c2' }, mean: 0.12 },
    { config: { id: 'c3' }, mean: 0.22 },
  ];

  const ranked = rankSweepResults(aggregatedResults, 'valLoss', 'asc');
  assert.equal(ranked.length, 3);
  assert.equal(ranked[0].rank, 1);
  assert.equal(ranked[0].config.id, 'c2'); // Lowest valLoss 0.12
  assert.equal(ranked[1].rank, 2);
  assert.equal(ranked[1].config.id, 'c3'); // 0.22
  assert.equal(ranked[2].rank, 3);
  assert.equal(ranked[2].config.id, 'c1'); // 0.35
});
