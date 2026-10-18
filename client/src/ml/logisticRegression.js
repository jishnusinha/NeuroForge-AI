// Logistic Regression Classifier with Binary Cross-Entropy and L2 Regularization

function sigmoid(z) {
  // Clamp z to avoid numerical overflow
  const clamped = Math.max(-15, Math.min(15, z));
  return 1 / (1 + Math.exp(-clamped));
}

export function trainLogisticRegression(
  trainPoints, 
  testPoints = [], 
  learningRate = 0.1, 
  regularization = 0.001, 
  epochs = 80,
  threshold = 0.5
) {
  let w1 = (Math.random() - 0.5) * 0.2;
  let w2 = (Math.random() - 0.5) * 0.2;
  let b = 0.0;

  const n = trainPoints.length;
  if (n === 0) {
    return {
      weights: { w1: 0, w2: 0, b: 0 },
      history: [],
      accuracy: 0,
      testAccuracy: 0,
      loss: 0,
      confusion: { tp: 0, fp: 0, tn: 0, fn: 0 },
      predict: () => 0.5,
    };
  }

  const history = [];

  for (let ep = 0; ep < epochs; ep++) {
    let gradW1 = 0;
    let gradW2 = 0;
    let gradB = 0;
    let trainLoss = 0;

    for (let i = 0; i < n; i++) {
      const p = trainPoints[i];
      const z = w1 * p.x + w2 * p.y + b;
      const yHat = sigmoid(z);
      const y = p.label;

      const error = yHat - y;
      gradW1 += error * p.x;
      gradW2 += error * p.y;
      gradB += error;

      // Stable log loss
      const safeYHat = Math.max(1e-12, Math.min(1 - 1e-12, yHat));
      trainLoss += -(y * Math.log(safeYHat) + (1 - y) * Math.log(1 - safeYHat));
    }

    // Mean gradients with L2 regularization
    gradW1 = (gradW1 / n) + regularization * w1;
    gradW2 = (gradW2 / n) + regularization * w2;
    gradB = gradB / n;

    w1 -= learningRate * gradW1;
    w2 -= learningRate * gradW2;
    b -= learningRate * gradB;

    trainLoss = (trainLoss / n) + 0.5 * regularization * (w1 * w1 + w2 * w2);

    // Validation loss calculation
    let valLoss = 0;
    if (testPoints.length > 0) {
      testPoints.forEach((p) => {
        const yHat = sigmoid(w1 * p.x + w2 * p.y + b);
        const safe = Math.max(1e-12, Math.min(1 - 1e-12, yHat));
        valLoss += -(p.label * Math.log(safe) + (1 - p.label) * Math.log(1 - safe));
      });
      valLoss = valLoss / testPoints.length;
    }

    history.push({
      epoch: ep + 1,
      trainLoss: Number(trainLoss.toFixed(4)),
      valLoss: Number(valLoss.toFixed(4)),
    });
  }

  // Evaluation on train set
  let tp = 0, fp = 0, tn = 0, fn = 0;
  trainPoints.forEach((p) => {
    const prob = sigmoid(w1 * p.x + w2 * p.y + b);
    const pred = prob >= threshold ? 1 : 0;
    if (pred === 1 && p.label === 1) tp++;
    else if (pred === 1 && p.label === 0) fp++;
    else if (pred === 0 && p.label === 0) tn++;
    else if (pred === 0 && p.label === 1) fn++;
  });

  const accuracy = (tp + tn) / n;
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  // Evaluation on test set
  let testCorrect = 0;
  if (testPoints.length > 0) {
    testPoints.forEach((p) => {
      const prob = sigmoid(w1 * p.x + w2 * p.y + b);
      const pred = prob >= threshold ? 1 : 0;
      if (pred === p.label) testCorrect++;
    });
  }
  const testAccuracy = testPoints.length > 0 ? testCorrect / testPoints.length : accuracy;

  return {
    weights: {
      w1: Number(w1.toFixed(4)),
      w2: Number(w2.toFixed(4)),
      b: Number(b.toFixed(4)),
    },
    history,
    accuracy: Number(accuracy.toFixed(4)),
    testAccuracy: Number(testAccuracy.toFixed(4)),
    precision: Number(precision.toFixed(4)),
    recall: Number(recall.toFixed(4)),
    f1: Number(f1.toFixed(4)),
    confusion: { tp, fp, tn, fn },
    predictProbability: (x, y) => sigmoid(w1 * x + w2 * y + b),
    predictClass: (x, y) => (sigmoid(w1 * x + w2 * y + b) >= threshold ? 1 : 0),
    // Returns line boundary endpoints for canvas rendering: w1*x + w2*y + b = 0
    getBoundaryLine: (xMin, xMax) => {
      if (Math.abs(w2) < 1e-6) return null;
      return {
        yAtXMin: -(w1 * xMin + b) / w2,
        yAtXMax: -(w1 * xMax + b) / w2,
      };
    }
  };
}
