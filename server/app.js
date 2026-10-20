import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { createExperimentRouter } from './routes/experimentRoutes.js';
import { createDraftRouter } from './routes/draftRoutes.js';
import { createAuthRouter } from './routes/authRoutes.js';
import { createProjectRouter } from './routes/projectRoutes.js';
import { createSyncRouter } from './routes/syncRoutes.js';
import { createShareRouter } from './routes/shareRoutes.js';

import crypto from 'node:crypto';
import { trustedCorsOrigins, requestIdOrNew, isTrustedRequestOrigin } from './securityPolicy.js';

export function createApp({
  allowMemoryFallback = process.env.NODE_ENV !== 'production',
  deliverAccountEmail,
  enforceOriginPolicy = process.env.NODE_ENV === 'production',
  allowedOrigins,
} = {}) {
  const app = express();
  app.disable('x-powered-by');
  // No wildcard cross-origin access for hosted user sessions.
  const trustedOrigins = enforceOriginPolicy ? (allowedOrigins ??
    trustedCorsOrigins({ originList: process.env.CORS_ORIGINS || '', publicAppUrl: process.env.PUBLIC_APP_URL || '' })) : [];
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
    if (enforceOriginPolicy && req.get('Origin') && !isTrustedRequestOrigin(req.get('Origin'), trustedOrigins)) {
      return res.status(403).json({ code: 'ORIGIN_NOT_ALLOWED', error: 'Origin is not permitted.' });
    }
    next();
  });
  app.use(cors(enforceOriginPolicy ? {
    origin: (origin, callback) => callback(null, isTrustedRequestOrigin(origin, trustedOrigins)),
  } : {}));
  app.use(express.json({ limit: '2mb' }));

  // Phase 11: Request ID and structured diagnostics
  app.use((req, res, next) => {
    const reqId = requestIdOrNew(req.headers['x-request-id'], () => crypto.randomUUID());
    req.requestId = reqId;
    res.setHeader('x-request-id', reqId);
    next();
  });

  app.get('/api/health', (_req, res) => res.json({ 
    status: 'online', 
    version: '1.0.0',
    service: 'NeuroForge AI Backend API', 
    mongoConnected: mongoose.connection.readyState === 1 
  }));

  app.get('/api/ready', (_req, res) => {
    const connected = mongoose.connection.readyState === 1;
    res.status(connected || allowMemoryFallback ? 200 : 503).json({
      ready: connected || allowMemoryFallback, 
      storage: connected ? 'database' : allowMemoryFallback ? 'memory' : 'unavailable',
      durable: connected,
    });
  });

  app.get('/api/v2/diagnostics', (req, res) => {
    if (enforceOriginPolicy) return res.status(404).json({ code: 'NOT_FOUND', error: 'Not found.' });
    const memory = process.memoryUsage();
    res.json({
      service: 'NeuroForge AI',
      version: '1.0.0',
      requestId: req.requestId,
      uptimeSeconds: Math.floor(process.uptime()),
      database: {
        readyState: mongoose.connection.readyState,
        status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      },
      memory: {
        heapUsedMB: Math.round(memory.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memory.heapTotal / 1024 / 1024),
        rssMB: Math.round(memory.rss / 1024 / 1024),
      },
      executionLimits: {
        maxDatasetRows: 2000,
        maxFeatures: 20,
        maxSweepJobs: 50,
        maxLayers: 6,
      },
    });
  });

  const authRouter = createAuthRouter({ allowMemoryFallback, deliverEmail: deliverAccountEmail });
  app.use(async (req, res, next) => {
    try { req.identity = await authRouter.resolveAuth(req); req.identityResolved = true; next(); }
    catch { res.status(503).json({ code: 'IDENTITY_UNAVAILABLE', error: 'Identity service unavailable.' }); }
  });
  app.use('/api/v2/auth', authRouter);
  const projects = createProjectRouter({ authRouter, allowMemoryFallback });
  const drafts = createDraftRouter({ allowMemoryFallback });
  app.use('/api/v2/projects', projects);
  app.use('/api/v2/sync', createSyncRouter({ authRouter, allowMemoryFallback }));

  const experiments = createExperimentRouter({ allowMemoryFallback });
  projects.resolveRun = experiments.findResource;
  const shares=createShareRouter({ authRouter, allowMemoryFallback, resolveRun: experiments.findResource, resolveProject: projects.findResource });
  app.use('/api/v2/shares',shares);
  app.use('/api/experiments', experiments);
  app.use('/api/v2/runs', (req, res, next) => {
    if (req.method === 'POST' && (req.body.schemaVersion !== 2 || !req.body.domain)) return res.status(400).json({ code: 'UNSUPPORTED_VERSION', error: 'Version 2 run snapshot required.' });
    next();
  }, experiments);
  app.use('/api/v2/drafts', drafts);
  authRouter.migrateGuestStores = (from, to) => { shares.migrateOwner(from,to); drafts.migrateOwner(from,to); return { migratedProjects: projects.migrateOwner(from,to), migratedExperiments: experiments.migrateOwner(from,to) }; };

  app.use((error, _req, res, _next) => {
    const status = error.type === 'entity.too.large' ? 413 : error instanceof SyntaxError ? 400 : 500;
    res.status(status).json({ error: status === 413 ? 'Request exceeds the 2 MB limit.' : status === 400 ? 'Invalid JSON request.' : 'Unexpected server error.' });
  });
  return app;
}
