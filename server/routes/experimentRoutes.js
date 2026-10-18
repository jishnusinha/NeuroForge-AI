import express from 'express';
import mongoose from 'mongoose';
import { Experiment } from '../models/Experiment.js';

const router = express.Router();

// Fallback in-memory database store
let inMemoryStore = [
  {
    _id: 'exp-01',
    shareId: 'rep-xor-benchmark',
    name: 'XOR Non-Linearity Benchmark',
    description: 'Empirical verification of why multi-layer networks solve non-linearly separable patterns.',
    ownerId: 'guest-session',
    algorithm: 'Dense MLP (2-4-1)',
    dataset: {
      name: 'XOR Problem',
      sampleCount: 180,
      noise: 0.12,
      trainRatio: 0.8,
      seed: 42,
    },
    hyperparameters: {
      learningRate: 0.04,
      epochs: 60,
      batchSize: 16,
      layers: [
        { type: 'Input', units: 2, activation: 'Linear' },
        { type: 'Dense', units: 4, activation: 'ReLU' },
        { type: 'Output', units: 1, activation: 'Sigmoid' },
      ],
    },
    metrics: {
      trainLoss: 0.012,
      valLoss: 0.018,
      trainAccuracy: 1.0,
      valAccuracy: 1.0,
    },
    metricHistory: [
      { epoch: 10, loss: 0.54, accuracy: 0.65 },
      { epoch: 20, loss: 0.38, accuracy: 0.85 },
      { epoch: 30, loss: 0.18, accuracy: 0.95 },
      { epoch: 40, loss: 0.08, accuracy: 1.0 },
      { epoch: 50, loss: 0.03, accuracy: 1.0 },
      { epoch: 60, loss: 0.012, accuracy: 1.0 },
    ],
    status: 'Completed',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    _id: 'exp-02',
    shareId: 'rep-kmeans-voronoi',
    name: 'K-Means Voronoi Clustering',
    description: 'Centroid movement dynamics on three multi-modal Gaussian blobs.',
    ownerId: 'guest-session',
    algorithm: 'K-Means Clustering',
    dataset: {
      name: 'Gaussian Blobs',
      sampleCount: 210,
      noise: 0.15,
      trainRatio: 1.0,
      seed: 42,
    },
    hyperparameters: {
      k: 3,
      metric: 'Euclidean',
      maxIterations: 15,
    },
    metrics: {
      inertia: 42.8,
      iterations: 6,
    },
    status: 'Completed',
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    _id: 'exp-03',
    shareId: 'rep-moons-capacity',
    name: 'Two Moons Capacity vs Overfitting',
    description: 'Deep neural network memorization vs regularized model tradeoff.',
    ownerId: 'guest-session',
    algorithm: 'Deep MLP (2-16-16-1)',
    dataset: {
      name: 'Two Moons',
      sampleCount: 220,
      noise: 0.3,
      trainRatio: 0.8,
      seed: 42,
    },
    hyperparameters: {
      learningRate: 0.05,
      epochs: 80,
    },
    metrics: {
      trainLoss: 0.08,
      valLoss: 0.39,
      trainAccuracy: 0.99,
      valAccuracy: 0.946,
    },
    status: 'Completed',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

function isMongoConnected() {
  return mongoose.connection.readyState === 1;
}

// 1. List all experiments
router.get('/', async (req, res) => {
  try {
    if (isMongoConnected()) {
      let dbExperiments = await Experiment.find().sort({ createdAt: -1 }).limit(50);
      if (dbExperiments.length === 0) {
        // Seed default benchmarks
        const cleanSeed = inMemoryStore.map(({ _id, ...rest }) => rest);
        dbExperiments = await Experiment.insertMany(cleanSeed);
      }
      return res.json({ success: true, count: dbExperiments.length, data: dbExperiments });
    }
    res.json({ success: true, count: inMemoryStore.length, data: inMemoryStore });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, data: inMemoryStore });
  }
});

// 2. Get single experiment by ID or ShareID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (isMongoConnected() && mongoose.Types.ObjectId.isValid(id)) {
      const exp = await Experiment.findById(id);
      if (exp) return res.json({ success: true, data: exp });
    }
    const memExp = inMemoryStore.find((e) => e._id === id || e.shareId === id);
    if (memExp) return res.json({ success: true, data: memExp });

    res.status(404).json({ success: false, message: 'Experiment not found' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Save new experiment run
router.post('/', async (req, res) => {
  try {
    const { name, description, algorithm, dataset, hyperparameters, metrics, metricHistory } = req.body;
    const shareId = `rep-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

    const newExperimentData = {
      shareId,
      name: name || 'Untitled Experiment Run',
      description: description || '',
      ownerId: req.body.ownerId || 'guest-session',
      algorithm: algorithm || 'Generic Model',
      dataset: dataset || { name: 'Synthetic', sampleCount: 200, noise: 0.15, trainRatio: 0.8, seed: 42 },
      hyperparameters: hyperparameters || {},
      metrics: metrics || {},
      metricHistory: Array.isArray(metricHistory) ? metricHistory.slice(0, 100) : [],
      status: 'Completed',
    };

    if (isMongoConnected()) {
      const savedDoc = await Experiment.create(newExperimentData);
      return res.status(201).json({ success: true, data: savedDoc });
    }

    // Fallback store in memory
    const memoryItem = {
      _id: `exp-${Date.now()}`,
      ...newExperimentData,
      createdAt: new Date().toISOString(),
    };
    inMemoryStore.unshift(memoryItem);
    res.status(201).json({ success: true, data: memoryItem });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Delete experiment
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (isMongoConnected() && mongoose.Types.ObjectId.isValid(id)) {
      await Experiment.findByIdAndDelete(id);
    }
    inMemoryStore = inMemoryStore.filter((e) => e._id !== id && e.shareId !== id);
    res.json({ success: true, message: 'Experiment deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
