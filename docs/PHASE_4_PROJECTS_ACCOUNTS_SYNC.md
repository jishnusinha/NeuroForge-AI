# Phase 4 — Projects, Identity, Cloud Synchronization, and Controlled Sharing

> Review correction: this historical phase note does not certify roadmap completion. See [post-review remediation](REVIEW_REMEDIATION.md) for integrated behavior, verification, and remaining deployment gates.

Implemented on 2026-10-18. Phase 4 introduces durable multi-project organization, account ownership with secure sessions, private-by-default access, idempotent guest-to-account migration, reliable outbox synchronization, and revocable scoped sharing.

## Key Capabilities Implemented

1. **Authentication and Session Security (`User.js`, `authRoutes.js`)**:
   - Accounts with PBKDF2 password hashing (100,000 iterations, SHA-512, per-user 16-byte random salt).
   - Secure random sessions with 30-day expiration (`Session` model with TTL index).
   - Strict constant-time credential comparison (`crypto.timingSafeEqual`) preventing timing attacks.
   - Dual identity support: authenticated account (`Bearer <token>`) or immediate guest exploration (`X-Owner-Token`).

2. **Guest-to-Account Idempotent Migration**:
   - Authenticated endpoint `POST /api/v2/auth/migrate-guest`.
   - Atomically transfers all projects, drafts, runs, and experiments from a guest session into the user's permanent account.
   - Idempotent: repeated migration calls preserve data without creating duplicate records.

3. **Project Management and Organization (`Project.js`, `projectRoutes.js`)**:
   - Full Project CRUD with UUID identifiers.
   - Organization: tags, metadata, and linked experiment runs.
   - Lifecycle: active, archive (`POST /api/v2/projects/:id/archive`), trash (`DELETE /api/v2/projects/:id`), and restore (`POST /api/v2/projects/:id/restore`).
   - Paginated listings with search (`q`) and status filters.
   - Strict ownership authorization: possession of an arbitrary object ID never grants access to another user's private projects (returns 404).

4. **Idempotent Cloud Synchronization (`syncRoutes.js`)**:
   - Batch outbox synchronization endpoint `POST /api/v2/sync`.
   - Stable operation UUIDs guarantee duplicate prevention.
   - Revision checking: detects stale draft revisions and returns honest `conflict` statuses without destroying work or corrupting database records.
   - Honest availability: in production without database connectivity, returns `503 STORAGE_UNAVAILABLE` rather than silently storing cloud writes in transient memory.

5. **Explicit Scoped Sharing and Revocation (`ShareLink.js`, `shareRoutes.js`)**:
   - Experiments and projects are **private by default**.
   - Explicit share links created via `POST /api/v2/shares` with scoped `read-only` access.
   - Optional expiration timestamps (`expiresInHours`).
   - Revocation endpoint `DELETE /api/v2/shares/:shareId` immediately cuts off access (returns `410 SHARE_REVOKED`).
   - Expired links return `410 SHARE_EXPIRED`.

## Verification & Acceptance Gate

- `tests/auth_projects.test.mjs` verifies:
  - Account registration, login, and secure sessions.
  - Account isolation enforces private ownership on projects and mutations.
  - Guest projects work immediately and migrate to an account idempotently.
  - Explicit scoped sharing enforces private default, revocation, and expiry.
  - Production database failure produces honest 503 status.
- `oxlint --deny-warnings` passed with 0 errors and 0 warnings.
- All 36 unit and integration tests passed.
