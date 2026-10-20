/**
 * NeuroForge Error Explorer (Phase 7)
 * Inspectable failure diagnostics, dynamic threshold tuning, slice analysis,
 * and multi-run error comparison on identical evaluation samples.
 */

export function evaluateSamplePredictions(samples, options = {}) {
  const {
    threshold = 0.5,
    confidentlyWrongDelta = 0.4,
    borderlineMargin = 0.1,
    taskType = 'binary_classification',
  } = options;

  if (!Array.isArray(samples)) {
    throw new Error('SAMPLES_REQUIRED: Samples array is required for evaluation.');
  }

  const sampleEvaluations = [];
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  let confidentlyWrongCount = 0;
  let borderlineCount = 0;

  for (const sample of samples) {
    const { id, split = 'test', actual, predictedProb = 0.5, features = {} } = sample;
    const prob = Number(predictedProb);
    const act = Number(actual);

    const predictedClass = prob >= threshold ? 1 : 0;
    const isCorrect = predictedClass === act;
    const margin = Math.abs(prob - threshold);
    const residual = act - prob;

    let cell = 'TN';
    if (act === 1) {
      if (predictedClass === 1) {
        cell = 'TP';
        tp++;
      } else {
        cell = 'FN';
        fn++;
      }
    } else {
      if (predictedClass === 1) {
        cell = 'FP';
        fp++;
      } else {
        cell = 'TN';
        tn++;
      }
    }

    // Confidently wrong: prediction is wrong and far from truth
    const isConfidentlyWrong = !isCorrect && Math.abs(prob - act) >= (1 - confidentlyWrongDelta);
    if (isConfidentlyWrong) {
      confidentlyWrongCount++;
    }

    // Borderline: correct but close to decision threshold
    const isBorderline = isCorrect && margin <= borderlineMargin;
    if (isBorderline) {
      borderlineCount++;
    }

    sampleEvaluations.push({
      id: id || `sample-${sampleEvaluations.length}`,
      split,
      actual: act,
      predictedProb: prob,
      predictedClass,
      threshold,
      isCorrect,
      margin,
      residual,
      isConfidentlyWrong,
      isBorderline,
      cell,
      features,
    });
  }

  const total = sampleEvaluations.length;
  const correct = tp + tn;
  const incorrect = fp + fn;
  const accuracy = total > 0 ? correct / total : 0;
  const precision = (tp + fp) > 0 ? tp / (tp + fp) : 0;
  const recall = (tp + fn) > 0 ? tp / (tp + fn) : 0;
  const f1 = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  const metrics = {
    total,
    correct,
    incorrect,
    tp,
    fp,
    tn,
    fn,
    accuracy,
    precision,
    recall,
    f1,
    confidentlyWrongCount,
    borderlineCount,
    smallSampleCaution: total < 20,
  };

  return {
    sampleEvaluations,
    metrics,
    threshold,
    taskType,
  };
}

export function computeSliceMetrics(sampleEvaluations, filterFn) {
  if (!Array.isArray(sampleEvaluations)) return null;
  const filtered = filterFn ? sampleEvaluations.filter(filterFn) : sampleEvaluations;
  const total = filtered.length;

  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;

  for (const s of filtered) {
    if (s.cell === 'TP') tp++;
    else if (s.cell === 'FP') fp++;
    else if (s.cell === 'TN') tn++;
    else if (s.cell === 'FN') fn++;
  }

  const correct = tp + tn;
  const accuracy = total > 0 ? correct / total : 0;
  const precision = (tp + fp) > 0 ? tp / (tp + fp) : 0;
  const recall = (tp + fn) > 0 ? tp / (tp + fn) : 0;
  const f1 = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  return {
    sampleCount: total,
    smallSampleCaution: total < 20,
    metrics: {
      total,
      correct,
      tp,
      fp,
      tn,
      fn,
      accuracy,
      precision,
      recall,
      f1,
    },
    samples: filtered,
  };
}

export function compareRunErrors(runAEvals, runBEvals) {
  if (!Array.isArray(runAEvals) || !Array.isArray(runBEvals)) {
    throw new Error('COMPARISON_REQUIRES_EVALUATIONS: Both runs must provide sample evaluations.');
  }

  const mapB = new Map(runBEvals.map(s => [s.id, s]));
  const sharedErrors = [];
  const correctedErrors = [];
  const regressedErrors = [];
  const sharedCorrect = [];

  for (const sampleA of runAEvals) {
    const sampleB = mapB.get(sampleA.id);
    if (!sampleB) continue; // Skip samples not evaluated in both

    if (!sampleA.isCorrect && !sampleB.isCorrect) {
      sharedErrors.push({ sampleA, sampleB });
    } else if (!sampleA.isCorrect && sampleB.isCorrect) {
      correctedErrors.push({ sampleA, sampleB });
    } else if (sampleA.isCorrect && !sampleB.isCorrect) {
      regressedErrors.push({ sampleA, sampleB });
    } else {
      sharedCorrect.push({ sampleA, sampleB });
    }
  }

  return {
    totalCompared: sharedErrors.length + correctedErrors.length + regressedErrors.length + sharedCorrect.length,
    counts: {
      sharedErrors: sharedErrors.length,
      correctedErrors: correctedErrors.length,
      regressedErrors: regressedErrors.length,
      sharedCorrect: sharedCorrect.length,
    },
    sharedErrors,
    correctedErrors,
    regressedErrors,
    sharedCorrect,
  };
}

export function createAnnotation({ runId, sampleId = null, text, region = null, author = 'user' }) {
  if (!runId || !text || !text.trim()) {
    throw new Error('INVALID_ANNOTATION: runId and text are required.');
  }

  return {
    id: `ann-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    runId,
    sampleId,
    text: text.trim(),
    region,
    author,
    createdAt: new Date().toISOString(),
  };
}
