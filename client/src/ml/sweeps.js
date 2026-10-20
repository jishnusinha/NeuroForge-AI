/**
 * NeuroForge Advanced Sweeps & Repeated Trials (Phase 9)
 * Bounded grid search, repeated seed aggregation, parameter diffing,
 * and resilient idempotent sweep manifests.
 */

// Generate Cartesian product of parameter options
export function generateGridManifest(paramGrid, options = {}) {
  const {
    seeds = [42, 101, 202],
    maxTotalJobs = 50,
    baseConfig = {},
  } = options;

  if (!Array.isArray(seeds) || !seeds.length || seeds.some(seed=>!Number.isInteger(seed)) || new Set(seeds).size!==seeds.length) throw new Error('SWEEP_INVALID_SEEDS');
  const paramKeys = Object.keys(paramGrid);
  let budget=seeds.length;
  for (const values of Object.values(paramGrid)) { budget*=Array.isArray(values)?values.length:1; if(budget>Math.min(50,maxTotalJobs))throw new Error('SWEEP_BUDGET_EXCEEDED: Too many jobs.'); }
  if (paramKeys.length === 0) {
    throw new Error('SWEEP_EMPTY_GRID: At least one hyperparameter must be specified.');
  }

  // Generate configurations
  let configs = [{}];
  for (const key of paramKeys) {
    const values = paramGrid[key];
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error(`SWEEP_INVALID_PARAM: Values for '${key}' must be a non-empty array.`);
    }
    const nextConfigs = [];
    for (const c of configs) {
      for (const val of values) {
        nextConfigs.push({ ...c, [key]: val });
      }
    }
    configs = nextConfigs;
  }

  // Multiply by seeds
  const totalJobs = configs.length * seeds.length;
  if (totalJobs > maxTotalJobs) {
    throw new Error(
      `SWEEP_BUDGET_EXCEEDED: Requested ${configs.length} configs × ${seeds.length} seeds = ${totalJobs} jobs. Maximum allowed is ${maxTotalJobs}.`
    );
  }

  const jobs = [];
  let jobIdx = 0;
  for (let cIdx = 0; cIdx < configs.length; cIdx++) {
    const config = configs[cIdx];
    const configId = `cfg-${cIdx + 1}`;
    for (const seed of seeds) {
      jobs.push({
        jobId: `job-${++jobIdx}`,
        configId,
        config: { ...baseConfig, ...config },
        seed,
        status: 'pending', // pending, completed, failed
        metrics: null,
        error: null,
      });
    }
  }

  return {
    sweepId: `sweep-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    createdAt: new Date().toISOString(),
    totalConfigs: configs.length,
    seedsPerConfig: seeds.length,
    totalJobs: jobs.length,
    maxTotalJobs,
    jobs,
    status: 'pending',
  };
}

// Group repeated runs by configuration and compute dispersion stats
export function aggregateRepeatedTrials(runs, metricKey = 'valLoss') {
  if (!Array.isArray(runs) || runs.length === 0) return [];

  // Group by configuration signature
  const groups = new Map();

  for (const run of runs) {
    const cfg = Object.fromEntries(Object.entries(run.config || run.hyperparameters || {}).filter(([key])=>key!=='seed'));
    const scope = [run.domain?.datasetVersion.contentDigest || run.dataset?.fingerprint || 'unknown', run.domain?.evaluationProtocol.contentDigest || run.dataset?.splitFingerprint || 'unknown',run.algorithm || 'unknown'].join('/');
    // Stable configuration key
    const sortedKeys = Object.keys(cfg).sort();
    const sig = scope + '/' + sortedKeys.map(k => `${k}:${JSON.stringify(cfg[k])}`).join('|');

    if (!groups.has(sig)) {
      groups.set(sig, {
        signature: sig,
        config: cfg,
        runs: [],
      });
    }
    groups.get(sig).runs.push(run);
  }

  const results = [];

  for (const [, group] of groups) {
    const validMetrics = group.runs
      .map(r => {
        const val = r.metrics?.[metricKey] ?? r[metricKey];
        return typeof val === 'number' && Number.isFinite(val) ? val : null;
      })
      .filter(v => v !== null);

    const count = validMetrics.length;
    let mean = null;
    let std = null;
    let min = null;
    let max = null;

    if (count > 0) {
      mean = validMetrics.reduce((a, b) => a + b, 0) / count;
      min = Math.min(...validMetrics);
      max = Math.max(...validMetrics);
      if (count > 1) {
        const variance = validMetrics.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (count - 1);
        std = Math.sqrt(variance);
      } else {
        std = 0;
      }
    }

    results.push({
      signature: group.signature,
      config: group.config,
      trialCount: count,
      smallTrialCaution: count < 5,
      metricKey,
      mean,
      std,
      min,
      max,
      rawValues: validMetrics,
      runIds: group.runs.map(r => r._id || r.id || r.name),
    });
  }

  return results;
}

// Compare two configurations and find parameter differences
export function diffHyperparameters(configA = {}, configB = {}) {
  const allKeys = Array.from(new Set([...Object.keys(configA), ...Object.keys(configB)])).sort();
  const diffs = [];

  for (const key of allKeys) {
    const valA = configA[key];
    const valB = configB[key];

    const strA = JSON.stringify(valA);
    const strB = JSON.stringify(valB);

    if (strA !== strB) {
      diffs.push({
        parameter: key,
        valueA: valA !== undefined ? valA : '(undefined)',
        valueB: valB !== undefined ? valB : '(undefined)',
      });
    }
  }

  return {
    hasDifferences: diffs.length > 0,
    differenceCount: diffs.length,
    diffs,
  };
}

// Rank sweep candidates strictly by validation metric
export function rankSweepResults(aggregatedResults, metricKey = 'valLoss', order = 'asc') {
  const sortable = aggregatedResults.filter(r => r.mean !== null);
  sortable.sort((a, b) => {
    return order === 'asc' ? a.mean - b.mean : b.mean - a.mean;
  });
  return sortable.map((item, rank) => ({
    rank: rank + 1,
    ...item,
  }));
}
