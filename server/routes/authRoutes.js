import express from 'express';
import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { promisify } from 'node:util';
const deriveKey = promisify(crypto.pbkdf2);
import { deliverAccountEmail } from '../emailDelivery.js';
import { User, Session, AccountAction } from '../models/User.js';
import { Project } from '../models/Project.js';
import { ShareLink } from '../models/ShareLink.js';
import { Experiment } from '../models/Experiment.js';


export function createAuthRouter({ allowMemoryFallback = false, deliverEmail = deliverAccountEmail } = {}) {
  const router = express.Router();
  const attempts = new Map();
  router.use((req, res, next) => {
    if (!['/login', '/register','/request-reset','/request-verification','/reset-password','/verify-email'].includes(req.path)) return next();
    const key = req.ip;
    const now = Date.now();
    for (const [ip, entry] of attempts) if (entry.until < now) attempts.delete(ip);
    const entry = attempts.get(key) || { count: 0, until: now + 60000 };
    if (++entry.count > 10 || attempts.size > 10000) return res.status(429).json({ code: 'RATE_LIMITED', error: 'Too many attempts. Retry in a minute.' });
    attempts.set(key, entry); next();
  });

  // In-memory fallback stores for test/dev
  const memoryUsers = new Map();
  const memorySessions = new Map();
  const memoryActions = new Map();

  const isDbReady = () => mongoose.connection.readyState === 1;

  // Helper to extract session or guest owner
  router.resolveAuth = async (req) => {
    const authHeader = req.get('Authorization');
    const sessionToken = authHeader?.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : req.get('X-Session-Token');

    if (sessionToken) {
      const tokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');
      if (isDbReady()) {
        const session = await Session.findOne({ tokenHash, expiresAt: { $gt: new Date() } }).lean();
        if (session) {
          const user = await User.findOne({ id: session.userId }).lean();
          if (user) {
            return { type: 'user', userId: user.id, user };
          }
        }
      } else if (allowMemoryFallback) {
        const session = memorySessions.get(tokenHash);
        if (session && new Date(session.expiresAt) > new Date()) {
          const user = memoryUsers.get(session.userId);
          if (user) {
            return { type: 'user', userId: user.id, user };
          }
        }
      }
    }

    if (sessionToken) return null;
    // Fall back to guest owner token
    const guestToken = req.get('X-Owner-Token');
    if (guestToken && guestToken.length >= 20 && guestToken.length <= 200) {
      const guestOwnerId = crypto.createHash('sha256').update(guestToken).digest('hex');
      return { type: 'guest', ownerId: guestOwnerId };
    }

    return null;
  };

  const issueAction = async (user,type) => {
    const raw=crypto.randomBytes(32).toString('hex');
    const action={tokenHash:crypto.createHash('sha256').update(raw).digest('hex'),userId:user.id,type,expiresAt:new Date(Date.now()+30*60000)};
    if(isDbReady())await AccountAction.create(action);else memoryActions.set(action.tokenHash,action);
    const url=new URL('/app/account',process.env.PUBLIC_APP_URL || 'http://localhost:5173');url.searchParams.set('action',type);url.searchParams.set('token',raw);
    try {await deliverEmail({to:user.email,type,url:url.toString(),expiresAt:action.expiresAt.toISOString()});}
    catch(error){if(isDbReady())await AccountAction.deleteOne({tokenHash:action.tokenHash});else memoryActions.delete(action.tokenHash);throw error;}
  };
  for(const [path,type] of [['request-reset','reset'],['request-verification','verify']]) router.post('/'+path,async(req,res)=>{
    try{
      if(typeof req.body.email!=='string'||req.body.email.length>254)return res.status(400).json({code:'INVALID_EMAIL',error:'Valid email required.'});
      if(deliverEmail===deliverAccountEmail&&(!process.env.AUTH_EMAIL_WEBHOOK_URL||!process.env.AUTH_EMAIL_WEBHOOK_SECRET||!process.env.PUBLIC_APP_URL))return res.status(503).json({code:'EMAIL_DELIVERY_UNAVAILABLE',error:'Email delivery is not configured.'});
      const email=req.body.email.toLowerCase().trim();
      const user=isDbReady()?await User.findOne({email}).lean():[...memoryUsers.values()].find(u=>u.email===email);
      if(user)await issueAction(user,type);
      res.status(202).json({success:true,message:'If an account exists, an email will arrive shortly.'});
    }catch{res.status(503).json({code:'EMAIL_DELIVERY_FAILED',error:'Email delivery unavailable. Please retry later.'});}
  });
  for(const [path,type] of [['reset-password','reset'],['verify-email','verify']])router.post('/'+path,async(req,res)=>{
    try{
      if(typeof req.body.token!=='string'||!/^[a-f0-9]{64}$/.test(req.body.token)|| (type==='reset'&&(typeof req.body.password!=='string'||req.body.password.length<8||req.body.password.length>256)))return res.status(400).json({code:'INVALID_ACTION',error:'Valid token and password required.'});
      const hash=crypto.createHash('sha256').update(req.body.token).digest('hex');
      const action=isDbReady()?await AccountAction.findOneAndDelete({tokenHash:hash,type,expiresAt:{$gt:new Date()}}).lean():memoryActions.get(hash);
      if(!action||action.type!==type||new Date(action.expiresAt)<=new Date())return res.status(400).json({code:'INVALID_ACTION',error:'Token expired or already used.'});
      memoryActions.delete(hash);
      const changes=type==='verify'?{emailVerified:true}:{salt:crypto.randomBytes(16).toString('hex')};
      if(type==='reset')changes.passwordHash=(await deriveKey(req.body.password,changes.salt,100000,64,'sha512')).toString('hex');
      if(isDbReady()){await User.updateOne({id:action.userId},{$set:changes});if(type==='reset')await Session.deleteMany({userId:action.userId});}
      else{Object.assign(memoryUsers.get(action.userId),changes);if(type==='reset')for(const [key,session]of memorySessions)if(session.userId===action.userId)memorySessions.delete(key);}
      res.json({success:true});
    }catch{res.status(503).json({code:'ACTION_FAILED',error:'Could not complete account action.'});}
  });

  // Register
  router.post('/register', async (req, res) => {
    try {
      const { email, password, name } = req.body;
      if (typeof email !== 'string' || email.length > 254 || !email.includes('@') || typeof password !== 'string' || password.length < 8 || password.length > 256 || typeof name !== 'string' || !name.trim() || name.length > 200) {
        return res.status(400).json({ 
          code: 'INVALID_CREDENTIALS', 
          error: 'Valid email, name, and password (minimum 8 characters) required.' 
        });
      }

      if(process.env.NODE_ENV==='production'&&deliverEmail===deliverAccountEmail&&(!process.env.AUTH_EMAIL_WEBHOOK_URL||!process.env.AUTH_EMAIL_WEBHOOK_SECRET||!process.env.PUBLIC_APP_URL))return res.status(503).json({code:'EMAIL_DELIVERY_UNAVAILABLE',error:'Account email delivery is not configured.'});
      const normalizedEmail = email.toLowerCase().trim();
      const salt = crypto.randomBytes(16).toString('hex');
      const passwordHash = (await deriveKey(password, salt, 100000, 64, 'sha512')).toString('hex');
      const userId = crypto.randomUUID();

      const userRecord = {
        id: userId,
        email: normalizedEmail,
        name: name.trim(),
        salt,
        passwordHash,
        createdAt: new Date().toISOString(),
      };

      if (isDbReady()) {
        const existing = await User.findOne({ email: normalizedEmail }).lean();
        if (existing) {
          return res.status(409).json({ code: 'EMAIL_EXISTS', error: 'Email already registered.' });
        }
        await User.create(userRecord);
      } else if (allowMemoryFallback) {
        for (const u of memoryUsers.values()) {
          if (u.email === normalizedEmail) {
            return res.status(409).json({ code: 'EMAIL_EXISTS', error: 'Email already registered.' });
          }
        }
        memoryUsers.set(userId, userRecord);
      } else {
        return res.status(503).json({ code: 'STORAGE_UNAVAILABLE', error: 'Database unavailable.' });
      }

      if(process.env.NODE_ENV==='production'){
        try{await issueAction(userRecord,'verify');}catch{return res.status(503).json({code:'EMAIL_DELIVERY_FAILED',error:'Account created, but verification delivery failed. Request verification again.'});}
        return res.status(202).json({verificationRequired:true});
      }
      // Generate session token
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      if (isDbReady()) {
        await Session.create({ tokenHash, userId, expiresAt });
      } else {
        memorySessions.set(tokenHash, { tokenHash, userId, expiresAt: expiresAt.toISOString() });
      }

      return res.status(201).json({
        user: { id: userId, email: normalizedEmail, name: userRecord.name },
        token: rawToken,
      });
    } catch {
      return res.status(500).json({ code: 'AUTH_FAILED', error: 'Registration failed.' });
    }
  });

  // Login
  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (typeof email !== 'string' || typeof password !== 'string' || password.length > 256) {
        return res.status(400).json({ code: 'INVALID_CREDENTIALS', error: 'Email and password required.' });
      }

      const normalizedEmail = email.toLowerCase().trim();
      let user = null;

      if (isDbReady()) {
        user = await User.findOne({ email: normalizedEmail });
      } else if (allowMemoryFallback) {
        for (const u of memoryUsers.values()) {
          if (u.email === normalizedEmail) { user = u; break; }
        }
      } else {
        return res.status(503).json({ code: 'STORAGE_UNAVAILABLE', error: 'Database unavailable.' });
      }

      if (!user) {
        return res.status(401).json({ code: 'INVALID_CREDENTIALS', error: 'Invalid email or password.' });
      }

      if(process.env.NODE_ENV==='production'&&!user.emailVerified)return res.status(403).json({code:'EMAIL_NOT_VERIFIED',error:'Verify your email before signing in.'});
      // Verify password
      const hash = (await deriveKey(password, user.salt, 100000, 64, 'sha512')).toString('hex');
      const valid = crypto.timingSafeEqual(Buffer.from(user.passwordHash, 'hex'), Buffer.from(hash, 'hex'));
      if (!valid) {
        return res.status(401).json({ code: 'INVALID_CREDENTIALS', error: 'Invalid email or password.' });
      }

      // Create session
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      if (isDbReady()) {
        await Session.create({ tokenHash, userId: user.id, expiresAt });
      } else {
        memorySessions.set(tokenHash, { tokenHash, userId: user.id, expiresAt: expiresAt.toISOString() });
      }

      return res.json({
        user: { id: user.id, email: user.email, name: user.name },
        token: rawToken,
      });
    } catch {
      return res.status(500).json({ code: 'AUTH_FAILED', error: 'Login failed.' });
    }
  });

  // Current User (Me)
  router.get('/me', async (req, res) => {
    const auth = await router.resolveAuth(req);
    if (!auth || auth.type !== 'user') {
      return res.status(401).json({ code: 'UNAUTHORIZED', error: 'Not authenticated.' });
    }
    return res.json({ user: { id: auth.user.id, email: auth.user.email, name: auth.user.name } });
  });

  // Logout
  router.post('/logout', async (req, res) => {
    const authHeader = req.get('Authorization');
    const sessionToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.get('X-Session-Token');
    if (sessionToken) {
      const tokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');
      if (isDbReady()) {
        await Session.deleteOne({ tokenHash });
      } else {
        memorySessions.delete(tokenHash);
      }
    }
    return res.json({ success: true });
  });

  // Guest-to-Account Migration
  router.post('/migrate-guest', async (req, res) => {
    try {
      const auth = await router.resolveAuth(req);
      if (!auth || auth.type !== 'user') {
        return res.status(401).json({ code: 'UNAUTHORIZED', error: 'Authentication required for migration.' });
      }

      const { guestToken } = req.body;
      if (!guestToken || guestToken.length < 20) {
        return res.status(400).json({ code: 'INVALID_TOKEN', error: 'Valid guestToken required.' });
      }

      const guestOwnerId = crypto.createHash('sha256').update(guestToken).digest('hex');
      const userId = auth.userId;

      let migratedProjects = 0;
      let migratedExperiments = 0;

      if (isDbReady()) {
        const pRes = await Project.updateMany({ ownerId: guestOwnerId }, { $set: { ownerId: userId } });
        migratedProjects = pRes.modifiedCount || 0;

        const eRes = await Experiment.updateMany({ ownerId: guestOwnerId }, { $set: { ownerId: userId } });
        migratedExperiments = eRes.modifiedCount || 0;

        await ShareLink.updateMany({ownerId:guestOwnerId},{$set:{ownerId:userId}});
        const Draft = mongoose.models.ExperimentDraft;
        if (Draft) {
          await Draft.updateMany({ ownerId: guestOwnerId }, { $set: { ownerId: userId } });
        }
      }

      if (!isDbReady() && allowMemoryFallback) { const migrated = router.migrateGuestStores?.(guestOwnerId,userId); migratedProjects = migrated?.migratedProjects ?? 0; migratedExperiments = migrated?.migratedExperiments ?? 0; }
      return res.json({
        success: true,
        migratedProjects,
        migratedExperiments,
      });
    } catch {
      return res.status(500).json({ code: 'MIGRATION_FAILED', error: 'Guest migration failed.' });
    }
  });

  return router;
}
