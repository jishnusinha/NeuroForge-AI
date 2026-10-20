import { profileDataset } from './datasetProfiling.js';
import { createStratifiedSplit } from './evaluationProtocol.js';
import { PreprocessingPipeline } from './preprocessingPipeline.js';

export const SPLIT_PRESETS = Object.freeze({
  '70/15/15': Object.freeze({ trainRatio: .7, valRatio: .15, testRatio: .15 }),
  '80/10/10': Object.freeze({ trainRatio: .8, valRatio: .1, testRatio: .1 }),
  '60/20/20': Object.freeze({ trainRatio: .6, valRatio: .2, testRatio: .2 }),
});

export function defaultPipelineColumns(data) {
  if (!data) return { x: '', y: '', target: '' };
  const numeric = profileDataset(data).columns.filter(column => column.type === 'numeric').map(column => column.name);
  const target = data.headers.find(header => /^(label|target|class|outcome)$/i.test(header))
    ?? data.headers.find(header => !numeric.slice(0, 2).includes(header))
    ?? data.headers.at(-1) ?? '';
  return { x: numeric[0] ?? '', y: numeric.find(name => name !== numeric[0] && name !== target) ?? numeric[1] ?? '', target };
}

function finiteStat(values, selector) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  return selector(sorted);
}

export function buildDatasetPipeline(data, options = {}) {
  const {
    columns = defaultPipelineColumns(data),
    scaling = 'standardize',
    imputation = 'mean',
    splitPreset = '70/15/15',
    seed = 42,
  } = options;
  if (!data?.rows?.length || !Array.isArray(data.headers)) throw new Error('Import or select a dataset before preparing.');
  if (!SPLIT_PRESETS[splitPreset]) throw new Error('Choose a supported train/validation/test split.');
  if (!['standardize', 'minmax', 'none'].includes(scaling)) throw new Error('Choose a supported scaling method.');
  if (!['mean', 'median', 'none'].includes(imputation)) throw new Error('Choose a supported missing-value strategy.');
  if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295) throw new Error('Split seed must be an integer from 0 to 4294967295.');
  if (!columns || !['x', 'y', 'target'].every(key => data.headers.includes(columns[key])) ||
      new Set([columns.x, columns.y, columns.target]).size !== 3) {
    throw new Error('Choose two different numeric inputs and a separate target.');
  }
  const profiled = profileDataset(data);
  if (![columns.x, columns.y].every(name => profiled.columns.find(column => column.name === name)?.type === 'numeric')) {
    throw new Error('The visual labs require two numeric input columns.');
  }
  const raw = data.rows.map((row, index) => ({
    id: row.id ?? `sample-${index}`,
    x: row[columns.x], y: row[columns.y], label: row[columns.target],
  }));
  if (raw.some(row => ![0, 1].includes(row.label))) {
    throw new Error('The visual classifier requires observed binary targets 0 and 1; missing labels are not inferred.');
  }
  if (new Set(raw.map(row => row.label)).size !== 2) {
    throw new Error('The visual classifier needs both binary classes 0 and 1.');
  }
  const ratios = SPLIT_PRESETS[splitPreset];
  const split = createStratifiedSplit(raw, 'label', { ...ratios, seed });
  if (new Set(split.train.map(row => row.label)).size !== 2 || !split.validation.length || !split.test.length) {
    throw new Error('Insufficient class samples for a stratified train/validation/test split.');
  }

  const steps = [
    ...(imputation === 'none' ? [] : [{ type: 'impute', options: { strategy: imputation } }]),
    ...(scaling === 'none' ? [] : [{ type: scaling }]),
  ];
  const pipeline = new PreprocessingPipeline(steps).fit(split.train, ['x', 'y']);
  const transformed = pipeline.transform(raw);
  if (transformed.some(row => !Number.isFinite(row.x) || !Number.isFinite(row.y))) {
    throw new Error('NONFINITE_PREPARED_FEATURES');
  }
  const membership = {
    train: split.train.map(row => row.id),
    validation: split.validation.map(row => row.id),
    test: split.test.map(row => row.id),
  };
  const partition = new Map(Object.entries(membership).flatMap(([name, ids]) => ids.map(id => [id, name])));
  const previews = transformed.slice(0, 8).map((row, index) => ({
    id: row.id,
    partition: partition.get(row.id),
    originalX: raw[index].x, originalY: raw[index].y,
    x: row.x, y: row.y,
  }));
  const statistics = Object.fromEntries(['x', 'y'].map(key => {
    const observed = split.train.map(row => row[key]).filter(Number.isFinite);
    return [key, {
      count: observed.length,
      missingTraining: split.train.length - observed.length,
      mean: observed.reduce((sum, value) => sum + value, 0) / observed.length,
      median: finiteStat(observed, sorted => {
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      }),
      imputationValue: imputation === 'median'
        ? pipeline.fittedParams.stepParams.find(step => step.type === 'impute')?.stats[key].median
        : imputation === 'mean'
          ? pipeline.fittedParams.stepParams.find(step => step.type === 'impute')?.stats[key].mean
          : null,
    }];
  }));
  const stages = [
    { id: 'source', title: 'Select columns', detail: `${columns.x}, ${columns.y} → ${columns.target}` },
    { id: 'split', title: 'Stratified split', detail: `${splitPreset} · seed ${seed}` },
    { id: 'impute', title: 'Missing values', detail: imputation === 'none' ? 'No imputation' : `${imputation} (train-fitted)` },
    { id: 'scale', title: 'Scaling', detail: scaling === 'none' ? 'Original scale' : `${scaling} (train-fitted)` },
    { id: 'output', title: 'Two-feature lab', detail: 'Real prepared values · fixed held-out splits' },
  ];
  return {
    raw, points: transformed, pipeline, membership, counts: split.protocol.counts,
    seed, columns, scaling, imputation, splitPreset, stages, statistics, previews,
    fittedParams: pipeline.toJSON(), protocol: split.protocol,
  };
}
