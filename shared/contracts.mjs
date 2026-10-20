import { DomainError, VERSION, snapshot } from './domain.mjs';

const requireText = (value, field) => {
  if (typeof value !== 'string' || !value.trim()) throw new DomainError('INVALID_ENTITY', `${field} is required.`);
};
// Metadata contracts only: these do not upload weights or publish a report.
export function modelArtifact({ id = globalThis.crypto.randomUUID(), runId, topology, weights, contentDigest, location, compatibility }) {
  requireText(runId, 'runId');
  if (!/^[a-f0-9]{64}$/.test(contentDigest) || !topology || !weights || !location || !compatibility) throw new DomainError('INVALID_ARTIFACT', 'Artifact requires topology, weights, SHA-256 digest, location and compatibility metadata.');
  return snapshot({ schemaVersion: VERSION, id, runId, topology, weights, contentDigest, location, compatibility });
}
export function annotation({ id = globalThis.crypto.randomUUID(), projectId, text, target, createdAt = new Date().toISOString() }) {
  requireText(projectId, 'projectId'); requireText(text, 'text');
  if (!['run', 'sample', 'chart-range', 'comparison'].includes(target?.type) || typeof target.id !== 'string') throw new DomainError('INVALID_ANNOTATION', 'Annotation requires a supported target and identifier.');
  return snapshot({ schemaVersion: VERSION, id, projectId, text, target, createdAt });
}
export function shareLink({ id = globalThis.crypto.randomUUID(), runId, visibility = 'private', scope = 'report:read', expiresAt = null, revokedAt = null }) {
  requireText(runId, 'runId');
  if (!['private', 'unlisted'].includes(visibility) || scope !== 'report:read' || [expiresAt, revokedAt].some(value => value !== null && (typeof value !== 'string' || !Number.isFinite(Date.parse(value))))) throw new DomainError('INVALID_SHARE', 'Share requires explicit read-only scope and valid expiry/revocation timestamps.');
  return snapshot({ schemaVersion: VERSION, id, runId, visibility, scope, expiresAt, revokedAt });
}
