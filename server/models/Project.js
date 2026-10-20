import mongoose from 'mongoose';

const ProjectSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    ownerId: {
      type: String,
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
    tags: {
      type: [String],
      default: [],
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    isTrashed: {
      type: Boolean,
      default: false,
      index: true,
    },
    trashedAt: {
      type: Date,
      default: null,
    },
    experiments: {
      type: [String],
      default: [],
    },
    visibility: {
      type: String,
      enum: ['private', 'shared'],
      default: 'private',
    },
  },
  { timestamps: true }
);

export const Project = mongoose.models.Project || mongoose.model('Project', ProjectSchema);
