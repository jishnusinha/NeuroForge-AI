/**
 * NeuroForge Preprocessing Pipeline with Anti-Leakage Guarantees (Phase 6)
 * Fits scalers, imputers, and polynomial transforms exclusively on training data.
 */

export class PreprocessingPipeline {
  constructor(steps = []) {
    this.steps = steps; // [{ type: 'impute' | 'standardize' | 'minmax' | 'polynomial', options }]
    this.fittedParams = null;
    this.featureNames = [];
    this.transformedFeatureNames = [];
  }

  // Fit exclusively on training rows
  fit(trainRows, featureNames) {
    if (!trainRows || trainRows.length === 0) {
      throw new Error('FIT_REQUIRES_TRAINING_ROWS');
    }
    this.featureNames = [...featureNames];
    const params = {
      featureNames: this.featureNames,
      stepParams: [],
    };

    let working = trainRows.map(row => ({ ...row }));
    let features = [...featureNames];
    for (const step of this.steps) {
      if (!['impute', 'standardize', 'minmax', 'polynomial'].includes(step.type)) throw new Error('UNSUPPORTED_PREPROCESSING_STEP');
      const stats = {};
      for (const feature of features) {
        const values = working.map(row => row[feature]).filter(Number.isFinite);
        if (!values.length) throw new Error('NO_FINITE_TRAINING_VALUES: ' + feature);
        const mean = values.reduce((a,b) => a+b,0)/values.length;
        const std = Math.sqrt(values.reduce((a,b) => a+(b-mean)**2,0)/Math.max(1,values.length-1)) || 1;
        const ordered = values.slice().sort((a,b) => a - b);
        const mid = Math.floor(ordered.length / 2);
        const median = ordered.length % 2 ? ordered[mid] : (ordered[mid - 1] + ordered[mid]) / 2;
        stats[feature] = { mean, median, std, min: ordered[0], max: ordered.at(-1) };
      }
      const strategy = step.type === 'impute' ? (step.options?.strategy ?? 'mean') : undefined;
      if (strategy && !['mean', 'median'].includes(strategy)) throw new Error('UNSUPPORTED_IMPUTATION_STRATEGY');
      const fitted = { type: step.type, features: [...features], stats, ...(strategy ? { strategy } : {}) };
      params.stepParams.push(fitted);
      working = this.applyStep(working, fitted);
      if (step.type === 'polynomial') features = [...features, ...features.map(f => f+'^2'), ...(features.length >= 2 ? [features[0]+'*'+features[1]] : [])];
    }
    this.transformedFeatureNames = features;
    params.transformedFeatureNames = features;
    params.colStats = params.stepParams[0]?.stats || {};
    this.fittedParams = params;
    return this;
  }

  // Transform samples using fitted training parameters
  transform(rows) {
    if (!this.fittedParams) {
      throw new Error('PIPELINE_NOT_FITTED: Call fit() with training data first.');
    }

    return this.fittedParams.stepParams.reduce((current, step) => this.applyStep(current, step), rows.map(row => ({ ...row })));
  }

  applyStep(rows, { type, features, stats, strategy = 'mean' }) {
    return rows.map(row => {
      const out = { ...row };
      for (const feature of features) {
        const value = out[feature];
        const { mean, std, min, max } = stats[feature];
        if (type === 'impute') { if (!Number.isFinite(value)) out[feature] = strategy === 'median' ? stats[feature].median : mean; }
        else {
          if (!Number.isFinite(value)) throw new Error('NONFINITE_FEATURE: Add imputation before scaling.');
          if (type === 'standardize') out[feature] = (value - mean) / std;
          if (type === 'minmax') out[feature] = (value - min) / (max - min || 1);
          if (type === 'polynomial') out[feature + '^2'] = value ** 2;
        }
      }
      if (type === 'polynomial' && features.length >= 2) out[features[0]+'*'+features[1]] = out[features[0]] * out[features[1]];
      return out;
    });
  }

  // Extract feature vector for TensorFlow tensors
  extractFeatureMatrix(rows) {
    return rows.map(r => this.transformedFeatureNames.map(f => { if(!Number.isFinite(r[f]))throw new Error('NONFINITE_FEATURE');return r[f]; }));
  }

  // Serialization
  toJSON() {
    return {
      schemaVersion: 2,
      steps: this.steps,
      fittedParams: this.fittedParams,
      transformedFeatureNames: this.transformedFeatureNames,
    };
  }

  static fromJSON(json) {
    if (!json || !json.fittedParams) throw new Error('INVALID_PIPELINE_SERIALIZATION');
    const pipeline = new PreprocessingPipeline(json.steps || []);
    pipeline.fittedParams = json.fittedParams;
    pipeline.featureNames = json.fittedParams.featureNames;
    pipeline.transformedFeatureNames = json.transformedFeatureNames;
    return pipeline;
  }
}
