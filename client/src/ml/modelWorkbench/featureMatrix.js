/**
 * F12 task-neutral, row-preserving adapter for actual F11 prepared outputs.
 * All original feature columns are used; nothing is projected down to x/y.
 */
export function createFeatureMatrix(plan) {
  if (!plan || !Array.isArray(plan.outputFeatures) || !Array.isArray(plan.rows) ||
      !plan.artifact || !plan.recipe || !plan.membership) throw new Error('F12_PREPARED_PLAN_REQUIRED');
  const features = [...plan.outputFeatures];
  if (features.length < 1 || features.length > 20 || new Set(features).size !== features.length ||
      plan.rows.length < 6 || plan.rows.length > 2000) throw new Error('F12_MATRIX_BUDGET');
  const targetColumn = plan.recipe.targetColumn;
  const taskType = plan.recipe.taskType === 'regression' ? 'regression' : 'classification';
  const groups = new Map();
  for (const part of ['train', 'validation', 'test']) {
    const ids = plan.membership[part];
    if (!Array.isArray(ids) || !ids.length) throw new Error('F12_EMPTY_SPLIT: ' + part);
    for (const id of ids) {
      if (typeof id !== 'string' || !id || groups.has(id)) throw new Error('F12_DUPLICATE_SPLIT_ROW');
      groups.set(id, part);
    }
  }
  const seen = new Set();
  const rows = plan.rows.map(row => {
    if (typeof row.id !== 'string' || !row.id || seen.has(row.id) || !groups.has(row.id))
      throw new Error('F12_INVALID_ROW_ID');
    seen.add(row.id);
    const values = features.map(name => row[name]);
    if (values.some(value => typeof value !== 'number' || !Number.isFinite(value)))
      throw new Error('F12_NONFINITE_FEATURE');
    const target = row[targetColumn];
    if (taskType === 'regression' && (typeof target !== 'number' || !Number.isFinite(target)))
      throw new Error('F12_REGRESSION_TARGET_REQUIRED');
    if (taskType === 'classification' && (target === null || target === undefined || target === ''))
      throw new Error('F12_CLASS_TARGET_REQUIRED');
    return { id: row.id, values, target, split: groups.get(row.id) };
  });
  if (groups.size !== seen.size) throw new Error('F12_SPLIT_NOT_EXHAUSTIVE');
  const train = rows.filter(row => row.split === 'train');
  const classes = taskType === 'classification'
    ? [...new Set(train.map(row => row.target))].sort((a,b)=>String(a).localeCompare(String(b), undefined, {numeric:true})) : [];
  if (taskType === 'classification' && (classes.length < 2 || classes.length > 12 ||
      rows.some(row => !classes.includes(row.target)))) throw new Error('F12_UNSEEN_CLASS_OR_INVALID_CLASSES');
  return {
    schemaVersion: 1,
    task: { type: taskType === 'regression' ? 'regression' : classes.length === 2 ? 'binary_classification' : 'multiclass_classification',
      targetColumn, classes },
    features, rows,
    membership: structuredClone(plan.membership),
    lineage: { pipelineSchemaVersion: plan.artifact.schemaVersion,
      pipelineRecipe: structuredClone(plan.recipe),
      fittedPipeline: structuredClone(plan.artifact),
      splitSeed: plan.recipe.seed, splitPreset: plan.recipe.splitPreset },
  };
}
