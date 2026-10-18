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
    dataset: {
      name: { type: String, required: true },
      sampleCount: { type: Number, default: 200 },
      noise: { type: Number, default: 0.15 },
      trainRatio: { type: Number, default: 0.8 },
      seed: { type: Number, default: 42 },
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
