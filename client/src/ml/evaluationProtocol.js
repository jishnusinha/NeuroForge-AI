/**
 * NeuroForge Evaluation Protocol & Stratified Splits (Phase 6)
 * Creates 3-way train/validation/test splits preserving class ratios and tracks test-set audit access.
 */

// Mulberry32 PRNG for deterministic splitting
function createPRNG(seed) {
  let s = Math.floor(seed);
  return function () {
    s |= 0;
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createStratifiedSplit(rows, targetCol, options = {}) {
  const {
    trainRatio = 0.7,
    valRatio = 0.15,
    testRatio = 0.15,
    seed = 42,
  } = options;

  if (!rows || rows.length < 6) {
    throw new Error('SPLIT_MIN_SAMPLES: At least 6 samples required for a 3-way split.');
  }

  if (![trainRatio,valRatio,testRatio].every(r=>Number.isFinite(r)&&r>0&&r<1) || Math.abs(trainRatio+valRatio+testRatio-1)>1e-9 || !Number.isInteger(seed)) throw new Error('INVALID_SPLIT_RATIOS');
  const rng = createPRNG(seed);

  // Group by target class
  const classBuckets = Object.create(null);
  for (const row of rows) {
    const cls = row[targetCol] ?? 'default';
    if (!classBuckets[cls]) classBuckets[cls] = [];
    classBuckets[cls].push({ ...row });
  }

  const train = [];
  const validation = [];
  const test = [];

  // Shuffle and assign within each class
  for (const cls of Object.keys(classBuckets)) {
    const bucket = classBuckets[cls];
    // Fisher-Yates with seeded PRNG
    for (let i = bucket.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [bucket[i], bucket[j]] = [bucket[j], bucket[i]];
    }

    const n = bucket.length;
    if (n < 3) throw new Error('SPLIT_SMALL_CLASS: Each class needs at least 3 samples.');
    const nTrain = Math.min(n-2, Math.max(1, Math.floor(n * trainRatio)));
    const nVal = Math.min(n-nTrain-1, Math.max(1, Math.floor(n * valRatio)));

    bucket.forEach((item, idx) => {
      if (idx < nTrain) {
        train.push({ ...item, split: 'train' });
      } else if (idx < nTrain + nVal) {
        validation.push({ ...item, split: 'validation' });
      } else {
        test.push({ ...item, split: 'test' });
      }
    });
  }

  const protocol = {
    schemaVersion: 2,
    seed,
    ratios: { trainRatio, valRatio, testRatio },
    counts: {
      train: train.length,
      validation: validation.length,
      test: test.length,
      total: rows.length,
    },
    testAccessHistory: [],
  };

  return {
    train,
    validation,
    test,
    all: [...train, ...validation, ...test],
    protocol,
  };
}

export function recordTestAccess(protocol, runId) {
  if (!protocol) return;
  protocol.testAccessHistory.push({
    runId,
    accessedAt: new Date().toISOString(),
  });
}
