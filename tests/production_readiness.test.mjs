import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { 
  PRODUCTION_CONFIG, 
  isFeatureEnabled, 
  validateExecutionBudget 
} from '../client/src/services/productionConfig.js';

test('Phase 11: Backend exposes structured diagnostics with request IDs and memory metrics', async () => {
  const app = createApp({ allowMemoryFallback: true });

  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const res = await fetch(`${baseUrl}/api/v2/diagnostics`);
    assert.equal(res.status, 200);

    const reqId = res.headers.get('x-request-id');
    assert.ok(reqId);

    const data = await res.json();
    assert.equal(data.service, 'NeuroForge AI');
    assert.equal(data.version, '1.0.0');
    assert.equal(data.requestId, reqId);
    assert.ok(data.memory.heapUsedMB > 0);
    assert.equal(data.executionLimits.maxDatasetRows, 2000);
    assert.equal(data.executionLimits.maxSweepJobs, 50);

    // Private secrets are NEVER exposed in diagnostics
    assert.equal(data.password, undefined);
    assert.equal(data.token, undefined);
    assert.equal(data.secret, undefined);
  } finally {
    server.close();
  }
});

test('Phase 11: Production configuration validates execution budgets against browser resource limits', () => {
  assert.equal(PRODUCTION_CONFIG.version, '1.0.0');
  assert.equal(PRODUCTION_CONFIG.budgets.maxDatasetRows, 2000);
  assert.equal(PRODUCTION_CONFIG.budgets.maxSweepTotalJobs, 50);

  // Budget checks
  assert.equal(validateExecutionBudget(500, 4), true);

  // Excess rows rejected
  assert.throws(() => {
    validateExecutionBudget(2500, 4);
  }, /BUDGET_EXCEEDED/);

  // Excess features rejected
  assert.throws(() => {
    validateExecutionBudget(500, 25);
  }, /BUDGET_EXCEEDED/);
});

test('Phase 11: Scoped feature flags manage controlled feature rollout across milestones', () => {
  assert.equal(isFeatureEnabled('workspace_system'), true);
  assert.equal(isFeatureEnabled('durable_drafts'), true);
  assert.equal(isFeatureEnabled('accounts_and_sync'), true);
  assert.equal(isFeatureEnabled('persistent_artifacts'), true);
  assert.equal(isFeatureEnabled('anti_leakage_prep'), true);
  assert.equal(isFeatureEnabled('error_explorer'), true);
  assert.equal(isFeatureEnabled('neural_diagnostics'), true);
  assert.equal(isFeatureEnabled('sweeps_and_arena'), true);
  assert.equal(isFeatureEnabled('investigation_academy'), true);
  assert.equal(isFeatureEnabled('unreleased_experimental_feature'), false);
});
