/**
 * Deterministic 2-feature CART classifier for interactive browser experiments.
 * Training inputs must be selected outside this function; never fit on held-out labels.
 */
const gini = (positive, total) => {
  if (!total) return 0;
  const p = positive / total;
  return 2 * p * (1 - p);
};

export function trainDecisionTree(rows, { maxDepth = 3, minLeaf = 2 } = {}) {
  if (!Array.isArray(rows) || rows.length < 4) throw new Error('TREE_NEEDS_FOUR_TRAINING_ROWS');
  if (!Number.isInteger(maxDepth) || maxDepth < 1 || maxDepth > 5) throw new Error('INVALID_TREE_DEPTH');
  if (!Number.isInteger(minLeaf) || minLeaf < 1 || minLeaf > 20) throw new Error('INVALID_MIN_LEAF');
  if (rows.some(row => !Number.isFinite(row.x) || !Number.isFinite(row.y) || ![0, 1].includes(row.label))) {
    throw new Error('TREE_REQUIRES_FINITE_X_Y_BINARY_TARGET');
  }
  const importance = { x: 0, y: 0 };
  let nodeCount = 0;

  function grow(points, depth) {
    nodeCount++;
    const count = points.length;
    const positive = points.reduce((sum, item) => sum + item.label, 0);
    const impurity = gini(positive, count);
    const leaf = { type: 'leaf', depth, samples: count, positive,
      probability: positive / count, prediction: positive * 2 >= count ? 1 : 0, gini: impurity };
    if (depth >= maxDepth || count < minLeaf * 2 || impurity === 0) return leaf;
    let best = null;
    for (const feature of ['x','y']) {
      const ordered = points.slice().sort((a, b) => a[feature] - b[feature]);
      let leftPositive = 0;
      for (let i = 0; i < ordered.length - 1; i++) {
        leftPositive += ordered[i].label;
        const leftCount = i + 1, rightCount = count - leftCount;
        if (leftCount < minLeaf || rightCount < minLeaf || ordered[i][feature] === ordered[i+1][feature]) continue;
        const rightPositive = positive - leftPositive;
        const gain = impurity - (leftCount/count)*gini(leftPositive,leftCount)
          - (rightCount/count)*gini(rightPositive,rightCount);
        const threshold = (ordered[i][feature] / 2) + (ordered[i+1][feature] / 2);
        if (!Number.isFinite(threshold)) continue;
        // A zero-gain first split can still reveal interactions (e.g. XOR) one level deeper.
        // Prefer balanced partitions on ties to make that exploration deterministic.
        const balance = Math.abs(leftCount - rightCount);
        if (!best || gain > best.gain + 1e-12 ||
            (Math.abs(gain - best.gain) <= 1e-12 && balance < best.balance)) {
          best = { feature, threshold, gain, balance };
        }
      }
    }
    if (!best || (best.gain <= 1e-12 && depth >= maxDepth - 1)) return leaf;
    const left = points.filter(row => row[best.feature] <= best.threshold);
    const right = points.filter(row => row[best.feature] > best.threshold);
    if (left.length < minLeaf || right.length < minLeaf) return leaf;
    importance[best.feature] += count / rows.length * best.gain;
    return {
      type:'split', depth, samples:count, positive, probability:positive/count,
      gini:impurity, feature:best.feature, threshold:best.threshold, gain:best.gain,
      left:grow(left,depth+1), right:grow(right,depth+1),
    };
  }
  const root = grow(rows);
  const totalGain = importance.x + importance.y;
  return {
    algorithm:'CART-Gini', maxDepth, minLeaf, samples:rows.length, nodeCount, root,
    featureImportance: totalGain>0
      ? { x: importance.x/totalGain, y: importance.y/totalGain }
      : { x: 0, y: 0 },
  };
}

export function decisionTreeProbability(model, x, y) {
  if (!model?.root || !Number.isFinite(x) || !Number.isFinite(y)) throw new Error('TREE_INVALID_INFERENCE_INPUT');
  let node = model.root;
  while (node.type === 'split') node = (node.feature === 'x' ? x : y) <= node.threshold ? node.left : node.right;
  return node.probability;
}

export function evaluateDecisionTree(model, rows) {
  const valid = rows.filter(row => Number.isFinite(row.x) && Number.isFinite(row.y) && [0,1].includes(row.label));
  if (!valid.length) return { count:0,accuracy:null,confusion:null };
  const confusion = {tp:0,fp:0,tn:0,fn:0};
  for (const row of valid) {
    const predicted = decisionTreeProbability(model,row.x,row.y) >= .5 ? 1 : 0;
    const actual = row.label;
    if(predicted===1&&actual===1) confusion.tp++;
    else if(predicted===1) confusion.fp++;
    else if(actual===1) confusion.fn++;
    else confusion.tn++;
  }
  const accuracy=(confusion.tp+confusion.tn)/valid.length;
  return {count:valid.length,accuracy,confusion};
}

export function flattenTreeRules(root, prefix='') {
  if (!root) return [];
  if (root.type==='leaf') return [{rule:prefix || 'All observations',samples:root.samples,probability:root.probability,prediction:root.prediction}];
  const label = `${root.feature} ≤ ${Number(root.threshold.toFixed(4))}`;
  return [
    ...flattenTreeRules(root.left,[prefix,label].filter(Boolean).join(' AND ')),
    ...flattenTreeRules(root.right,[prefix,`${root.feature} > ${Number(root.threshold.toFixed(4))}`].filter(Boolean).join(' AND ')),
  ];
}
