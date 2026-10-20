import * as tf from '@tensorflow/tfjs';

// Compile a sequential model from user-defined layer specifications
export function buildTFModel(layerSpecs, learningRate = 0.03, seed = 42, optimizer = 'adam') {
  if (!Array.isArray(layerSpecs) || layerSpecs.some(l=>!['Linear','ReLU','Tanh','Sigmoid'].includes(l.activation)) || !Number.isFinite(learningRate) || learningRate <= 0 || !Number.isInteger(seed)) throw new Error('Invalid model configuration.');
  if (layerSpecs.length < 2 || layerSpecs.length > 6 || layerSpecs[0].type !== 'Input' || layerSpecs[0].units !== 2 ||
    layerSpecs.at(-1).type !== 'Output' || layerSpecs.at(-1).units !== 1 || layerSpecs.at(-1).activation !== 'Sigmoid' ||
    layerSpecs.some(l => !Number.isInteger(l.units) || l.units < 1 || l.units > 16)) throw new Error('Use 2 inputs, up to four dense layers, and one sigmoid output.');
  const model = tf.sequential();

  const hiddenAndOutputLayers = layerSpecs.filter((l) => l.type !== 'Input');

  hiddenAndOutputLayers.forEach((layer, idx) => {
    const isFirstLayer = idx === 0;
    const config = {
      units: layer.units,
      activation: layer.activation.toLowerCase(),
      kernelInitializer: tf.initializers.glorotNormal({ seed: seed + idx }),
      biasInitializer: 'zeros',
    };

    if (isFirstLayer) {
      config.inputShape = [2]; // 2D coordinates (x1, x2)
    }

    model.add(tf.layers.dense(config));
  });

  model.compile({
    optimizer: optimizer === 'sgd' ? tf.train.sgd(learningRate) : optimizer === 'momentum' ? tf.train.momentum(learningRate, 0.9) : tf.train.adam(learningRate),
    loss: 'binaryCrossentropy',
    metrics: ['accuracy'],
  });

  return model;
}

// Train model asynchronously with per-epoch callbacks and checkpoint capture
export async function trainTFModel(
  model,
  trainPoints,
  valPoints = [],
  epochs = 60,
  batchSize = 16,
  onEpochEndCallback = null,
  shouldStopRef = { current: false }
) {
  if (!trainPoints || trainPoints.length < 2 || trainPoints.length + valPoints.length > 2000 ||
    new Set(trainPoints.map(p => p.label)).size !== 2 ||
    [...trainPoints,...valPoints].some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y) || ![0,1].includes(p.label)) ||
    !Number.isInteger(epochs) || epochs < 1 || epochs > 500 || !Number.isInteger(batchSize) || batchSize < 1 || batchSize > 128) {
    throw new Error('Use 2–2000 finite binary samples with both training classes, 1–500 epochs, and batch size 1–128.');
  }

  // Prepare input tensors
  const trainXArr = trainPoints.map((p) => [p.x, p.y]);
  const trainYArr = trainPoints.map((p) => [p.label]);

  const trainX = tf.tensor2d(trainXArr);
  const trainY = tf.tensor2d(trainYArr);

  let valX = null;
  let valY = null;
  if (valPoints.length > 0) {
    valX = tf.tensor2d(valPoints.map((p) => [p.x, p.y]));
    valY = tf.tensor2d(valPoints.map((p) => [p.label]));
  }

  const checkpoints = [];
  model.stopTraining = false;

  try {
    await model.fit(trainX, trainY, {
      epochs,
      batchSize: Math.min(batchSize, trainPoints.length),
      validationData: valX && valY ? [valX, valY] : undefined,
      shuffle: false,
      callbacks: {
        onEpochEnd: async (epoch, logs) => {
          if (!Number.isFinite(logs.loss)) { model.stopTraining = true; throw new Error('Training diverged. Reduce the learning rate.'); }
          if (shouldStopRef.current) {
            model.stopTraining = true;
          }

          // Capture weights snapshot periodically
          if (epoch % 5 === 0 || epoch === epochs - 1) {
            const weightsSnapshot = extractModelWeights(model);
            checkpoints.push({
              epoch: epoch + 1,
              loss: Number((logs.loss || 0).toFixed(4)),
              accuracy: Number((logs.acc || logs.accuracy || 0).toFixed(4)),
              valLoss: logs.val_loss != null ? Number(logs.val_loss.toFixed(4)) : null,
              valAccuracy: logs.val_acc != null ? Number(logs.val_acc.toFixed(4)) : null,
              weights: weightsSnapshot,
            });
          }

          if (onEpochEndCallback) {
            onEpochEndCallback(epoch + 1, {
              loss: Number((logs.loss || 0).toFixed(4)),
              accuracy: Number((logs.acc || logs.accuracy || 0).toFixed(4)),
              valLoss: logs.val_loss != null ? Number(logs.val_loss.toFixed(4)) : null,
              valAccuracy: logs.val_acc != null ? Number(logs.val_acc.toFixed(4)) : null,
            });
          }

          // Allow UI rendering frame
          await tf.nextFrame();
        },
      },
    });
  } finally {
    trainX.dispose();
    trainY.dispose();
    if (valX) valX.dispose();
    if (valY) valY.dispose();
  }

  return checkpoints;
}

// Extract weights and biases across all layers for inspection
export function extractModelWeights(model) {
  return model.layers.map((layer) => {
    const weights = layer.getWeights();
    if (!weights || weights.length < 2) return { kernel: [], bias: [] };
    const kernel = weights[0].arraySync();
    const bias = weights[1].arraySync();
    return { kernel, bias };
  });
}

// Forward propagation inspection: Computes activations for each layer on a single sample [x, y]
export function inspectForwardPass(model, samplePoint = [0, 0]) {
  return tf.tidy(() => {
    const inputTensor = tf.tensor2d([samplePoint]);
    const activations = [];

    // Add input values
    activations.push({
      layerIndex: 0,
      name: 'Input Layer',
      values: [...samplePoint],
    });

    let currentTensor = inputTensor;
    model.layers.forEach((layer, idx) => {
      currentTensor = layer.apply(currentTensor);
      const vals = currentTensor.arraySync()[0];
      activations.push({
        layerIndex: idx + 1,
        name: `Layer ${idx + 1} (${layer.name})`,
        values: Array.isArray(vals) ? vals : [vals],
      });
    });

    return activations;
  });
}

// Predict probability meshgrid for 2D decision boundary rendering
export function predictGridSurface(model, resolution = 20, min = -2.5, max = 2.5) {
  if (!model) return null;

  return tf.tidy(() => {
    const step = (max - min) / resolution;
    const gridPoints = [];

    for (let gy = 0; gy < resolution; gy++) {
      const y = max - (gy + 0.5) * step; // Predict at the center of each rendered cell.
      for (let gx = 0; gx < resolution; gx++) {
        const x = min + (gx + 0.5) * step;
        gridPoints.push([x, y]);
      }
    }

    const inputTensor = tf.tensor2d(gridPoints);
    const predictions = model.predict(inputTensor);
    const predArr = predictions.arraySync();

    const grid = [];
    for (let gy = 0; gy < resolution; gy++) {
      const row = [];
      for (let gx = 0; gx < resolution; gx++) {
        const idx = gy * resolution + gx;
        row.push(predArr[idx][0]);
      }
      grid.push(row);
    }

    return { grid, resolution, min, max, step };
  });
}
