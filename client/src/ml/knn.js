// K-Nearest Neighbors Classifier with Probe Inspection & Distance Weighting

function calculateDistance(x1, y1, x2, y2, metric = 'euclidean') {
  if (metric === 'manhattan') {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
  }
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

export function createKNN(trainPoints, k = 5, metric = 'euclidean', weighted = false) {
  const kClamped = Math.max(1, Math.min(k, trainPoints.length || 1));

  // Query single point
  function probe(queryX, queryY) {
    if (!trainPoints || trainPoints.length === 0) {
      return { predictedClass: 0, confidence: 0.5, neighbors: [] };
    }

    // Compute distance to all training points
    const distances = trainPoints.map((p) => ({
      point: p,
      dist: calculateDistance(queryX, queryY, p.x, p.y, metric),
    }));

    // Sort by ascending distance
    distances.sort((a, b) => a.dist - b.dist);
    const kNeighbors = distances.slice(0, kClamped);

    // Vote aggregation
    let vote0 = 0;
    let vote1 = 0;

    kNeighbors.forEach(({ point, dist }) => {
      const weight = weighted ? 1 / (dist + 1e-5) : 1;
      if (point.label === 1) {
        vote1 += weight;
      } else {
        vote0 += weight;
      }
    });

    const totalVote = vote0 + vote1;
    const prob1 = totalVote > 0 ? vote1 / totalVote : 0.5;
    const predictedClass = prob1 >= 0.5 ? 1 : 0;

    return {
      queryX,
      queryY,
      predictedClass,
      prob1: Number(prob1.toFixed(4)),
      confidence: Number((predictedClass === 1 ? prob1 : (1 - prob1)).toFixed(4)),
      neighbors: kNeighbors.map(n => ({
        x: n.point.x,
        y: n.point.y,
        label: n.point.label,
        distance: Number(n.dist.toFixed(4)),
      })),
    };
  }

  // Evaluate Accuracy on test points
  function evaluate(testPoints = []) {
    if (!testPoints || testPoints.length === 0) return null;
    let correct = 0;
    testPoints.forEach((p) => {
      const res = probe(p.x, p.y);
      if (res.predictedClass === p.label) {
        correct++;
      }
    });
    return Number((correct / testPoints.length).toFixed(4));
  }

  return {
    k: kClamped,
    metric,
    weighted,
    probe,
    evaluate,
    predictClass: (x, y) => probe(x, y).predictedClass,
    predictProbability: (x, y) => probe(x, y).prob1,
  };
}
