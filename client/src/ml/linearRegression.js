// Linear Regression Solver: Closed-Form OLS and Gradient Descent

export function solveOLS(trainPoints, testPoints = []) {
  if (!trainPoints || trainPoints.length < 2) {
    return { slope: 0, intercept: 0, mse: 0, mae: 0, r2: 0, testMse: 0 };
  }

  const n = trainPoints.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (let i = 0; i < n; i++) {
    const { x, y } = trainPoints[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
    sumY2 += y * y;
  }

  const denominator = (n * sumX2 - sumX * sumX);
  if (Math.abs(denominator) < 1e-12) {
    return { slope: 0, intercept: sumY / n, mse: 0, mae: 0, r2: 0, testMse: 0 };
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  // Calculate training metrics
  const meanY = sumY / n;
  let ssTotal = 0;
  let ssRes = 0;
  let absErrorSum = 0;

  const residuals = trainPoints.map((p) => {
    const yPred = slope * p.x + intercept;
    const err = p.y - yPred;
    ssRes += err * err;
    ssTotal += Math.pow(p.y - meanY, 2);
    absErrorSum += Math.abs(err);
    return { x: p.x, yTrue: p.y, yPred, residual: err };
  });

  const mse = ssRes / n;
  const mae = absErrorSum / n;
  const r2 = ssTotal > 1e-9 ? Math.max(0, 1 - (ssRes / ssTotal)) : 1;

  // Calculate test metrics if testPoints provided
  let testMse = 0;
  if (testPoints && testPoints.length > 0) {
    let testSsRes = 0;
    testPoints.forEach((p) => {
      const yPred = slope * p.x + intercept;
      testSsRes += Math.pow(p.y - yPred, 2);
    });
    testMse = testSsRes / testPoints.length;
  }

  return {
    slope: Number(slope.toFixed(4)),
    intercept: Number(intercept.toFixed(4)),
    mse: Number(mse.toFixed(4)),
    mae: Number(mae.toFixed(4)),
    r2: Number(r2.toFixed(4)),
    testMse: Number(testMse.toFixed(4)),
    residuals,
    predict: (x) => slope * x + intercept,
  };
}

// Gradient Descent for Linear Regression with epoch tracking
export function trainLinearRegressionGD(trainPoints, testPoints = [], learningRate = 0.05, epochs = 60) {
  let slope = 0.0;
  let intercept = 0.0;
  const history = [];

  const n = trainPoints.length;
  if (n === 0) return { slope: 0, intercept: 0, history: [] };

  for (let ep = 0; ep < epochs; ep++) {
    let gradSlope = 0;
    let gradIntercept = 0;
    let trainLoss = 0;

    for (let i = 0; i < n; i++) {
      const { x, y } = trainPoints[i];
      const yPred = slope * x + intercept;
      const error = yPred - y;
      gradSlope += (2 / n) * error * x;
      gradIntercept += (2 / n) * error;
      trainLoss += (1 / n) * error * error;
    }

    slope -= learningRate * gradSlope;
    intercept -= learningRate * gradIntercept;

    // Test loss
    let valLoss = 0;
    if (testPoints.length > 0) {
      testPoints.forEach((p) => {
        valLoss += (1 / testPoints.length) * Math.pow((slope * p.x + intercept) - p.y, 2);
      });
    }

    history.push({
      epoch: ep + 1,
      trainLoss: Number(trainLoss.toFixed(4)),
      valLoss: Number(valLoss.toFixed(4)),
      slope: Number(slope.toFixed(4)),
      intercept: Number(intercept.toFixed(4)),
    });
  }

  const finalMetrics = solveOLS(trainPoints, testPoints);
  return {
    slope,
    intercept,
    history,
    ...finalMetrics,
  };
}
