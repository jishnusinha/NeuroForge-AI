/**
 * NeuroForge Investigation & Challenge Engine (Phase 10)
 * Versioned scientific challenges, diagnostic rubrics, and non-brittle grading.
 */

export const CHALLENGE_TEMPLATES = [
  {
    id: 'challenge-hidden-layer',
    schemaVersion: 2,
    title: 'The Necessity of Hidden Layers',
    objective: 'Demonstrate why linear models fail on XOR / non-linear problems and how hidden layers create non-linear decision boundaries.',
    dataset: 'xor',
    taskType: 'binary_classification',
    hints: [
      'Try running with 0 hidden layers first (single perceptron) and observe the decision boundary.',
      'Add a hidden dense layer with 3-4 units and a ReLU activation function.',
      'Check validation accuracy after 30 epochs.'
    ],
    rubric: {
      type: 'nonlinear_separation',
      minValAccuracy: 0.85,
      requiresHiddenLayer: true,
    },
  },
  {
    id: 'challenge-lr-divergence',
    schemaVersion: 2,
    title: 'Learning Rate Divergence & Stability',
    objective: 'Observe loss explosion with excessive learning rates and find the stable convergence regime.',
    dataset: 'spiral',
    taskType: 'binary_classification',
    hints: [
      'A learning rate of 2.0 or higher will cause gradient explosion or oscillating losses.',
      'Reduce the learning rate to between 0.01 and 0.05 for smooth gradient descent.',
    ],
    rubric: {
      type: 'divergence_and_convergence',
      maxStableLoss: 0.70,
    },
  },
  {
    id: 'challenge-overfitting-diagnosis',
    schemaVersion: 2,
    title: 'Validation-Based Overfitting Diagnosis',
    objective: 'Detect when excessive model capacity overfits training noise and causes validation loss to rise.',
    dataset: 'moons',
    taskType: 'binary_classification',
    hints: [
      'Train a large network with 50+ epochs without regularization.',
      'Look at the epoch where training loss keeps declining but validation loss starts to increase.',
    ],
    rubric: {
      type: 'overfitting_detection',
      requiresOverfittingInflection: true,
    },
  },
];

// Grade user investigation using robust qualitative and property-based rubrics
export function gradeInvestigation(challengeId, runRecord, userObservations = '') {
  const challenge = CHALLENGE_TEMPLATES.find(c => c.id === challengeId);
  if (!challenge) {
    throw new Error(`CHALLENGE_NOT_FOUND: Unknown challenge id '${challengeId}'`);
  }

  if (!runRecord) {
    throw new Error('RUN_RECORD_REQUIRED: Provide a completed experiment run record.');
  }

  const { rubric } = challenge;
  const checks = [];
  let passed = true;

  if (rubric.type === 'nonlinear_separation') {
    // 1. Check hidden layer presence
    const layers = runRecord.hyperparameters?.layers || runRecord.layers || [];
    const hasHidden = layers.some(l => l.role === 'hidden' || (l.type === 'Dense' && l.units > 1 && l.type !== 'Output'));
    checks.push({
      name: 'Architecture contains hidden representation layer',
      passed: hasHidden,
      feedback: hasHidden ? 'Hidden layer correctly configured.' : 'Model lacks a hidden dense layer.',
    });

    // 2. Check validation accuracy achieved
    const valAcc = runRecord.metrics?.valAccuracy ?? runRecord.metrics?.accuracy ?? 0;
    const accPassed = valAcc >= rubric.minValAccuracy;
    checks.push({
      name: `Validation accuracy reaches target (>= ${(rubric.minValAccuracy * 100).toFixed(0)}%)`,
      passed: accPassed,
      feedback: accPassed 
        ? `Target accuracy reached: ${(valAcc * 100).toFixed(1)}%` 
        : `Current validation accuracy ${(valAcc * 100).toFixed(1)}% below required threshold.`,
    });

    // 3. Qualitative observation check
    const hasObservation = Boolean(userObservations && userObservations.trim().length >= 10);
    checks.push({
      name: 'Recorded analytical scientific observation',
      passed: hasObservation,
      feedback: hasObservation ? 'Observation recorded.' : 'Please add an observation explaining why non-linearity was achieved.',
    });

    passed = checks.every(c => c.passed);
  } else if (rubric.type === 'divergence_and_convergence') {
    const valLoss = runRecord.metrics?.valLoss ?? runRecord.metrics?.loss ?? 1.0;
    const lossPassed = valLoss <= rubric.maxStableLoss && !Number.isNaN(valLoss);
    checks.push({
      name: `Model reached stable convergence (Loss <= ${rubric.maxStableLoss})`,
      passed: lossPassed,
      feedback: lossPassed 
        ? `Stable convergence achieved (Loss: ${valLoss.toFixed(4)})` 
        : `Loss remained high or diverged (Loss: ${valLoss.toFixed(4)})`,
    });
    passed = checks.every(c => c.passed);
  } else if (rubric.type === 'overfitting_detection') {
    const history = runRecord.metricHistory || [];
    let detectedOverfit = false;
    if (history.length >= 5) {
      const minValLoss = Math.min(...history.map(h => h.valLoss ?? 999));
      const lastValLoss = history[history.length - 1]?.valLoss ?? 999;
      if (lastValLoss > minValLoss + 0.05) {
        detectedOverfit = true;
      }
    }
    checks.push({
      name: 'Demonstrated divergence between training loss and validation loss',
      passed: detectedOverfit,
      feedback: detectedOverfit 
        ? 'Overfitting inflection successfully demonstrated in loss curves.' 
        : 'Validation loss did not diverge from training loss; try more epochs or capacity.',
    });
    passed = checks.every(c => c.passed);
  }

  const score = Math.round((checks.filter(c => c.passed).length / checks.length) * 100);

  return {
    challengeId,
    title: challenge.title,
    passed,
    score,
    checks,
    evaluatedAt: new Date().toISOString(),
  };
}
