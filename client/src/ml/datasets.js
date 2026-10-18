// Synthetic 2D Dataset Generators with reproducible pseudo-random seed

// Simple Mulberry32 PRNG for deterministic reproducibility
function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

// Box-Muller transform for Gaussian noise
function randomGaussian(prng, mean = 0, stdev = 1) {
  const u1 = Math.max(1e-7, prng());
  const u2 = prng();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stdev + mean;
}

export function generateTwoMoons(numPoints = 200, noise = 0.15, seed = 42) {
  const prng = mulberry32(seed);
  const points = [];
  const nPerMoon = Math.floor(numPoints / 2);

  // Upper Moon (Class 0)
  for (let i = 0; i < nPerMoon; i++) {
    const phi = (i / nPerMoon) * Math.PI;
    const x = Math.cos(phi) + randomGaussian(prng, 0, noise);
    const y = Math.sin(phi) + randomGaussian(prng, 0, noise);
    points.push({ id: `p0-${i}`, x: Number(x.toFixed(4)), y: Number(y.toFixed(4)), label: 0 });
  }

  // Lower Moon (Class 1) - shifted by (1.0, -0.5)
  for (let i = 0; i < nPerMoon; i++) {
    const phi = (i / nPerMoon) * Math.PI;
    const x = 1.0 - Math.cos(phi) + randomGaussian(prng, 0, noise);
    const y = 1.0 - Math.sin(phi) - 0.5 + randomGaussian(prng, 0, noise);
    points.push({ id: `p1-${i}`, x: Number(x.toFixed(4)), y: Number(y.toFixed(4)), label: 1 });
  }

  return points;
}

export function generateXOR(numPoints = 200, noise = 0.12, seed = 42) {
  const prng = mulberry32(seed);
  const points = [];
  const nPerQuadrant = Math.floor(numPoints / 4);

  // Quadrants:
  // Q1: x > 0, y > 0 -> Class 0
  // Q2: x < 0, y > 0 -> Class 1
  // Q3: x < 0, y < 0 -> Class 0
  // Q4: x > 0, y < 0 -> Class 1
  const quadrants = [
    { cx: 0.8, cy: 0.8, label: 0 },
    { cx: -0.8, cy: 0.8, label: 1 },
    { cx: -0.8, cy: -0.8, label: 0 },
    { cx: 0.8, cy: -0.8, label: 1 },
  ];

  quadrants.forEach((q, qIdx) => {
    for (let i = 0; i < nPerQuadrant; i++) {
      const x = q.cx + randomGaussian(prng, 0, noise * 2.5);
      const y = q.cy + randomGaussian(prng, 0, noise * 2.5);
      points.push({ id: `pxor-${qIdx}-${i}`, x: Number(x.toFixed(4)), y: Number(y.toFixed(4)), label: q.label });
    }
  });

  return points;
}

export function generateConcentricCircles(numPoints = 200, noise = 0.1, seed = 42) {
  const prng = mulberry32(seed);
  const points = [];
  const nPerCircle = Math.floor(numPoints / 2);

  // Inner Circle (Class 0, radius ~ 0.6)
  for (let i = 0; i < nPerCircle; i++) {
    const angle = prng() * 2 * Math.PI;
    const r = 0.6 + randomGaussian(prng, 0, noise);
    const x = r * Math.cos(angle);
    const y = r * Math.sin(angle);
    points.push({ id: `c0-${i}`, x: Number(x.toFixed(4)), y: Number(y.toFixed(4)), label: 0 });
  }

  // Outer Circle (Class 1, radius ~ 1.5)
  for (let i = 0; i < nPerCircle; i++) {
    const angle = prng() * 2 * Math.PI;
    const r = 1.5 + randomGaussian(prng, 0, noise);
    const x = r * Math.cos(angle);
    const y = r * Math.sin(angle);
    points.push({ id: `c1-${i}`, x: Number(x.toFixed(4)), y: Number(y.toFixed(4)), label: 1 });
  }

  return points;
}

export function generateGaussianBlobs(numPoints = 210, noise = 0.15, seed = 42) {
  const prng = mulberry32(seed);
  const points = [];
  const centers = [
    { cx: -1.0, cy: -0.8, label: 0 },
    { cx: 1.1, cy: -0.6, label: 1 },
    { cx: 0.0, cy: 1.2, label: 2 },
  ];
  const nPerBlob = Math.floor(numPoints / centers.length);

  centers.forEach((c, cIdx) => {
    for (let i = 0; i < nPerBlob; i++) {
      const x = c.cx + randomGaussian(prng, 0, 0.45 * (1 + noise));
      const y = c.cy + randomGaussian(prng, 0, 0.45 * (1 + noise));
      points.push({ id: `blob-${cIdx}-${i}`, x: Number(x.toFixed(4)), y: Number(y.toFixed(4)), label: c.label });
    }
  });

  return points;
}

export function generateLinearTrend(numPoints = 120, noise = 0.25, seed = 42) {
  const prng = mulberry32(seed);
  const points = [];
  const slope = 0.85;
  const intercept = 0.1;

  for (let i = 0; i < numPoints; i++) {
    const x = (prng() * 3.6) - 1.8; // range [-1.8, 1.8]
    const y = slope * x + intercept + randomGaussian(prng, 0, noise * 1.5);
    points.push({ id: `lin-${i}`, x: Number(x.toFixed(4)), y: Number(y.toFixed(4)), label: 0 });
  }

  return points;
}

// Split array of points into deterministic train and test sets
export function trainTestSplit(points, trainRatio = 0.8, seed = 42) {
  const prng = mulberry32(seed);
  // Fisher-Yates shuffle with PRNG
  const shuffled = [...points];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const splitIdx = Math.floor(shuffled.length * trainRatio);
  const train = shuffled.slice(0, splitIdx).map(p => ({ ...p, isTest: false }));
  const test = shuffled.slice(splitIdx).map(p => ({ ...p, isTest: true }));

  return { train, test, all: [...train, ...test] };
}
