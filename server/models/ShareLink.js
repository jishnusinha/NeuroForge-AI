import mongoose from 'mongoose';

const ShareLinkSchema = new mongoose.Schema(
  {
    shareId: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    resourceType: {
      type: String,
      enum: ['run', 'project'],
      required: true,
    },
    resourceId: {
      type: String,
      required: true,
      index: true,
    },
    ownerId: {
      type: String,
      required: true,
      index: true,
    },
    snapshot: mongoose.Schema.Types.Mixed,
    scope: {
      type: String,
      enum: ['read-only'],
      default: 'read-only',
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    isRevoked: {
      type: Boolean,
      default: false,
      index: true,
    },
    accessCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export const ShareLink = mongoose.models.ShareLink || mongoose.model('ShareLink', ShareLinkSchema);
