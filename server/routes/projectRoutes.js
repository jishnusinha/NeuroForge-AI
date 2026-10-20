import express from 'express';
import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { Project } from '../models/Project.js';

export function createProjectRouter({ authRouter, allowMemoryFallback = false } = {}) {
  const router = express.Router();
  const memoryProjects = new Map();
  router.findResource = async id => mongoose.connection.readyState === 1 ? Project.findOne({ id }).lean() : memoryProjects.get(id);
  router.migrateOwner = (from, to) => { let count=0; for (const p of memoryProjects.values()) if (p.ownerId === from) { p.ownerId=to; count++; } return count; };

  const isDbReady = () => mongoose.connection.readyState === 1;

  // Authorization middleware
  router.use(async (req, res, next) => {
    const auth = req.identityResolved ? req.identity : authRouter ? await authRouter.resolveAuth(req) : null;
    if (!auth) {
      return res.status(401).json({ code: 'IDENTITY_REQUIRED', error: 'Authentication or guest identity required.' });
    }
    req.callerId = auth.type === 'user' ? auth.userId : auth.ownerId;
    req.callerType = auth.type;
    next();
  });

  // Create Project
  router.post('/', async (req, res) => {
    try {
      const { name, description = '', tags = [] } = req.body;
      if (!name || typeof name !== 'string' || !name.trim() || name.length>200 || typeof description!=='string' || description.length>5000 || !Array.isArray(tags) || tags.length>20 || tags.some(tag=>typeof tag!=='string'||tag.length>64)) {
        return res.status(400).json({ code: 'INVALID_PROJECT', error: 'Project name is required.' });
      }

      const id = crypto.randomUUID();
      const projectDoc = {
        id,
        ownerId: req.callerId,
        name: name.trim(),
        description: description.trim(),
        tags: Array.isArray(tags) ? tags.map(t => String(t).trim()).filter(Boolean) : [],
        isArchived: false,
        isTrashed: false,
        trashedAt: null,
        experiments: [],
        visibility: 'private',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (isDbReady()) {
        await Project.create(projectDoc);
      } else if (allowMemoryFallback) {
        memoryProjects.set(id, projectDoc);
      } else {
        return res.status(503).json({ code: 'STORAGE_UNAVAILABLE', error: 'Database unavailable.' });
      }

      return res.status(201).json({ data: projectDoc });
    } catch {
      return res.status(500).json({ code: 'PROJECT_CREATE_FAILED', error: 'Failed to create project.' });
    }
  });

  // List Projects (with search, archive filter, trash filter, and pagination)
  router.get('/', async (req, res) => {
    try {
      const { q, archived, trashed, page = 1, limit = 10 } = req.query;
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));

      const isArchived = archived === 'true';
      const isTrashed = trashed === 'true';

      let items = [];
      let total = 0;

      if (isDbReady()) {
        const query = {
          ownerId: req.callerId,
          isArchived,
          isTrashed,
        };

        if (q && typeof q === 'string') {
          const literal=q.trim().slice(0,200).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
          query.$or = [
            { name: { $regex: literal, $options: 'i' } },
            { tags: { $in: [new RegExp(literal, 'i')] } },
          ];
        }

        total = await Project.countDocuments(query);
        items = await Project.find(query)
          .sort({ updatedAt: -1 })
          .skip((pageNum - 1) * limitNum)
          .limit(limitNum)
          .lean();
      } else if (allowMemoryFallback) {
        let all = Array.from(memoryProjects.values()).filter(p => 
          p.ownerId === req.callerId && 
          p.isArchived === isArchived && 
          p.isTrashed === isTrashed
        );

        if (q && typeof q === 'string') {
          const lower = q.toLowerCase().trim();
          all = all.filter(p => p.name.toLowerCase().includes(lower) || p.tags.some(t => t.toLowerCase().includes(lower)));
        }

        total = all.length;
        all.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        items = all.slice((pageNum - 1) * limitNum, pageNum * limitNum);
      } else {
        return res.status(503).json({ code: 'STORAGE_UNAVAILABLE', error: 'Database unavailable.' });
      }

      return res.json({
        data: items,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum) || 1,
        },
      });
    } catch {
      return res.status(500).json({ code: 'READ_FAILED', error: 'Failed to list projects.' });
    }
  });

  // Get Project by ID
  router.get('/:id', async (req, res) => {
    try {
      let project = null;
      if (isDbReady()) {
        project = await Project.findOne({ id: req.params.id, ownerId: req.callerId }).lean();
      } else if (allowMemoryFallback) {
        const p = memoryProjects.get(req.params.id);
        if (p && p.ownerId === req.callerId) project = p;
      }

      if (!project) {
        return res.status(404).json({ code: 'NOT_FOUND', error: 'Project not found.' });
      }

      return res.json({ data: project });
    } catch {
      return res.status(500).json({ code: 'READ_FAILED', error: 'Failed to read project.' });
    }
  });

  // Update Project
  router.put('/:id', async (req, res) => {
    try {
      const { name, description, tags } = req.body;
      const updates = { updatedAt: new Date().toISOString() };
      if (name) updates.name = String(name).trim();
      if (description !== undefined) updates.description = String(description).trim();
      if (req.body.experiments !== undefined) {
        if (!Array.isArray(req.body.experiments) || req.body.experiments.length > 100 || req.body.experiments.some(id => typeof id !== 'string')) return res.status(400).json({ code:'INVALID_RUN_LINKS', error:'Supply at most 100 run IDs.' });
        for (const id of req.body.experiments) { const run=await router.resolveRun?.(id); if (!run || run.ownerId !== req.callerId) return res.status(404).json({code:'NOT_FOUND',error:'Linked run not found.'}); }
        updates.experiments=[...new Set(req.body.experiments)];
      }
      if (Array.isArray(tags)) updates.tags = tags.map(t => String(t).trim()).filter(Boolean);

      if (isDbReady()) {
        const updated = await Project.findOneAndUpdate(
          { id: req.params.id, ownerId: req.callerId },
          { $set: updates },
          { new: true }
        ).lean();
        if (!updated) return res.status(404).json({ code: 'NOT_FOUND', error: 'Project not found.' });
        return res.json({ data: updated });
      } else if (allowMemoryFallback) {
        const p = memoryProjects.get(req.params.id);
        if (!p || p.ownerId !== req.callerId) return res.status(404).json({ code: 'NOT_FOUND', error: 'Project not found.' });
        const merged = { ...p, ...updates };
        memoryProjects.set(p.id, merged);
        return res.json({ data: merged });
      }
      return res.status(503).json({ code: 'STORAGE_UNAVAILABLE', error: 'Database unavailable.' });
    } catch {
      return res.status(500).json({ code: 'UPDATE_FAILED', error: 'Failed to update project.' });
    }
  });

  // Archive Project
  router.post('/:id/archive', async (req, res) => {
    try {
      if (isDbReady()) {
        const p = await Project.findOneAndUpdate(
          { id: req.params.id, ownerId: req.callerId },
          { $set: { isArchived: true, updatedAt: new Date().toISOString() } },
          { new: true }
        ).lean();
        if (!p) return res.status(404).json({ code: 'NOT_FOUND', error: 'Project not found.' });
        return res.json({ data: p });
      } else if (allowMemoryFallback) {
        const p = memoryProjects.get(req.params.id);
        if (!p || p.ownerId !== req.callerId) return res.status(404).json({ code: 'NOT_FOUND', error: 'Project not found.' });
        p.isArchived = true;
        p.updatedAt = new Date().toISOString();
        return res.json({ data: p });
      }
      return res.status(503).json({ code: 'STORAGE_UNAVAILABLE', error: 'Database unavailable.' });
    } catch {
      return res.status(500).json({ code: 'ARCHIVE_FAILED', error: 'Failed to archive project.' });
    }
  });

  // Restore Project (from archive or trash)
  router.post('/:id/restore', async (req, res) => {
    try {
      if (isDbReady()) {
        const p = await Project.findOneAndUpdate(
          { id: req.params.id, ownerId: req.callerId },
          { $set: { isArchived: false, isTrashed: false, trashedAt: null, updatedAt: new Date().toISOString() } },
          { new: true }
        ).lean();
        if (!p) return res.status(404).json({ code: 'NOT_FOUND', error: 'Project not found.' });
        return res.json({ data: p });
      } else if (allowMemoryFallback) {
        const p = memoryProjects.get(req.params.id);
        if (!p || p.ownerId !== req.callerId) return res.status(404).json({ code: 'NOT_FOUND', error: 'Project not found.' });
        p.isArchived = false;
        p.isTrashed = false;
        p.trashedAt = null;
        p.updatedAt = new Date().toISOString();
        return res.json({ data: p });
      }
      return res.status(503).json({ code: 'STORAGE_UNAVAILABLE', error: 'Database unavailable.' });
    } catch {
      return res.status(500).json({ code: 'RESTORE_FAILED', error: 'Failed to restore project.' });
    }
  });

  // Soft Delete to Trash or Permanent Purge
  router.delete('/:id', async (req, res) => {
    try {
      const permanent = req.query.permanent === 'true';

      if (isDbReady()) {
        if (permanent) {
          const del = await Project.findOneAndDelete({ id: req.params.id, ownerId: req.callerId });
          if (!del) return res.status(404).json({ code: 'NOT_FOUND', error: 'Project not found.' });
          return res.json({ success: true, permanent: true });
        } else {
          const p = await Project.findOneAndUpdate(
            { id: req.params.id, ownerId: req.callerId },
            { $set: { isTrashed: true, trashedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } },
            { new: true }
          ).lean();
          if (!p) return res.status(404).json({ code: 'NOT_FOUND', error: 'Project not found.' });
          return res.json({ data: p, trashed: true });
        }
      } else if (allowMemoryFallback) {
        const p = memoryProjects.get(req.params.id);
        if (!p || p.ownerId !== req.callerId) return res.status(404).json({ code: 'NOT_FOUND', error: 'Project not found.' });
        if (permanent) {
          memoryProjects.delete(req.params.id);
          return res.json({ success: true, permanent: true });
        } else {
          p.isTrashed = true;
          p.trashedAt = new Date().toISOString();
          p.updatedAt = new Date().toISOString();
          return res.json({ data: p, trashed: true });
        }
      }
      return res.status(503).json({ code: 'STORAGE_UNAVAILABLE', error: 'Database unavailable.' });
    } catch {
      return res.status(500).json({ code: 'DELETE_FAILED', error: 'Failed to delete project.' });
    }
  });

  return router;
}
