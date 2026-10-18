// K-Means Clustering Solver with Step-by-Step Iteration and Centroid Inertia

export function initializeCentroids(points, k = 3, seed = 42) {
  if (!points || points.length === 0) return [];
  const kClamped = Math.min(k, points.length);

  // Simple deterministic K-means++ style spread
  const centroids = [];
  const firstIdx = seed % points.length;
  centroids.push({ id: `c-0`, x: points[firstIdx].x, y: points[firstIdx].y, cluster: 0 });

  for (let c = 1; c < kClamped; c++) {
    // Pick point furthest from existing centroids
    let maxDist = -1;
    let bestPoint = points[0];

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      let minDistToCentroid = Infinity;
      for (let j = 0; j < centroids.length; j++) {
        const d = Math.hypot(p.x - centroids[j].x, p.y - centroids[j].y);
        if (d < minDistToCentroid) minDistToCentroid = d;
      }
      if (minDistToCentroid > maxDist) {
        maxDist = minDistToCentroid;
        bestPoint = p;
      }
    }

    centroids.push({ id: `c-${c}`, x: bestPoint.x, y: bestPoint.y, cluster: c });
  }

  return centroids;
}

// Single step of K-Means: returns updated assignments, new centroids, inertia, and converged status
export function stepKMeans(points, currentCentroids) {
  if (!points || points.length === 0 || !currentCentroids || currentCentroids.length === 0) {
    return { points: [], centroids: currentCentroids, inertia: 0, converged: true };
  }

  // 1. Assignment Step
  let inertia = 0;
  const assignments = points.map((p) => {
    let minDist = Infinity;
    let bestCluster = 0;

    currentCentroids.forEach((c) => {
      const dist = Math.hypot(p.x - c.x, p.y - c.y);
      if (dist < minDist) {
        minDist = dist;
        bestCluster = c.cluster;
      }
    });

    inertia += minDist * minDist;
    return { ...p, cluster: bestCluster };
  });

  // 2. Centroid Update Step
  let maxCentroidShift = 0;
  const newCentroids = currentCentroids.map((c) => {
    const clusterPoints = assignments.filter((p) => p.cluster === c.cluster);
    if (clusterPoints.length === 0) {
      return { ...c }; // Keep centroid stationary if no points assigned
    }

    const meanX = clusterPoints.reduce((sum, p) => sum + p.x, 0) / clusterPoints.length;
    const meanY = clusterPoints.reduce((sum, p) => sum + p.y, 0) / clusterPoints.length;

    const shift = Math.hypot(meanX - c.x, meanY - c.y);
    if (shift > maxCentroidShift) maxCentroidShift = shift;

    return {
      ...c,
      x: Number(meanX.toFixed(4)),
      y: Number(meanY.toFixed(4)),
    };
  });

  const converged = maxCentroidShift < 1e-4;

  return {
    points: assignments,
    centroids: newCentroids,
    inertia: Number(inertia.toFixed(2)),
    converged,
  };
}

// Run until convergence or max iterations
export function runKMeans(points, k = 3, initialCentroids = null, maxIterations = 20) {
  let centroids = initialCentroids || initializeCentroids(points, k);
  const history = [];

  let currentPoints = points;
  for (let iter = 0; iter < maxIterations; iter++) {
    const stepResult = stepKMeans(currentPoints, centroids);
    centroids = stepResult.centroids;
    currentPoints = stepResult.points;

    history.push({
      iteration: iter + 1,
      inertia: stepResult.inertia,
      converged: stepResult.converged,
    });

    if (stepResult.converged) break;
  }

  return {
    finalCentroids: centroids,
    labeledPoints: currentPoints,
    finalInertia: history[history.length - 1]?.inertia || 0,
    iterations: history.length,
    history,
  };
}
