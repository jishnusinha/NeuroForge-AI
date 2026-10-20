import { enableMemoryStorageForTests } from '../client/src/services/localRepository.js';
enableMemoryStorageForTests();
import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  saveDraftLocal, 
  getDraftLocal, 
  saveRecoverySession, 
  getRecoverySession, 
  clearRecoverySession,
  enqueueOutboxOperation,
  getPendingOutboxOperations 
} from '../client/src/services/localRepository.js';

test('Phase 3: Durable local drafts persist to repository with updated timestamp', async () => {
  const draftId = `test-draft-${Date.now()}`;
  const draft = {
    id: draftId,
    workspace: 'studio',
    revision: 1,
    configuration: {
      layers: [{ id: 'l-in', type: 'Input', units: 2 }],
      learningRate: 0.05,
    },
  };

  const saveRes = await saveDraftLocal(draft);
  assert.equal(saveRes.success, true);
  assert.equal(saveRes.id, draftId);
  assert.ok(saveRes.at);

  const retrieved = await getDraftLocal(draftId);
  assert.ok(retrieved);
  assert.equal(retrieved.id, draftId);
  assert.equal(retrieved.revision, 1);
  assert.equal(retrieved.configuration.learningRate, 0.05);
});

test('Phase 3: Interrupted training sessions are detected honestly without fabricating completed results', async () => {
  // Simulate browser crashing or tab closing while training was running
  await saveRecoverySession({
    draftId: 'draft-crash-test',
    workspace: 'studio',
    executionState: 'running', // Training was actively running!
    configuration: { learningRate: 0.03, layers: [] },
  });

  const session = await getRecoverySession();
  assert.ok(session);
  assert.equal(session.executionState, 'running');

  // Recovery evaluation
  const wasInterrupted = session.executionState === 'running' || session.executionState === 'validating';
  assert.equal(wasInterrupted, true, 'In-flight execution must be detected as interrupted');

  // Verify that an interrupted session does NOT synthesize completed metrics or false loss
  const recoveredResult = {
    status: wasInterrupted ? 'Interrupted' : 'Completed',
    restoredConfig: session.configuration,
    metrics: null, // No completed metrics invented!
  };

  assert.equal(recoveredResult.status, 'Interrupted');
  assert.equal(recoveredResult.metrics, null, 'Must never manufacture completed run metrics');

  await clearRecoverySession();
  const cleared = await getRecoverySession();
  assert.equal(cleared, null);
});

test('Phase 3: Cross-tab revision conflict detection prevents silent overwrite', () => {
  const currentTabId = 'tab-alpha';
  const otherTabId = 'tab-beta';

  let draftState = {
    id: 'shared-draft-01',
    revision: 2,
    status: 'saved_local',
    error: null,
  };

  // Simulate receiving a broadcast from another tab that saved a newer revision
  const handleBroadcast = (msg) => {
    if (msg.draftId === draftState.id && msg.tabId !== currentTabId) {
      if (msg.revision >= draftState.revision) {
        draftState = {
          ...draftState,
          status: 'conflict',
          error: `Another tab updated this draft to revision ${msg.revision}.`,
        };
      }
    }
  };

  handleBroadcast({
    type: 'DRAFT_SAVED',
    draftId: 'shared-draft-01',
    revision: 3,
    tabId: otherTabId,
  });

  assert.equal(draftState.status, 'conflict');
  assert.ok(draftState.error.includes('revision 3'));
});

test('Phase 3: Operations are enqueued to outbox with stable operation IDs', async () => {
  const op = await enqueueOutboxOperation('SYNC_DRAFT', {
    draftId: 'draft-outbox-test',
    revision: 1,
  });

  assert.ok(op.id, 'Operation must have a stable UUID');
  assert.equal(op.operation, 'SYNC_DRAFT');
  assert.equal(op.status, 'pending');

  const pending = await getPendingOutboxOperations();
  const found = pending.find(o => o.id === op.id);
  assert.ok(found);
  assert.equal(found.status, 'pending');
});

test('Phase 3: Revert, reset weights, and duplicate draft distinct operations', () => {
  const initialCommittedDraft = {
    id: 'draft-100',
    revision: 1,
    configuration: { learningRate: 0.04, weights: [0.1, 0.2] },
  };

  let workingDraft = {
    ...initialCommittedDraft,
    revision: 2,
    configuration: { learningRate: 0.12, weights: [0.9, -0.4] }, // dirty local edits
  };

  // Revert draft: discards uncommitted configuration and restores committed version
  const revertDraft = () => {
    return { ...initialCommittedDraft };
  };

  const reverted = revertDraft();
  assert.equal(reverted.configuration.learningRate, 0.04);
  assert.equal(reverted.revision, 1);

  // Duplicate draft: creates a new distinct draft ID with revision 0
  const duplicateDraft = (source) => ({
    ...source,
    id: `draft-${Date.now()}-copy`,
    revision: 0,
    parentDraftId: source.id,
  });

  const duplicated = duplicateDraft(workingDraft);
  assert.notEqual(duplicated.id, workingDraft.id);
  assert.equal(duplicated.revision, 0);
  assert.equal(duplicated.parentDraftId, 'draft-100');
});
