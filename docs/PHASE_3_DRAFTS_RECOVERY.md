# Phase 3 — Durable Local Drafts, Autosave, and Recovery

> Review correction: this historical phase note does not certify roadmap completion. See [post-review remediation](REVIEW_REMEDIATION.md) for integrated behavior, verification, and remaining deployment gates.

Implemented on 2026-10-18. Phase 3 protects work prior to cloud synchronization by providing durable IndexedDB drafts, debounced autosave, cross-tab revision conflict protection, and crash/interruption recovery.

## Key Capabilities Implemented

1. **Versioned IndexedDB Repository (`localRepository.js`)**:
   - `drafts` store: stores experiment configurations with unique IDs, revisions, timestamps, and tab provenance.
   - `snapshots` store: persists immutable dataset row points and schema digests.
   - `outbox` store: records pending sync operations with stable UUIDs for cloud synchronization.
   - `recovery` store: records heartbeat and execution state to detect unexpected crashes or tab exits.
   - Resilient memory fallback for environments with blocked storage, private browsing restrictions, or headless testing.

2. **Debounced Autosave Manager (`draftManager.js`)**:
   - Automatically debounces draft writes (600–800ms) on configuration changes in Studio and Playground.
   - Emits explicit storage states:
     - `pristine`: clean initial state.
     - `pending`: write queued in debounce window.
     - `saving`: actively writing to storage transaction.
     - `saved_local`: confirmed write to IndexedDB on this device ("Saved on device").
     - `conflict`: detected concurrent higher-revision edit in another tab.
     - `failed`: transaction or quota error.

3. **Cross-Tab Revision Protection (`BroadcastChannel`, `DraftRecoveryModal.jsx`)**:
   - Each browser tab generates a unique `clientTabId`.
   - Successful saves broadcast `{ type: 'DRAFT_SAVED', draftId, revision, tabId }`.
   - Simultaneous open tabs detect newer revisions and prevent silent overwrites.
   - Users are offered explicit resolution:
     - **Reload Latest**: loads the freshest draft from storage.
     - **Save as Copy**: forks the working changes into a new independent draft.

4. **Crash and Interruption Recovery**:
   - On startup, `draftManager.checkRecoveryOnStartup()` inspects the recovery session.
   - If an execution was left in state `running` or `validating`, it is honestly marked as `Interrupted`.
   - The model configuration is preserved, but no completed metrics or false accuracy are invented.

5. **Storage Status Indicator (`WorkspaceHeader.jsx`)**:
   - Explicit visual badges:
     - `Saved on device`: green check confirming local durability.
     - `Saving...`: animated in-flight indicator.
     - `Conflict`: warning badge opening the recovery dialog.

## Verification & Acceptance Gate

- `tests/recovery.test.mjs` verifies:
  - Durable drafts persist to storage and update timestamps.
  - Interrupted training sessions are detected honestly without fabricating completed results.
  - Cross-tab revision conflict detection prevents silent overwrite.
  - Operations are queued into the outbox with stable operation IDs.
  - Revert, reset weights, and duplicate draft are distinct, isolated operations.
- `oxlint --deny-warnings` passed with 0 errors and 0 warnings.
- Client production build (`vite build`) passed.
- All 31 unit and domain tests passed.
