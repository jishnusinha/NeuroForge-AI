/**
 * Regression cannot use a class-stratified splitter: continuous targets often
 * have one observation per value. This seeded random split never reads y.
 */
import { mulberry32 } from '../datasets.js';

export function createRegressionSplit(rows, { trainRatio = 0.7, valRatio = 0.15, testRatio = 0.15, seed = 42 } = {}) {
  if (!Array.isArray(rows) || rows.length < 6 || rows.length > 2000 ||
      !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff ||
      [trainRatio, valRatio, testRatio].some(r => !Number.isFinite(r) || r <= 0 || r >= 1) ||
      Math.abs(trainRatio + valRatio + testRatio - 1) > 1e-9) {
    throw new Error('F12_REGRESSION_SPLIT_INVALID');
  }
  const shuffled = rows.map(row => ({ ...row }));
  const random = mulberry32(seed);
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const nTrain = Math.max(1, Math.min(shuffled.length - 2, Math.floor(shuffled.length * trainRatio)));
  const nValidation = Math.max(1, Math.min(shuffled.length - nTrain - 1, Math.floor(shuffled.length * valRatio)));
  const train = shuffled.slice(0, nTrain).map(row => ({ ...row, split: 'train' }));
  const validation = shuffled.slice(nTrain, nTrain + nValidation).map(row => ({ ...row, split: 'validation' }));
  const test = shuffled.slice(nTrain + nValidation).map(row => ({ ...row, split: 'test' }));
  return {
    train, validation, test, all: [...train, ...validation, ...test],
    protocol: {
      schemaVersion: 3, strategy: 'seeded-random-regression', seed,
      ratios: { trainRatio, valRatio, testRatio },
      counts: { train: train.length, validation: validation.length, test: test.length, total: rows.length },
      testAccessHistory: [],
    },
  };
}
