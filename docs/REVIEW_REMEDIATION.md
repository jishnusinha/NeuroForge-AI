# Post-review remediation — 2026-10-18

This supersedes earlier “all phases complete” statements. The review found working libraries without corresponding application workflows, plus defects in ownership, local persistence, recovery, synchronization and execution. Completing unit tests alone did not establish roadmap completion.

## Changes

- Run and draft routes now resolve the same guest/account identity. Account migration transfers server ownership; browser account changes clear the active investigation context and separate cached records. Private run reads require ownership, including old unscoped report IDs. Existing data is retained; owners can issue replacement scoped links.
- Explicit shares check real resource ownership in database and memory modes, store a sanitized snapshot and enforce revocation/expiry. A public response never returns the server owner ID. Run URLs cannot bypass revoked shares.
- The account workspace exposes registration/login/logout, guest import, project creation/search/pagination/archive/trash/restore, owned run links, scoped report links and revocation.
- Password hashing runs asynchronously. Authentication endpoints have bounded request fields and a local attempt limiter. Verification and password reset use expiring, hashed, single-use tokens. Password reset invalidates existing sessions. Production login requires verification.
- IndexedDB errors no longer fall back silently to memory. The UI displays a failed acknowledgement and supports retry. The memory adapter is explicitly enabled by Node tests only. Local drafts use transactional revision checks; cross-tab conflicts require reload or a new draft identity. An unchanged restored draft does not create a false edit.
- Playground and Studio drafts include complete dataset points and configuration. Recovery restores those inputs before a lab mounts and identifies interrupted execution. Recovery, snapshots and local caches are scoped to the current browser account. Visiting an inspection page does not force an unrelated draft recovery dialog.
- The outbox sends stable operation IDs and persists exact retry content. The server records operation results in the same atomic draft update, checks owner/revision and rejects unsupported operations. A database outage is not acknowledged as synchronization. Automatic sync runs after local saving, on reconnection and periodically, with backoff; the account page also provides explicit retry. Conflicts preserve local data and expose duplication.
- Studio, the activity drawer and Arena sweeps use one runner. Stopping jobs retain the concurrency lock until cleanup completes. Validation/build failures reset execution state; model seeds are explicit. Studio exposes bounded early stopping with final-weight evaluation metadata. Training preserves deterministic row order.
- Completed Studio runs include checksum-verified model topology and weights in the saved snapshot. Reopening a run restores those weights for probing and inference. Starting training is a fresh seeded execution; exact optimizer-state resume is not claimed.
- CSV preparation accepts two numeric inputs and a binary target, previews rows, supports bounded parsing, and fits imputation/scaling only on training rows. Fitted parameters and explicit three-way membership survive saving and recovery. Playground test evaluation is explicit and access is recorded. Polynomial transforms remain a library capability until model inputs and visualizations support their expanded dimensions.
- Error Explorer uses measured validation predictions, supports point inspection and saves observations locally. Neural diagnostics consume actual weights; numerical gradient checks are computed on demand and bounded to small networks. Academy challenge/report controls are reachable from the learning page and use actual run evidence.
- Arena runs bounded sequential sweeps, persists manifests and individual trial results, supports stop/retry, and forwards each model seed. Aggregation excludes initialization seed from model-configuration grouping and separates dataset/protocol identities. Test rows are not used for fitting or ranking.
- Storage acknowledgements and sharing controls remain accessible on narrow screens. Investigation panels are reachable below the canvas, instead of being clipped by a fixed-height workspace. TensorFlow is loaded separately from the initial shell.

## Deployment configuration

Set these environment variables before enabling production registration and account email flows:

```text
PUBLIC_APP_URL=https://your-app.example
AUTH_EMAIL_WEBHOOK_URL=https://your-email-service.example/send-account-email
AUTH_EMAIL_WEBHOOK_SECRET=<server-only authentication secret>
```

The delivery service receives an authenticated POST with `{ to, type, url, expiresAt }`; `type` is `verify` or `reset`. It must send the supplied action link to the specified recipient. Tokens must not be logged or returned to the browser as a debugging feature. Production registration fails honestly when delivery is unconfigured; requests never pretend an email was sent. Tests inject a mailbox adapter and send no external messages.

## Verification

The regression suite exercises actual draft-manager and repository behavior rather than reimplementing the expected algorithm inside tests. MongoDB integration covers atomic competing edits, sync retries, conflicting operation reuse and migration backup/rollback. Browser coverage includes complete account verification, private reports/revocation, imported CSV recovery, IndexedDB failure, saved artifacts, executed sweeps and two-tab conflict resolution, alongside the original lab journeys.

Verification completed: 72 unit/API tests, the isolated MongoDB integration, strict lint, production build, syntax checks, and all 48 desktop/mobile browser checks passed (24 with MongoDB and 24 with temporary memory). Browser results are recorded in `.artifacts/verification-summary.json`. Only isolated test databases are modified by verification.

## Remaining rollout work

This change does not certify the entire original roadmap as production complete. External email delivery must be configured and exercised in the deployment environment. A maintained identity-provider migration/security review, distributed abuse controls, full accessibility auditing, additional browser/backend compatibility testing, hosted CI evidence, and deployment/backup/restore drills remain release work. Completed-run caches still use the existing localStorage compatibility path; drafts, recovery, manifests and observations use IndexedDB. Native worker execution, object-storage artifact retention, exact optimizer-state resume, and broader feature dimensions remain beyond the current bounded browser implementation. The TensorFlow lazy chunk still triggers the existing bundle-size warning.
