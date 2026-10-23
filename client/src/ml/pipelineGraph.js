import { SPLIT_PRESETS } from './pipelinePlanner.js';

export const STUDIO_SCHEMA_VERSION = 1;
export const STUDIO_MAX_NODES = 16;
export const STUDIO_MAX_FEATURES = 20;
export const STUDIO_MAX_CATEGORIES = 8;

export const NODE_DEFINITIONS = Object.freeze([
  { type: 'numeric.impute', label: 'Impute numeric', input: 'numeric', multiple: true },
  { type: 'numeric.scale', label: 'Scale numeric', input: 'numeric', multiple: true },
  { type: 'category.impute', label: 'Impute categories', input: 'categorical', multiple: true },
  { type: 'category.onehot', label: 'One-hot encode', input: 'categorical', multiple: true },
  { type: 'feature.square', label: 'Square numeric features', input: 'numeric', multiple: true },
  { type: 'feature.interaction', label: 'Multiply two features', input: 'numeric', multiple: true },
]);
const DEFINITIONS = new Map(NODE_DEFINITIONS.map(node => [node.type, node]));
const isMissing = value => value === null || value === undefined || value === '' ||
  (typeof value === 'number' && !Number.isFinite(value));

export function classifyPipelineColumns(dataset) {
  if (!dataset?.headers || !Array.isArray(dataset.rows)) return {};
  return Object.fromEntries(dataset.headers.map(column => {
    const observed = dataset.rows.map(row => row[column]).filter(value => !isMissing(value));
    return [column, observed.length && observed.every(Number.isFinite) ? 'numeric' : 'categorical'];
  }));
}

export function defaultStudioRecipe(dataset) {
  const headers = dataset?.headers ?? [];
  const target = dataset?.academy?.targetColumn ?? headers.find(name => /^(label|target|class|outcome)$/i.test(name)) ??
    headers.at(-1) ?? '';
  const kinds = classifyPipelineColumns(dataset);
  const eligible = headers.filter(name => name !== target);
  const numeric = eligible.filter(name => kinds[name] === 'numeric');
  const prescribed=dataset?.academy?.featureColumns?.filter(name=>eligible.includes(name));
  const featureColumns = (prescribed?.length ? prescribed : numeric.length ? numeric : eligible).slice(0, STUDIO_MAX_FEATURES);
  return {
    schemaVersion: STUDIO_SCHEMA_VERSION, taskType: dataset?.academy?.taskType ?? 'classification',
    featureColumns, targetColumn: target, splitPreset: '70/15/15', seed: 42,
    nodes: numeric.length ? [
      { id: 'numeric-imputation', type: 'numeric.impute', columns: [...featureColumns], enabled: true, options: { strategy: 'mean' } },
      { id: 'numeric-scaling', type: 'numeric.scale', columns: [...featureColumns], enabled: true, options: { strategy: 'standardize' } },
    ] : [],
  };
}

export function createStudioNode(type, recipe, dataset) {
  const definition = DEFINITIONS.get(type);
  if (!definition) throw new Error('F11_UNSUPPORTED_NODE');
  const kinds = classifyPipelineColumns(dataset);
  const columns = recipe.featureColumns.filter(name => kinds[name] === definition.input);
  const options = type === 'numeric.impute' ? { strategy: 'mean' }
    : type === 'numeric.scale' ? { strategy: 'standardize' }
      : type === 'category.impute' ? { strategy: 'mode' }
        : type === 'category.onehot' ? { unknown: 'allZero' } : {};
  return {
    id: 'step-' + Date.now() + '-' + recipe.nodes.length,
    type, columns: type === 'feature.interaction' ? columns.slice(0, 2) : columns.slice(0, 1),
    enabled: true, options,
  };
}

/**
 * F11 intentionally compiles to a bounded ordered graph. Arbitrary graph
 * connections, cycles and implicit unions are not executed or accepted.
 */
