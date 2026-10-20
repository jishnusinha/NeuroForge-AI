import { digest } from '../../../shared/domain.mjs';
import { applyEdaFilters } from './edaFilters.js';
import { missingnessEvidence } from './edaMissingness.js';
import { qualityEvidence } from './edaQuality.js';

/** Build a reproducibility receipt, excluding raw observations by design. */
export async function buildEdaReport(dataset, filters = [], notes = '', sourceName = 'Imported dataset') {
  const selected = applyEdaFilters(dataset, filters);
  const subset = { headers: dataset.headers, rows: selected.rows };
  const fingerprint = await digest({ headers: dataset.headers, rows: dataset.rows.map(row =>
    ({ id: row.id ?? null, values: dataset.headers.map(header => row[header] ?? null) })) });
  const missingness = missingnessEvidence(subset);
  const quality = qualityEvidence(subset);
  return {
    kind: 'neuroforge-eda-evidence', schemaVersion: 1, edaEngineVersion: 'F10.1',
    createdAt: new Date().toISOString(), sourceName, datasetDigest: fingerprint,
    sourceCount: selected.sourceCount, selectedCount: selected.visibleCount,
    columns: [...dataset.headers], filters: selected.rules,
    methods: [missingness.method, quality.method, 'Pairwise-complete Pearson/Spearman on demand'],
    missingCells: missingness.columns.reduce((sum, item) => sum + item.missing, 0),
    completeRecords: missingness.complete,
    qualityFindings: quality.findings.map(({ id, column, severity, label, count, method }) =>
      ({ id, column, severity, label, count, method })),
    observations: String(notes).slice(0, 4000),
    limitations: 'Descriptive, browser-local evidence. No imputation or causal claims. Filtering changes the analysis population. The source rows are not included in this export.',
  };
}

export function edaReportMarkdown(report) {
  const safe = value => String(value ?? '').replace(/\|/g, '\\|').replace(/\r/g, '').replace(/\n/g, ' ');
  return [
    '# NeuroForge — Exploratory Data Analysis',
    '', '## Source and scope',
    '- Source: ' + safe(report.sourceName),
    '- Dataset SHA-256: ' + report.datasetDigest,
    '- Source rows: ' + report.sourceCount,
    '- Analyzed rows: ' + report.selectedCount,
    '- Columns: ' + report.columns.map(safe).join(', '),
    '- Timestamp: ' + report.createdAt,
    '- Engine: ' + report.edaEngineVersion,
    '', '## Filters', '', '```json', JSON.stringify(report.filters, null, 2), '```',
    '', '## Observed quality evidence', '',
    '| Finding | Count | Method |', '| --- | ---: | --- |',
    ...report.qualityFindings.map(item =>
      '| ' + safe(item.label) + ' | ' + item.count + ' | ' + safe(item.method) + ' |'),
    '', '- Missing cells within analyzed scope: ' + report.missingCells,
    '- Complete records within analyzed scope: ' + report.completeRecords,
    '', '## Research notes', '', report.observations || '_No notes recorded._',
    '', '## Limitations', '', report.limitations,
    '', 'Raw observations were not exported.',
  ].join('\n');
}
