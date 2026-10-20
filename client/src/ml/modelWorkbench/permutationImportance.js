import { mulberry32 } from '../datasets.js';
import { validationSample, scoreExplanationRows, allowedExplanationMetric, F13_LIMITATIONS } from './explainabilityContracts.js';

const mean = values => values.reduce((sum, x) => sum + x, 0) / values.length;

/**
 * Seeded repeated marginal permutation importance on a bounded VALIDATION
 * sample. Positive importance means prediction quality became worse.
 * Scores always use the same selected validation observations.
 *
 * Optionally supply a cancellation signal and a progress callback. The worker
 * runs this function without sending raw observations back to the UI.
 */
export function permutationImportance(matrix, model, {
  metric = matrix.task.type === 'regression' ? 'rmse' : 'accuracy',
  repeats = 3, seed = 42, maxRows = 80, maxFeatures = 12,
  signal = null, onProgress = null,
} = {}) {
  if (!Number.isInteger(repeats) || repeats < 1 || repeats > 8 ||
      !Number.isInteger(maxFeatures) || maxFeatures < 1 || maxFeatures > 20)
    throw new Error('F13_PERMUTATION_BUDGET');
  const { direction } = allowedExplanationMetric(matrix.task.type, metric);
  const rows = validationSample(matrix, model, maxRows, seed);
  const original = scoreExplanationRows(matrix, model, rows, metric);
  if (original.value === null) return {
    status:'unavailable', reason:'Metric is undefined on this validation sample.',
    metric, direction, sampleCount:rows.length, sourceCount:matrix.membership.validation.length,
    features:[], repeats, seed,
  };
  const random = mulberry32(seed);
  const featureNames = matrix.features.slice(0, maxFeatures);
  const results = [];
  for (let featureIndex = 0; featureIndex < featureNames.length; featureIndex++) {
    if (signal?.aborted) throw new Error('F13_ANALYSIS_CANCELLED');
    const values = [];
    for (let repeat = 0; repeat < repeats; repeat++) {
      if (signal?.aborted) throw new Error('F13_ANALYSIS_CANCELLED');
      const order = rows.map((_, index) => index);
      for (let index = order.length - 1; index > 0; index--) {
        const j = Math.floor(random() * (index + 1));
        [order[index], order[j]] = [order[j], order[index]];
      }
      const permuted = rows.map((row, index) => ({
        ...row, values:row.values.map((v, j) => j === featureIndex ? rows[order[index]].values[j] : v),
      }));
      const changed = scoreExplanationRows(matrix, model, permuted, metric);
      if (changed.value === null) throw new Error('F13_PERMUTED_METRIC_UNAVAILABLE');
      values.push(direction === 'maximize' ? original.value - changed.value : changed.value - original.value);
    }
    const importance = mean(values);
    const sd = Math.sqrt(mean(values.map(v => (v - importance) ** 2)));
    results.push({name:featureNames[featureIndex],meanImportance:importance,
      standardDeviation:sd, repeats:values.length});
    onProgress?.(featureIndex + 1, featureNames.length);
  }
  results.sort((a,b) => b.meanImportance - a.meanImportance || a.name.localeCompare(b.name));
  return {
    status:'ok', method:'repeated-marginal-permutation', scope:'validation',
    metric, direction, baselineScore:original.value,
    sampleCount:rows.length, sourceCount:matrix.membership.validation.length,
    features:results, repeats, seed,
    limitations:[F13_LIMITATIONS.correlated,F13_LIMITATIONS.heldout,
      ...(matrix.features.length > maxFeatures ?
        ['Only the first '+maxFeatures+' of '+matrix.features.length+' prepared features were analyzed.'] : []),
      ...(rows.length < matrix.membership.validation.length ?
        ['Deterministic validation subsample; results do not describe every validation observation.'] : [])],
  };
}