export function validateStudioRecipe(dataset, recipe) {
  if (!Array.isArray(dataset?.headers) || !Array.isArray(dataset?.rows) ||
      dataset.rows.length < 6 || dataset.rows.length > 2000 || dataset.headers.length > 20)
    throw new Error('F11_DATASET_BUDGET: Import 6–2000 rows with at most 20 columns.');
  if (!recipe || recipe.schemaVersion !== STUDIO_SCHEMA_VERSION || !Array.isArray(recipe.nodes))
    throw new Error('F11_RECIPE_SCHEMA: Unsupported or malformed recipe.');
  if (recipe.taskType !== undefined && !['classification','regression'].includes(recipe.taskType))
    throw new Error('F12_UNKNOWN_TASK_TYPE');
  if (!SPLIT_PRESETS[recipe.splitPreset] || !Number.isInteger(recipe.seed) ||
      recipe.seed < 0 || recipe.seed > 4294967295)
    throw new Error('F11_SPLIT_CONFIG: Choose a supported split and unsigned 32-bit seed.');
  const unique = new Set(dataset.headers);
  if (unique.size !== dataset.headers.length || !unique.has(recipe.targetColumn) ||
      !Array.isArray(recipe.featureColumns) || recipe.featureColumns.length < 1 ||
      recipe.featureColumns.length > STUDIO_MAX_FEATURES ||
      recipe.featureColumns.some(name => !unique.has(name) || name === recipe.targetColumn) ||
      new Set(recipe.featureColumns).size !== recipe.featureColumns.length)
    throw new Error('F11_FEATURE_SCHEMA: Select distinct inputs and a separate observed target.');
  const ids = dataset.rows.map(row => row.id);
  if (ids.some(id => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length)
    throw new Error('F11_ROW_IDENTITIES: Source records require unique stable row IDs.');
  if (recipe.nodes.length > STUDIO_MAX_NODES)
    throw new Error('F11_NODE_LIMIT: At most 16 processing nodes are allowed.');
  const nodeIds = new Set();
  const schemas = classifyPipelineColumns(dataset);
  const available = new Map(recipe.featureColumns.map(name => [name, schemas[name]]));
  const nodes = recipe.nodes.map(node => {
    if (!node || typeof node.id !== 'string' || !node.id || nodeIds.has(node.id))
      throw new Error('F11_NODE_ID: Step IDs must be non-empty and unique.');
    nodeIds.add(node.id);
    const definition = DEFINITIONS.get(node.type);
    if (!definition || !Array.isArray(node.columns) || node.columns.length === 0 ||
        new Set(node.columns).size !== node.columns.length ||
        typeof node.enabled !== 'boolean')
      throw new Error('F11_NODE_CONFIG: Choose a supported step with valid columns.');
    if (node.type === 'feature.interaction' && node.columns.length !== 2)
      throw new Error('F11_INTERACTION_COLUMNS: Select two distinct numeric inputs.');
    if (node.columns.some(name => !recipe.featureColumns.includes(name)))
      throw new Error('F11_NODE_SCOPE: Step columns must be selected input features.');
    const options = node.options ?? {};
    if (node.type === 'numeric.impute' && !['mean', 'median', 'constant'].includes(options.strategy))
      throw new Error('F11_IMPUTATION: Choose mean, median or constant.');
    if (node.type === 'numeric.impute' && options.strategy === 'constant' && (options.value === '' || options.value === null || options.value === undefined || !Number.isFinite(Number(options.value))))
      throw new Error('F11_NUMERIC_CONSTANT: Enter a finite numeric constant.');
    if (node.type === 'numeric.scale' && !['standardize', 'minmax', 'robust'].includes(options.strategy))
      throw new Error('F11_SCALE: Choose standardize, minmax or robust.');
    if (node.type === 'category.impute' && !['mode', 'constant'].includes(options.strategy))
      throw new Error('F11_CATEGORY_IMPUTE: Choose mode or constant.');
    if (node.type === 'category.impute' && options.strategy === 'constant' &&
        (typeof options.value !== 'string' || !options.value.trim()))
      throw new Error('F11_CATEGORY_CONSTANT: Enter a non-empty label.');
    if (node.type === 'category.onehot' && !['allZero', 'error'].includes(options.unknown))
      throw new Error('F11_UNKNOWN_CATEGORY: Choose an explicit unknown-category policy.');
    if (node.enabled) {
      for (const name of node.columns) {
        if (available.get(name) !== definition.input)
          throw new Error('F11_STEP_ORDER: ' + node.type + ' requires a currently available ' + definition.input + ' column: ' + name);
      }
      if (node.type === 'category.onehot')
        for (const name of node.columns) available.delete(name);
      if (node.type === 'feature.square')
        for (const name of node.columns) {
          const generated = name + '__squared';
          if (available.has(generated) || unique.has(generated))
            throw new Error('F11_OUTPUT_COLLISION: ' + generated);
          available.set(generated, 'numeric');
        }
      if (node.type === 'feature.interaction') {
        const generated = node.columns.join('__times__');
        if (available.has(generated) || unique.has(generated))
          throw new Error('F11_OUTPUT_COLLISION: ' + generated);
        available.set(generated, 'numeric');
      }
    }
    return {
      id: node.id, type: node.type, enabled: node.enabled, columns: [...node.columns],
      options: { ...options },
    };
  });
  return {
    schemaVersion: STUDIO_SCHEMA_VERSION, taskType: recipe.taskType ?? 'classification',
    targetColumn: recipe.targetColumn, featureColumns: [...recipe.featureColumns],
    splitPreset: recipe.splitPreset, seed: recipe.seed, nodes,
  };
}
