import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  calculateLayerParameters, 
  validateNetworkTopology, 
  forwardPassWalkthrough, 
  detectInactiveReLUs, 
  verifyGradientsWithFiniteDifference 
} from '../client/src/ml/neuralDiagnostics.js';

test('Phase 8: Parameter counting and topology validation accurately computes dense layer shapes', () => {
  const { weightCount, biasCount, totalCount } = calculateLayerParameters(3, 5);
  assert.equal(weightCount, 15);
  assert.equal(biasCount, 5);
  assert.equal(totalCount, 20);

  const layers = [
    { id: 'in', type: 'Input', units: 2 },
    { id: 'h1', type: 'Dense', units: 4, activation: 'ReLU' },
    { id: 'h2', type: 'Dense', units: 3, activation: 'ReLU' },
    { id: 'out', type: 'Output', units: 1, activation: 'Sigmoid' },
  ];

  const topology = validateNetworkTopology(layers);
  assert.equal(topology.isValid, true);
  // Layer h1: 2*4 + 4 = 12
  // Layer h2: 4*3 + 3 = 15
  // Layer out: 3*1 + 1 = 4
  // Total = 31
  assert.equal(topology.totalParameters, 31);
  assert.equal(topology.layers[1].paramCount, 12);
  assert.equal(topology.layers[2].paramCount, 15);
  assert.equal(topology.layers[3].paramCount, 4);
});

test('Phase 8: Forward pass walkthrough computes exact pre-activations and activations matching manual math', () => {
  const input = [1.0, 2.0];
  const weightsAndBiases = [
    {
      weights: [
        [0.5, -0.5],
        [1.0,  0.5],
      ],
      biases: [0.1, -1.5],
    },
    {
      weights: [
        [0.8],
        [-0.4],
      ],
      biases: [0.2],
    },
  ];

  const layerConfigs = [
    { type: 'Input', units: 2 },
    { type: 'Dense', units: 2, activation: 'ReLU' },
    { type: 'Output', units: 1, activation: 'Linear' },
  ];

  const { steps, prediction } = forwardPassWalkthrough(input, weightsAndBiases, layerConfigs);

  // Hidden layer pre-activations:
  // z0 = 1.0 * 0.5 + 2.0 * 1.0 + 0.1 = 0.5 + 2.0 + 0.1 = 2.6
  // z1 = 1.0 * (-0.5) + 2.0 * 0.5 + (-1.5) = -0.5 + 1.0 - 1.5 = -1.0
  assert.ok(Math.abs(steps[1].preActivations[0] - 2.6) < 1e-6);
  assert.ok(Math.abs(steps[1].preActivations[1] - (-1.0)) < 1e-6);

  // Hidden layer activations (ReLU):
  // a0 = max(0, 2.6) = 2.6
  // a1 = max(0, -1.0) = 0.0
  assert.ok(Math.abs(steps[1].activations[0] - 2.6) < 1e-6);
  assert.ok(Math.abs(steps[1].activations[1] - 0.0) < 1e-6);

  // Output layer pre-activations and activations (Linear):
  // z_out = 2.6 * 0.8 + 0.0 * (-0.4) + 0.2 = 2.08 + 0.2 = 2.28
  assert.ok(Math.abs(prediction[0] - 2.28) < 1e-6);
});

test('Phase 8: Inactive ReLU diagnostics detects permanently dead neurons across sample batch', () => {
  // Neuron 0 has large negative bias and zero weights -> always <= -10 -> always ReLU 0
  const weightsAndBiases = [
    {
      weights: [
        [0.0, 1.0],
        [0.0, 1.0],
      ],
      biases: [-10.0, 0.5],
    },
  ];

  const layerConfigs = [
    { type: 'Input', units: 2 },
    { type: 'Dense', units: 2, activation: 'ReLU' },
  ];

  const samples = [
    [0.1, 0.2],
    [0.5, 0.5],
    [-0.5, -0.5],
    [1.0, 1.0],
  ];

  const reluStats = detectInactiveReLUs(samples, weightsAndBiases, layerConfigs);
  assert.equal(reluStats.length, 1);
  assert.equal(reluStats[0].hasDeadNeurons, true);
  assert.equal(reluStats[0].deadNeurons.length, 1);
  assert.equal(reluStats[0].deadNeurons[0].neuronIndex, 0);
  assert.equal(reluStats[0].deadNeurons[0].inactiveRate, 1.0);
});

test('Phase 8: Analytical backprop matches finite-difference numerical gradients within tolerance (< 1e-3)', () => {
  const sampleX = [0.6, -0.4];
  const sampleY = 1.0;

  const weightsAndBiases = [
    {
      weights: [
        [0.3, -0.2],
        [-0.4, 0.5],
      ],
      biases: [0.1, 0.2],
    },
    {
      weights: [
        [0.7],
        [-0.6],
      ],
      biases: [-0.1],
    },
  ];

  const layerConfigs = [
    { type: 'Input', units: 2 },
    { type: 'Dense', units: 2, activation: 'ReLU' },
    { type: 'Output', units: 1, activation: 'Sigmoid' },
  ];

  const result = verifyGradientsWithFiniteDifference(
    sampleX, 
    sampleY, 
    weightsAndBiases, 
    layerConfigs, 
    1e-5
  );

  assert.equal(result.isGradientValid, true);
  assert.ok(result.maxRelativeDifference < 1e-3);
  assert.ok(result.loss > 0);
});
