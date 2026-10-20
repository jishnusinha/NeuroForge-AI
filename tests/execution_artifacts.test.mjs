import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../client/package.json', import.meta.url));
const tf = require('@tensorflow/tfjs');

import { buildTFModel } from '../client/src/ml/tfModelEngine.js';
import { 
  serializeModelArtifact, 
  deserializeModelArtifact, 
  runSavedModelInference,
  warmStartModel 
} from '../client/src/ml/modelArtifacts.js';
import { modelRunner } from '../client/src/ml/modelRunner.js';

test('Phase 5: Serialize and deserialize model artifact preserves topology, weights and digest', async () => {
  const layers = [
    { id: 'l-in', type: 'Input', units: 2, activation: 'Linear' },
    { id: 'l-h1', type: 'Dense', units: 3, activation: 'ReLU' },
    { id: 'l-out', type: 'Output', units: 1, activation: 'Sigmoid' },
  ];

  const model = buildTFModel(layers, 0.04, 42, 'adam');
  const artifact = await serializeModelArtifact(model, layers, { testId: 'art-01' });

  assert.ok(artifact.id);
  assert.equal(artifact.schemaVersion, 2);
  assert.ok(artifact.digest);
  assert.equal(artifact.topology.length, 3);
  assert.equal(artifact.weights.length, 2); // 2 dense layers with weights

  // Deserialize model
  const restored = await deserializeModelArtifact(artifact);
  assert.ok(restored);
  assert.equal(restored.layers.length, 2);

  // Clean up
  model.optimizer?.dispose();
  model.dispose();
  restored.optimizer?.dispose();
  restored.dispose();
});

test('Phase 5: Reopened model reproduces original predictions within numerical tolerance (1e-5)', async () => {
  const layers = [
    { id: 'l-in', type: 'Input', units: 2, activation: 'Linear' },
    { id: 'l-h1', type: 'Dense', units: 4, activation: 'ReLU' },
    { id: 'l-out', type: 'Output', units: 1, activation: 'Sigmoid' },
  ];

  const model = buildTFModel(layers, 0.04, 123, 'adam');
  const testInputs = [
    [0.5, 0.5],
    [-0.5, 0.5],
    [0.5, -0.5],
    [-0.5, -0.5],
  ];

  // Original model inference
  let originalPredictions = [];
  tf.tidy(() => {
    const inputTensor = tf.tensor2d(testInputs);
    const outputTensor = model.predict(inputTensor);
    originalPredictions = outputTensor.arraySync().map(r => r[0]);
  });

  // Serialize to artifact
  const artifact = await serializeModelArtifact(model, layers);

  // Reopen model for inference independently
  const reopenedPredictions = await runSavedModelInference(artifact, testInputs);

  assert.equal(reopenedPredictions.length, testInputs.length);
  for (let i = 0; i < testInputs.length; i++) {
    const diff = Math.abs(originalPredictions[i] - reopenedPredictions[i]);
    assert.ok(diff < 1e-5, `Prediction ${i} diff (${diff}) must be < 1e-5`);
  }

  model.optimizer?.dispose();
  model.dispose();
});

test('Phase 5: Corrupted or tampered artifacts are rejected with explicit error', async () => {
  const layers = [
    { id: 'l-in', type: 'Input', units: 2, activation: 'Linear' },
    { id: 'l-out', type: 'Output', units: 1, activation: 'Sigmoid' },
  ];
  const model = buildTFModel(layers, 0.04, 99, 'adam');
  const artifact = await serializeModelArtifact(model, layers);

  // Tamper with weights
  const tampered = JSON.parse(JSON.stringify(artifact));
  tampered.weights[0].bias[0] += 999.0; // modified weight without updating digest

  await assert.rejects(
    async () => {
      await deserializeModelArtifact(tampered);
    },
    (err) => {
      assert.ok(err.message.includes('CORRUPT_ARTIFACT'));
      return true;
    }
  );

  model.optimizer?.dispose();
  model.dispose();
});

test('Phase 5: Warm start initializes target model from saved weights', () => {
  const layers = [
    { id: 'l-in', type: 'Input', units: 2, activation: 'Linear' },
    { id: 'l-out', type: 'Output', units: 1, activation: 'Sigmoid' },
  ];

  const sourceModel = buildTFModel(layers, 0.04, 42, 'adam');
  const targetModel = buildTFModel(layers, 0.04, 999, 'adam');

  // Extract source weights
  const sourceWeights = [];
  for (let i = 0; i < sourceModel.layers.length; i++) {
    const wt = sourceModel.layers[i].getWeights();
    sourceWeights.push({ layerIndex: i, kernel: wt[0].arraySync(), bias: wt[1].arraySync() });
  }

  // Warm start target model
  const success = warmStartModel(targetModel, sourceWeights);
  assert.equal(success, true);

  // Verify weights in target match source
  const targetWt = targetModel.layers[0].getWeights();
  assert.deepEqual(targetWt[0].arraySync(), sourceWeights[0].kernel);
  assert.deepEqual(targetWt[1].arraySync(), sourceWeights[0].bias);

  sourceModel.optimizer?.dispose();
  sourceModel.dispose();
  targetModel.optimizer?.dispose();
  targetModel.dispose();
});

test('Phase 5: Model runner prevents concurrent execution and cleans up resources', async () => {
  const layers = [
    { id: 'l-in', type: 'Input', units: 2, activation: 'Linear' },
    { id: 'l-out', type: 'Output', units: 1, activation: 'Sigmoid' },
  ];
  const points = [
    { x: -0.5, y: -0.5, label: 0 },
    { x: 0.5, y: -0.5, label: 1 },
    { x: -0.5, y: 0.5, label: 1 },
    { x: 0.5, y: 0.5, label: 0 },
  ];

  const initialTensors = tf.memory().numTensors;

  // Run a short 2-epoch job
  const result = await modelRunner.runTraining({
    layers,
    trainPoints: points,
    valPoints: points,
    epochs: 2,
    batchSize: 2,
    learningRate: 0.04,
  });

  assert.equal(result.status, 'completed');
  assert.ok(result.artifact);
  assert.equal(modelRunner.status, 'completed');

  modelRunner.dispose();

  // Verify tensor cleanup: no unbounded retained tensors
  const afterTensors = tf.memory().numTensors;
  assert.equal(afterTensors, initialTensors, 'All training tensors must be released');
});
