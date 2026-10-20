# Phase 1 — Domain and migration foundation

Implemented on 2026-10-18. The existing Playground, Studio, report, fork and comparison interfaces remain usable.

## Contracts and storage

`shared/domain.mjs` defines schema version 2, canonical JSON serialization, SHA-256 digests, immutable snapshots, execution transitions, revision checks, legacy adaptation and fork creation. `shared/contracts.mjs` defines artifact, annotation and scoped share metadata.

Saved experiments retain their flat compatibility fields and contain a `domain` envelope with distinct project, dataset-version, evaluation-protocol, run, metric-series and summary-metric entities. These are logical entities stored atomically in the existing experiment collection; this phase does not introduce independently editable dataset or project collections. Drafts use a separate `ExperimentDraft` collection.

- Dataset digests cover feature/target schema, preprocessing name/version, stable sample IDs and numeric row values. Rows are sorted by ID for hashing; recorded row order is retained for inspection. Regression uses x as the input and y as the target.
- New lab runs record actual train/validation membership and split seed separately from generation and model seeds. The historical UI's “test” subset is recorded as validation because it is used during investigation. Clustering records all input rows as training data.
- Protocol digests cover membership, task, preprocessing and metric-definition version. Comparisons between new records use SHA-256 dataset and protocol identity. Existing legacy-only fingerprint comparisons remain available for compatibility.
- A run owns a frozen configuration and measurements. Forks receive a new run identity and preserve the parent run ID. Repeated identical saves reuse the existing record; conflicting evidence under an existing run ID returns `409 IMMUTABLE_RUN`. MongoDB additionally enforces a unique sparse run-ID index.
- The store tracks draft dirtiness/revision/sync, execution, checkpoint inspection and save confirmation separately. The old status label remains a UI compatibility projection. Supported transitions are queued → validating → running → completed, with stopping/cancelled, failed and interrupted branches. Terminal runs cannot restart; a new execution gets a new ID. There is no pause state.
- Artifacts, annotations and ShareLinks have metadata contracts only. Saved runs currently contain empty lists. Weight persistence, account authorization and revocable report sharing remain in their planned phases. Existing public report links retain their existing behavior.

## API

`/api/experiments` remains compatible. `/api/v2/runs` exposes the same router and storage. New saves use `schemaVersion: 2` and validate their domain snapshot against submitted evidence. Unsupported versions, invalid snapshots and duplicate run identities return machine-readable error codes. Stored snapshots receive schema, sample, membership and dataset-checksum validation when read.

Draft foundation endpoints:

- `POST /api/v2/drafts`: `{ schemaVersion: 2, configuration, parentRunId? }`.
- `GET /api/v2/drafts/:id`: owner-scoped draft read.
- `PUT /api/v2/drafts/:id`: `{ schemaVersion: 2, expectedRevision, changes }` updates configuration only. MongoDB checks the expected revision atomically. Stale or simultaneous conflicting edits return `409 REVISION_CONFLICT`.

These endpoints use the existing browser ownership token. They are infrastructure for later autosave, not an account authentication system. Draft writes are explicit; the UI does not yet autosave through them. Memory fallback remains temporary and is disabled by default in production.

## Legacy data and explicit migration

Reads adapt legacy records in memory without an in-place source migration. Existing online list caching continues; MongoDB source records are not rewritten on read. Raw MongoDB reads avoid Mongoose defaults inventing missing seed or provenance values. Original evidence is retained in `legacyOriginal`; server-private ownership and migration bookkeeping are excluded from public evidence. Missing split membership, seeds, runtime and completion timestamps remain null. No artifacts or missing metric values are synthesized. Invalid legacy records retain their original flat data and receive `compatibilityIssues` instead of silently disappearing.

Migration requires an explicitly configured `MONGODB_URI`. It processes at most 100 legacy records per invocation; no migration runs at startup.

```powershell
$env:MONGODB_URI = 'mongodb://127.0.0.1:27017/your_database'
node scripts/migrate-domain.mjs              # Read-only dry run, reports counts
node scripts/migrate-domain.mjs --apply      # Backup first, then attach envelopes
node scripts/migrate-domain.mjs --retry .artifacts/domain-migrations/BATCH.json
node scripts/migrate-domain.mjs --rollback .artifacts/domain-migrations/BATCH.json
```

An apply command writes an exclusive, full batch backup under `.artifacts/domain-migrations/` before changing any record. It compares source content before attaching metadata, verifies resulting digests, and reports each record as verified, already applied, invalid, conflicting or failed. Re-run apply for subsequent batches. Retry uses the original backup and is idempotent. Rollback removes only the matching batch's unchanged domain metadata; it preserves original experiment fields and refuses conflicting envelopes. Keep backups until verification and retention requirements are satisfied. Do not commit backup files.

Only isolated test databases were migrated during implementation. Existing project data was not migrated.

## Verification

Coverage includes canonical digest behavior, duplicate IDs, incomplete/overlapping splits, unknown legacy provenance, exact metric preservation, immutable forks, revision conflicts, invalid execution transitions, migration retries/rollback/conflicts, run identity conflicts and owner isolation.

The real MongoDB integration exercises concurrent draft edits and runs the actual migration CLI through dry run, backup/apply, retry and rollback. Desktop and mobile browser journeys cover save/reload/public report/export/fork, recorded membership and parent identity, comparison compatibility, training/checkpoint/stop, offline saving and storage failure.

Final verification: 21 unit/API tests passed; the real MongoDB integration passed; all 14 browser journeys passed with MongoDB and all 14 passed with temporary-memory storage. Strict lint, production build, syntax checks and `git diff --check` passed. The existing large Studio bundle warning remains. The browser summary is recorded in `.artifacts/verification-summary.json`.

Remaining product work starts with Phase 2: the workspace design system and interaction architecture. Durable local drafts/autosave remain Phase 3, identity/projects/sharing Phase 4, and runner/artifact persistence Phase 5.
