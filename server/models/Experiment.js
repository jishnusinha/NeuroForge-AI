import mongoose from 'mongoose';

const ExperimentSchema = new mongoose.Schema(
  {
    shareId: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    ownerId: {
      type: String,
      default: 'guest-session',
      index: true,
    },
    algorithm: {
      type: String,
      required: true,
    },
    workspace: { type: String, enum: ['studio', 'playground'] },
    task: { type: String, enum: ['classification', 'regression', 'clustering'] },
    runtime: mongoose.Schema.Types.Mixed,
    modelArtifact: mongoose.Schema.Types.Mixed,
    schemaVersion: Number,
    runId: { type: String, unique: true, sparse: true },
    parentRunId: String,
    evaluation: mongoose.Schema.Types.Mixed,
    domain: mongoose.Schema.Types.Mixed,
    dataset: {
      name: { type: String, required: true },
      sampleCount: { type: Number, default: 200 },
      noise: { type: Number, default: 0.15 },
      trainRatio: { type: Number, default: 0.8 },
      seed: { type: Number, default: 42 },
      fingerprint: String,
      splitFingerprint: String,
      preprocessing: String,
      preparation: mongoose.Schema.Types.Mixed,
      points: [{ _id: false, id: String, x: Number, y: Number, label: Number }],
    },
    hyperparameters: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    metrics: {
      trainLoss: Number,
      valLoss: Number,
      trainAccuracy: Number,
      valAccuracy: Number,
      r2: Number,
      mse: Number,
      testMse: Number,
      inertia: Number,
      iterations: Number,
      confusion: mongoose.Schema.Types.Mixed,
    },
    metricHistory: [
      {
        epoch: Number,
        loss: Number,
        accuracy: Number,
        valLoss: Number,
        valAccuracy: Number,
      },
    ],
    status: {
      type: String,
      enum: ['Ready', 'Running', 'Completed', 'Failed'],
      default: 'Completed',
    },
  },
  {
    timestamps: true,
  }
);

export const Experiment = mongoose.models.Experiment || mongoose.model('Experiment', ExperimentSchema);
