/**
 * NeuroForge Model Artifacts & Persistence (Phase 5)
 * Serializes, validates, digests, and reconstructs trained TensorFlow.js models.
 */

import * as tf from '@tensorflow/tfjs';
import { buildTFModel } from './tfModelEngine.js';

import { digest as computeDigest } from '../../../shared/domain.mjs';

export async function serializeModelArtifact(model, layers, metadata = {}) {
  if (!model || !model.layers) {
    throw new Error('VALID_MODEL_REQUIRED');
  }

  const topology = layers.map((l) => ({
    id: l.id,
    type: l.type,
    units: l.units,
    activation: l.activation,
  }));

  const weights = [];
  for (let i = 0; i < model.layers.length; i++) {
    const layer = model.layers[i];
    const weightTensors = layer.getWeights();
    if (weightTensors.length >= 2) {
      const kernel = weightTensors[0].arraySync();
      const bias = weightTensors[1].arraySync();
      weights.push({ layerIndex: i, kernel, bias });
    }
  }

  const payloadToDigest = { topology, weights };
  const digest = await computeDigest(payloadToDigest);

  const artifact = {
    id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `art-${Date.now()}`,
    schemaVersion: 2,
    topology,
    weights,
    digest,
    metadata: {
      framework: 'tensorflow.js',
      backend: tf.getBackend(),
      createdAt: new Date().toISOString(),
      ...metadata,
    },
  };

  return artifact;
}

export async function deserializeModelArtifact(artifact, learningRate = 0.03, optimizer = 'adam') {
  if (!artifact || !artifact.topology || !artifact.weights || !artifact.digest) {
    throw new Error('INVALID_ARTIFACT_FORMAT');
  }

  // Integrity Check
  const payloadToDigest = { topology: artifact.topology, weights: artifact.weights };
  const computed = await computeDigest(payloadToDigest);
  if (computed !== artifact.digest) {
    throw new Error('CORRUPT_ARTIFACT: Digest verification failed.');
  }

  if (artifact.schemaVersion !== 2) throw new Error('UNSUPPORTED_ARTIFACT_VERSION');
  const model = buildTFModel(artifact.topology, learningRate, 42, optimizer);
  try {
  if (artifact.weights.length !== model.layers.length || artifact.weights.some((w,i)=>w.layerIndex!==i || !Array.isArray(w.kernel) || w.kernel.some(row=>!Array.isArray(row)||row.some(value=>!Number.isFinite(value))) || !Array.isArray(w.bias) || w.bias.some(value=>!Number.isFinite(value)))) throw new Error('INCOMPATIBLE_ARTIFACT_LAYERS');
  // Inject restored weights
  tf.tidy(() => {
    artifact.weights.forEach((w) => {
      if (model.layers[w.layerIndex]) {
        const kTensor = tf.tensor2d(w.kernel);
        const bTensor = tf.tensor1d(w.bias);
        model.layers[w.layerIndex].setWeights([kTensor, bTensor]);
      }
    });
  });

  return model;
  } catch(error) { model.optimizer?.dispose(); model.dispose(); throw error; }
}

export async function runSavedModelInference(artifact, sampleInputs) {
  const model = await deserializeModelArtifact(artifact);
  try {
    return tf.tidy(() => {
      const input=tf.tensor2d(sampleInputs);
      return model.predict(input).arraySync().map(row=>row[0]);
    });
  } finally { model.optimizer?.dispose(); model.dispose(); }
}

export function warmStartModel(targetModel, savedWeights) {
  if (!targetModel || !savedWeights) return false;

  tf.tidy(() => {
    savedWeights.forEach((w) => {
      const targetLayer = targetModel.layers[w.layerIndex];
      if (targetLayer) {
        const kTensor = tf.tensor2d(w.kernel);
        const bTensor = tf.tensor1d(w.bias);
        targetLayer.setWeights([kTensor, bTensor]);
      }
    });
  });

  return true;
}
