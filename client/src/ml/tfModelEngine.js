import * as tf from '@tensorflow/tfjs';

// Compile a sequential model from user-defined layer specifications
export function buildTFModel(layerSpecs, learningRate = 0.03) {
  const model = tf.sequential();

  const hiddenAndOutputLayers = layerSpecs.filter((l) => l.type !== 'Input');

  hiddenAndOutputLayers.forEach((layer, idx) => {
    const isFirstLayer = idx === 0;
    const config = {
      units: layer.units,
      activation: layer.activation.toLowerCase(),
      kernelInitializer: 'glorotNormal',
      biasInitializer: 'zeros',
    };

    if (isFirstLayer) {
      config.inputShape = [2]; // 2D coordinates (x1, x2)
    }

    model.add(tf.layers.dense(config));
  });

  model.compile({
    optimizer: tf.train.adam(learningRate),
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
  if (!trainPoints || trainPoints.length === 0) return null;

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

  try {
    await model.fit(trainX, trainY, {
      epochs,
      batchSize: Math.min(batchSize, trainPoints.length),
      validationData: valX && valY ? [valX, valY] : undefined,
      shuffle: true,
      callbacks: {
        onEpochEnd: async (epoch, logs) => {
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
              valLoss: logs.val_loss ? Number(logs.val_loss.toFixed(4)) : null,
              valAccuracy: logs.val_acc ? Number(logs.val_acc.toFixed(4)) : null,
              weights: weightsSnapshot,
            });
          }

          if (onEpochEndCallback) {
            onEpochEndCallback(epoch + 1, {
              loss: Number((logs.loss || 0).toFixed(4)),
              accuracy: Number((logs.acc || logs.accuracy || 0).toFixed(4)),
              valLoss: logs.val_loss ? Number(logs.val_loss.toFixed(4)) : null,
              valAccuracy: logs.val_acc ? Number(logs.val_acc.toFixed(4)) : null,
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
      const y = max - gy * step; // Inverted for image coordinate space
      for (let gx = 0; gx < resolution; gx++) {
        const x = min + gx * step;
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
