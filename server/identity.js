import { createHash } from 'node:crypto';
export function ownerId(req) {
  if (req.identityResolved) return req.identity?.type === 'user' ? req.identity.userId : req.identity?.ownerId ?? null;
  const token = req.get('X-Owner-Token');
  return typeof token === 'string' && token.length >= 20 && token.length <= 200 ? createHash('sha256').update(token).digest('hex') : null;
}
export function safeResource(doc) {
  const result = JSON.parse(JSON.stringify(doc?.toObject ? doc.toObject() : doc));
  delete result.ownerId; delete result._domainMigration;
  if (result.domain?.legacyOriginal) delete result.domain.legacyOriginal.ownerId;
  return result;
}
