/**
 * NeuroForge Evidence-Backed Report Builder (Phase 10)
 * Assembles scientific reports grounded strictly in recorded runs,
 * parameters, charts, samples, and documented limitations.
 */

export function createEvidenceReport({
  title,
  author = 'Researcher',
  projectId = 'default-project',
  runs = [],
  selectedSampleIds = [],
  observations = '',
  limitations = '',
  isLive = false,
}) {
  if (!title || !title.trim()) {
    throw new Error('REPORT_TITLE_REQUIRED: Title cannot be empty.');
  }
  if (!Array.isArray(runs) || runs.length === 0) {
    throw new Error('REPORT_RUNS_REQUIRED: Report must reference at least one recorded run.');
  }

  // Validate run evidence
  const runSummaries = runs.map(run => {
    return {
      runId: run._id || run.id || run.name,
      name: run.name || 'Unnamed Run',
      algorithm: run.algorithm || 'Neural Network',
      hyperparameters: run.hyperparameters || run.config || {},
      finalMetrics: {
        loss: run.metrics?.loss ?? null,
        valLoss: run.metrics?.valLoss ?? null,
        accuracy: run.metrics?.accuracy ?? null,
        valAccuracy: run.metrics?.valAccuracy ?? null,
      },
      epochCount: (run.metricHistory || []).length,
    };
  });

  const reportId = `rep-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const timestamp = new Date().toISOString();

  // Generate Markdown representation
  const markdownContent = [
    `# ${title}`,
    `**Author:** ${author} | **Generated:** ${new Date(timestamp).toLocaleDateString()} | **Project:** ${projectId}`,
    `**Report Mode:** ${isLive ? 'Live Tracked' : 'Immutable Snapshot'}`,
    '',
    '## 1. Executive Summary & Observations',
    observations || 'No written observations recorded.',
    '',
    '## 2. Experimental Evidence & Model Runs',
    '| Run Name | Algorithm | Final Loss | Val Loss | Val Accuracy | Epochs |',
    '|---|---|---|---|---|---|',
    ...runSummaries.map(r => 
      `| ${r.name} | ${r.algorithm} | ${r.finalMetrics.loss !== null ? r.finalMetrics.loss.toFixed(4) : 'N/A'} | ${r.finalMetrics.valLoss !== null ? r.finalMetrics.valLoss.toFixed(4) : 'N/A'} | ${r.finalMetrics.valAccuracy !== null ? (r.finalMetrics.valAccuracy * 100).toFixed(1) + '%' : 'N/A'} | ${r.epochCount} |`
    ),
    '',
    '## 3. Investigated Samples',
    selectedSampleIds.length > 0 
      ? `Referenced Sample IDs: ${selectedSampleIds.join(', ')}`
      : 'No specific sample cohorts isolated for this report.',
    '',
    '## 4. Known Limitations & Threats to Validity',
    limitations || 'None explicitly documented. Results apply specifically to the tested evaluation splits and random seeds.',
  ].join('\n');

  return {
    id: reportId,
    schemaVersion: 2,
    title,
    author,
    projectId,
    isLive,
    createdAt: timestamp,
    runSummaries,
    selectedSampleIds,
    observations,
    limitations,
    markdownContent,
  };
}
