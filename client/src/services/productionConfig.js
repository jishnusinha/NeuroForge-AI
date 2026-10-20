/**
 * NeuroForge Production Configuration & Rollout Control (Phase 11)
 * Feature flags, execution limits, and resilience policies.
 */

export const PRODUCTION_CONFIG = {
  version: '1.0.0',
  schemaVersion: 2,
  
  // Feature flags for controlled rollout
  featureFlags: {
    workspace_system: true,        // Phase 2
    durable_drafts: true,          // Phase 3
    accounts_and_sync: true,       // Phase 4
    persistent_artifacts: true,    // Phase 5
    anti_leakage_prep: true,       // Phase 6
    error_explorer: true,          // Phase 7
    neural_diagnostics: true,      // Phase 8
    sweeps_and_arena: true,        // Phase 9
    investigation_academy: true,   // Phase 10
  },

  // Resource & Execution Budgets
  budgets: {
    maxDatasetRows: 2000,
    maxFeatures: 20,
    maxLayers: 6,
    maxNeuronsPerLayer: 16,
    maxSweepTotalJobs: 50,
    autosaveDebounceMs: 600,
    maxNotificationHistory: 50,
    storageQuotaSoftLimitBytes: 10 * 1024 * 1024, // 10MB
  },

  // Operational limits & fallback
  offlineSupport: true,
  workerFallbackCooperative: true,
};

export function isFeatureEnabled(flagKey) {
  return Boolean(PRODUCTION_CONFIG.featureFlags[flagKey]);
}

export function validateExecutionBudget(datasetRowCount, featureCount) {
  if (!Number.isInteger(datasetRowCount) || datasetRowCount < 2 || !Number.isInteger(featureCount) || featureCount < 1) throw new Error('INVALID_EXECUTION_BUDGET');
  if (datasetRowCount > PRODUCTION_CONFIG.budgets.maxDatasetRows) {
    throw new Error(`BUDGET_EXCEEDED: Dataset rows (${datasetRowCount}) exceeds limit (${PRODUCTION_CONFIG.budgets.maxDatasetRows}).`);
  }
  if (featureCount > PRODUCTION_CONFIG.budgets.maxFeatures) {
    throw new Error(`BUDGET_EXCEEDED: Feature count (${featureCount}) exceeds limit (${PRODUCTION_CONFIG.budgets.maxFeatures}).`);
  }
  return true;
}
