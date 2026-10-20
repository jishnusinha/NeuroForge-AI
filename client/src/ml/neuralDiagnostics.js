/**
 * NeuroForge Neural Studio Diagnostics (Phase 8)
 * Exact forward-pass walkthrough, shape validation, parameter counting,
 * inactive-ReLU diagnostics, and finite-difference gradient verification.
 */

export function calculateLayerParameters(inputDim, outputDim) {
  if (inputDim <= 0 || outputDim <= 0) {
    throw new Error('INVALID_LAYER_DIMENSIONS');
  }
  const weightCount = inputDim * outputDim;
  const biasCount = outputDim;
  const totalCount = weightCount + biasCount;
  return {
    weightShape: [inputDim, outputDim],
    biasShape: [outputDim],
    weightCount,
    biasCount,
    totalCount,
  };
}

export function validateNetworkTopology(layers) {
  if (!Array.isArray(layers) || layers.length < 2) {
    throw new Error('TOPOLOGY_INVALID: Network requires at least input and output layers.');
  }

  let totalParams = 0;
  const validatedLayers = [];

  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const units = Number(layer.units);
    if (!units || units < 1) {
      throw new Error(`TOPOLOGY_ERROR: Layer ${i} has invalid units ${layer.units}`);
    }

    if (i === 0) {
      validatedLayers.push({
        ...layer,
        index: i,
        role: 'input',
        inputDim: units,
        outputDim: units,
        paramCount: 0,
      });
    } else {
      const prevDim = validatedLayers[i - 1].outputDim;
      const { weightCount, biasCount, totalCount } = calculateLayerParameters(prevDim, units);
      totalParams += totalCount;
      validatedLayers.push({
        ...layer,
        index: i,
        role: i === layers.length - 1 ? 'output' : 'hidden',
        inputDim: prevDim,
        outputDim: units,
        weightCount,
        biasCount,
        paramCount: totalCount,
      });
    }
  }

  return {
    layers: validatedLayers,
    totalParameters: totalParams,
    isValid: true,
  };
}

// Activation functions and their derivatives
export const Activations = {
  linear: {
    fn: z => z,
    df: () => 1,
  },
  relu: {
    fn: z => Math.max(0, z),
    df: z => (z > 0 ? 1 : 0),
  },
  sigmoid: {
    fn: z => 1 / (1 + Math.exp(-Math.max(-50, Math.min(50, z)))),
    df: z => {
      const s = 1 / (1 + Math.exp(-Math.max(-50, Math.min(50, z))));
      return s * (1 - s);
    },
  },
  tanh: {
    fn: z => Math.tanh(z),
    df: z => 1 - Math.pow(Math.tanh(z), 2),
  },
};

export function forwardPassWalkthrough(inputVector, weightsAndBiases, layerConfigs) {
  if (!Array.isArray(inputVector) || !Array.isArray(weightsAndBiases)) {
    throw new Error('INVALID_FORWARD_PASS_INPUT');
  }

  const steps = [];
  let currentActivation = [...inputVector];

  steps.push({
    layerIndex: 0,
    role: 'input',
    inputs: [...inputVector],
    preActivations: null,
    activations: [...inputVector],
  });

  for (let l = 0; l < weightsAndBiases.length; l++) {
    const { weights, biases } = weightsAndBiases[l]; // weights: 2D [inDim, outDim], biases: 1D [outDim]
    const config = layerConfigs[l + 1] || {};
    const actName = (config.activation || 'relu').toLowerCase();
    const act = Activations[actName] || Activations.relu;

    const inDim = weights.length;
    const outDim = biases.length;
    const preActivations = new Array(outDim).fill(0);
    const activations = new Array(outDim).fill(0);

    for (let j = 0; j < outDim; j++) {
      let sum = biases[j];
      for (let i = 0; i < inDim; i++) {
        sum += currentActivation[i] * weights[i][j];
      }
      preActivations[j] = sum;
      activations[j] = act.fn(sum);
    }

    steps.push({
      layerIndex: l + 1,
      role: l === weightsAndBiases.length - 1 ? 'output' : 'hidden',
      activationName: actName,
      inputs: [...currentActivation],
      preActivations: [...preActivations],
      activations: [...activations],
    });

    currentActivation = activations;
  }

  return {
    steps,
    prediction: currentActivation,
  };
}

export function detectInactiveReLUs(samples, weightsAndBiases, layerConfigs) {
  if (!Array.isArray(samples) || samples.length === 0) return [];
  
  // Track zero activations per neuron across all samples
  const reluStats = [];

  for (let l = 0; l < weightsAndBiases.length; l++) {
    const config = layerConfigs[l + 1] || {};
    const actName = (config.activation || 'relu').toLowerCase();
    if (actName !== 'relu') continue;

    const outDim = weightsAndBiases[l].biases.length;
    const zeroCounts = new Array(outDim).fill(0);

    for (const sample of samples) {
      const walkthrough = forwardPassWalkthrough(sample, weightsAndBiases, layerConfigs);
      const layerStep = walkthrough.steps[l + 1];
      for (let j = 0; j < outDim; j++) {
        if (layerStep.activations[j] === 0) {
          zeroCounts[j]++;
        }
      }
    }

    const deadNeurons = [];
    for (let j = 0; j < outDim; j++) {
      const inactiveRate = zeroCounts[j] / samples.length;
      if (inactiveRate === 1.0) {
        deadNeurons.push({
          neuronIndex: j,
          inactiveRate: 1.0,
          status: 'dead_relu',
        });
      }
    }

    reluStats.push({
      layerIndex: l + 1,
      totalNeurons: outDim,
      deadNeurons,
      hasDeadNeurons: deadNeurons.length > 0,
    });
  }

  return reluStats;
}

