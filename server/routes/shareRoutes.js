import express from 'express';
import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { ShareLink } from '../models/ShareLink.js';
import { Experiment } from '../models/Experiment.js';
import { Project } from '../models/Project.js';
import { safeResource } from '../identity.js';


export function createShareRouter({ authRouter, allowMemoryFallback = false, resolveRun, resolveProject } = {}) {
  const router = express.Router();
  const memoryShares = new Map();
  router.migrateOwner=(from,to)=>{for(const share of memoryShares.values())if(share.ownerId===from)share.ownerId=to;};
  const isDbReady = () => mongoose.connection.readyState === 1;
  router.get('/', async (req,res) => {
    try {
      const auth=req.identity;
      if(!auth)return res.status(401).json({code:'IDENTITY_REQUIRED',error:'Identity required.'});
      const caller=auth.type==='user'?auth.userId:auth.ownerId;
      if(!isDbReady()&&!allowMemoryFallback)return res.status(503).json({code:'STORAGE_UNAVAILABLE',error:'Database unavailable.'});
      const records=isDbReady()?await ShareLink.find({ownerId:caller,isRevoked:false}).sort({createdAt:-1}).limit(100).select('-snapshot -ownerId').lean():[...memoryShares.values()].filter(share=>share.ownerId===caller&&!share.isRevoked);
      res.json({data:records.map(record=>{const {snapshot,ownerId,...metadata}=record;return metadata;})});
    }catch{res.status(500).json({code:'SHARE_LIST_FAILED',error:'Unable to list owned shares.'});}
  });

  // Create explicit scoped share link (requires ownership)
  router.post('/', async (req, res) => {
    try {
      const auth = authRouter ? await authRouter.resolveAuth(req) : null;
      if (!auth) {
        return res.status(401).json({ code: 'IDENTITY_REQUIRED', error: 'Authentication or guest identity required.' });
      }
      const callerId = auth.type === 'user' ? auth.userId : auth.ownerId;

      const { resourceType, resourceId, expiresInHours } = req.body;
      if (!resourceType || !['run', 'project'].includes(resourceType) || !resourceId) {
        return res.status(400).json({ code: 'INVALID_SHARE_REQUEST', error: 'resourceType (run|project) and resourceId required.' });
      }

      const resource = resourceType === 'run' ? await resolveRun?.(resourceId) : await resolveProject?.(resourceId);
      if (!resource || resource.ownerId !== callerId) return res.status(404).json({ code: 'NOT_FOUND', error: 'Resource not found or unauthorized.' });
      if (expiresInHours !== undefined && (!Number.isFinite(Number(expiresInHours)) || Number(expiresInHours) <= 0 || Number(expiresInHours) > 8760)) return res.status(400).json({ code: 'INVALID_EXPIRY', error: 'Expiry must be between zero and 8760 hours.' });
      const shareId = `share-${crypto.randomUUID()}`;
      const expiresAt = expiresInHours && Number(expiresInHours) > 0 
        ? new Date(Date.now() + Number(expiresInHours) * 60 * 60 * 1000) 
        : null;

      const shareDoc = {
        shareId,
        resourceType,
        resourceId,
        snapshot: safeResource(resource),
        ownerId: callerId,
        scope: 'read-only',
        expiresAt,
        isRevoked: false,
        accessCount: 0,
        createdAt: new Date().toISOString(),
      };

      if (isDbReady()) {
        await ShareLink.create(shareDoc);
      } else if (allowMemoryFallback) {
        memoryShares.set(shareId, shareDoc);
      } else {
        return res.status(503).json({ code: 'STORAGE_UNAVAILABLE', error: 'Database unavailable.' });
      }

      return res.status(201).json({
        data: {
          shareId,
          resourceType,
          resourceId,
          scope: 'read-only',
          expiresAt: expiresAt ? expiresAt.toISOString() : null,
        },
      });
    } catch {
      return res.status(500).json({ code: 'SHARE_CREATE_FAILED', error: 'Failed to create share link.' });
    }
  });

  // Access public snapshot via shareId
  router.get('/:shareId', async (req, res) => {
    try {
      let share = null;
      if (isDbReady()) {
        share = await ShareLink.findOne({ shareId: req.params.shareId });
      } else if (allowMemoryFallback) {
        share = memoryShares.get(req.params.shareId);
      }

      if (!share) {
        return res.status(404).json({ code: 'SHARE_NOT_FOUND', error: 'Share link not found.' });
      }

      if (share.isRevoked) {
        return res.status(410).json({ code: 'SHARE_REVOKED', error: 'This share link has been revoked by the owner.' });
      }

      if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
        return res.status(410).json({ code: 'SHARE_EXPIRED', error: 'This share link has expired.' });
      }

      const resource = share.snapshot;
      if (isDbReady()) await ShareLink.updateOne({ shareId: share.shareId }, { $inc: { accessCount: 1 } });
      if (!resource) {
        return res.status(404).json({ code: 'RESOURCE_NOT_FOUND', error: 'Shared resource no longer exists.' });
      }

      return res.json({
        data: safeResource(resource),
        scope: share.scope,
        expiresAt: share.expiresAt,
      });
    } catch {
      return res.status(500).json({ code: 'SHARE_READ_FAILED', error: 'Failed to access share link.' });
    }
  });

  // Revoke share link (owner only)
  router.delete('/:shareId', async (req, res) => {
    try {
      const auth = authRouter ? await authRouter.resolveAuth(req) : null;
      if (!auth) {
        return res.status(401).json({ code: 'IDENTITY_REQUIRED', error: 'Authentication required.' });
      }
      const callerId = auth.type === 'user' ? auth.userId : auth.ownerId;

      if (isDbReady()) {
        const updated = await ShareLink.findOneAndUpdate(
          { shareId: req.params.shareId, ownerId: callerId },
          { $set: { isRevoked: true } },
          { new: true }
        );
        if (!updated) return res.status(404).json({ code: 'NOT_FOUND', error: 'Share link not found or unauthorized.' });
      } else if (allowMemoryFallback) {
        const share = memoryShares.get(req.params.shareId);
        if (!share || share.ownerId !== callerId) {
          return res.status(404).json({ code: 'NOT_FOUND', error: 'Share link not found or unauthorized.' });
        }
        share.isRevoked = true;
      }

      return res.json({ success: true, revoked: true });
    } catch {
      return res.status(500).json({ code: 'REVOKE_FAILED', error: 'Failed to revoke share link.' });
    }
  });

  return router;
}
