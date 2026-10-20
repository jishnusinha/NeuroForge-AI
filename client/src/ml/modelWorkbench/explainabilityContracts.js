/**
 * DS-F13. Explanations are strictly bound to F12 models and validation rows.
 * The test split is never accepted by exploratory explanation APIs.
 */
import { mulberry32 } from '../datasets.js';
import { predictWorkbenchModel } from './models.js';
import { evaluateWorkbenchPredictions } from './metrics.js';

const finite = value => typeof value === 'number' && Number.isFinite(value);

export function validateExplanationContext(matrix, model) {
  if (matrix?.schemaVersion !== 1 || model?.schemaVersion !== 1 ||
      model.kind !== 'neuroforge-f12-model' ||
      !Array.isArray(matrix.features) || !Array.isArray(model.features) ||
      JSON.stringify(matrix.features) !== JSON.stringify(model.features) ||
      matrix.task?.type !== model.task ||
      JSON.stringify(matrix.task.classes) !== JSON.stringify(model.classes) ||
      !Array.isArray(matrix.rows) || !Array.isArray(matrix.membership?.validation)) {
    throw new Error('F13_MODEL_MATRIX_MISMATCH');
  }
  const ids = new Set(matrix.membership.validation);
  const validation = matrix.rows.filter(row => row.split === 'validation');
  if (!validation.length || validation.length !== ids.size ||
      validation.some(row => !ids.has(row.id) || !Array.isArray(row.values) ||
        row.values.length !== matrix.features.length || !row.values.every(finite))) {
    throw new Error('F13_VALIDATION_MEMBERSHIP_INVALID');
  }
  return validation;
}

export function validationSample(matrix, model, limit = 80, seed = 42) {
  const validation = validateExplanationContext(matrix, model);
  if (!Number.isInteger(limit) || limit < 1 || limit > 200 ||
      !Number.isInteger(seed) || seed < 0 || seed > 4294967295) {
    throw new Error('F13_SAMPLE_BUDGET');
  }
  if (validation.length <= limit) return validation;
  const indices = validation.map((_, index) => index);
  const random = mulberry32(seed);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, limit).sort((a, b) => a - b).map(i => validation[i]);
}

export function allowedExplanationMetric(task, metric) {
  const supported = task === 'regression' ? ['rmse', 'mae'] : ['accuracy', 'macroF1'];
  if (!supported.includes(metric)) throw new Error('F13_UNSUPPORTED_METRIC');
  return { metric, direction: task === 'regression' ? 'minimize' : 'maximize' };
}

export function scoreExplanationRows(matrix, model, rows, metric) {
  validateExplanationContext(matrix, model);
  allowedExplanationMetric(matrix.task.type, metric);
  const validIds = new Set(matrix.membership.validation);
  if (!Array.isArray(rows) || !rows.length ||
      rows.some(row => row.split !== 'validation' || !validIds.has(row.id))) {
    throw new Error('F13_VALIDATION_ONLY');
  }
  // A temporary matrix contains only the requested validation observations;
  // original split IDs, source rows and preprocessing remain unmodified.
  const slice = { ...matrix, rows };
  const predictions = predictWorkbenchModel(model, rows.map(row => row.values));
  const report = evaluateWorkbenchPredictions(slice, predictions, 'validation');
  const result = report.metrics[metric];
  return { value: finite(result) ? result : null, count: rows.length, report, predictions };
}

export const F13_LIMITATIONS = Object.freeze({
  correlated: 'Correlated features can share or conceal permutation importance.',
  heldout: 'Explanations use validation observations; the held-out test set is not explored.',
  causal: 'Hypothetical model predictions do not imply real-world causal effects.',
  encoded: 'Prepared numeric feature changes may violate relationships between engineered or one-hot features.',
});