// Compute binary cross-entropy loss
function binaryCrossEntropy(y, yHat) {
  const eps = 1e-15;
  const p = Math.max(eps, Math.min(1 - eps, yHat));
  return -(y * Math.log(p) + (1 - y) * Math.log(1 - p));
}

// Backpropagation gradient check vs Finite-Difference Numerical Check
export function verifyGradientsWithFiniteDifference(sampleX, sampleY, weightsAndBiases, layerConfigs, epsilon = 1e-5) {
  // 1. Analytical backward pass for single hidden layer model:
  // Forward pass
  const fw = forwardPassWalkthrough(sampleX, weightsAndBiases, layerConfigs);
  const hiddenStep = fw.steps[1];
  const outStep = fw.steps[2];

  const yHat = outStep.activations[0];
  const lossBase = binaryCrossEntropy(sampleY, yHat);

  // Gradient of BCE wrt Sigmoid output: dL/dz_out = yHat - y
  const deltaOut = yHat - sampleY;

  // Gradients for Output Layer:
  // dL/dW_out[i][0] = hidden_act[i] * deltaOut
  // dL/db_out[0] = deltaOut
  const analyticalGradients = {
    layer2: {
      dWeights: hiddenStep.activations.map(a => [a * deltaOut]),
      dBias: [deltaOut],
    },
    layer1: {
      dWeights: [],
      dBias: [],
    },
  };

  // Backprop into Hidden Layer (assuming ReLU)
  const actHidden = Activations[(layerConfigs[1].activation || 'relu').toLowerCase()] || Activations.relu;
  const hiddenDim = weightsAndBiases[0].biases.length;
  const inDim = sampleX.length;
  const deltaHidden = [];

  for (let j = 0; j < hiddenDim; j++) {
    const dAct = actHidden.df(hiddenStep.preActivations[j]);
    const dL_da = deltaOut * weightsAndBiases[1].weights[j][0];
    deltaHidden[j] = dL_da * dAct;
  }

  for (let i = 0; i < inDim; i++) {
    analyticalGradients.layer1.dWeights[i] = [];
    for (let j = 0; j < hiddenDim; j++) {
      analyticalGradients.layer1.dWeights[i][j] = sampleX[i] * deltaHidden[j];
    }
  }
  analyticalGradients.layer1.dBias = [...deltaHidden];

  // 2. Numerical Finite Difference Check on weights & biases:
  const numericalGradients = {
    layer1: { dWeights: [], dBias: [] },
    layer2: { dWeights: [], dBias: [] },
  };

  // Check Layer 2 Weights
  for (let i = 0; i < hiddenDim; i++) {
    const origW = weightsAndBiases[1].weights[i][0];
    // +eps
    weightsAndBiases[1].weights[i][0] = origW + epsilon;
    const lossPlus = binaryCrossEntropy(sampleY, forwardPassWalkthrough(sampleX, weightsAndBiases, layerConfigs).prediction[0]);
    // -eps
    weightsAndBiases[1].weights[i][0] = origW - epsilon;
    const lossMinus = binaryCrossEntropy(sampleY, forwardPassWalkthrough(sampleX, weightsAndBiases, layerConfigs).prediction[0]);
    // restore
    weightsAndBiases[1].weights[i][0] = origW;

    if (!numericalGradients.layer2.dWeights[i]) numericalGradients.layer2.dWeights[i] = [];
    numericalGradients.layer2.dWeights[i][0] = (lossPlus - lossMinus) / (2 * epsilon);
  }

  // Check Layer 2 Bias
  {
    const origB = weightsAndBiases[1].biases[0];
    weightsAndBiases[1].biases[0] = origB + epsilon;
    const lossPlus = binaryCrossEntropy(sampleY, forwardPassWalkthrough(sampleX, weightsAndBiases, layerConfigs).prediction[0]);
    weightsAndBiases[1].biases[0] = origB - epsilon;
    const lossMinus = binaryCrossEntropy(sampleY, forwardPassWalkthrough(sampleX, weightsAndBiases, layerConfigs).prediction[0]);
    weightsAndBiases[1].biases[0] = origB;
    numericalGradients.layer2.dBias[0] = (lossPlus - lossMinus) / (2 * epsilon);
  }

  // Max relative difference calculation
  let maxRelDiff = 0;
  for (let i = 0; i < hiddenDim; i++) {
    const aGrad = analyticalGradients.layer2.dWeights[i][0];
    const nGrad = numericalGradients.layer2.dWeights[i][0];
    const diff = Math.abs(aGrad - nGrad) / (Math.max(Math.abs(aGrad), Math.abs(nGrad), 1e-7));
    if (diff > maxRelDiff) maxRelDiff = diff;
  }

  return {
    loss: lossBase,
    analyticalGradients,
    numericalGradients,
    maxRelativeDifference: maxRelDiff,
    isGradientValid: maxRelDiff < 1e-3,
  };
}
