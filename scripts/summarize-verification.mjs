import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { relative } from 'node:path';

const summary = {
  recordedAt: new Date().toISOString(),
  node: process.version,
  platform: process.platform,
  storageModes: {},
};

function specs(suite) {
  return [...(suite.specs || []), ...(suite.suites || []).flatMap(specs)];
}

for (const mode of ['database', 'memory']) {
  const reportPath = `.artifacts/e2e-${mode}/results.json`;
  const htmlReportPath = `.artifacts/e2e-${mode}/report/index.html`;
  try {
    const report = JSON.parse(await readFile(reportPath, 'utf8'));
    if (!Array.isArray(report.suites) || !report.stats ||
        !Number.isFinite(report.stats.expected) ||
        !Number.isFinite(report.stats.unexpected) ||
        !Number.isFinite(report.stats.skipped)) {
      throw new Error('Invalid Playwright JSON report structure');
    }
    const measurements = [];
    for (const spec of report.suites.flatMap(specs)) {
      for (const test of spec.tests || []) {
        const result = test.results?.at(-1);
        for (const attachment of result?.attachments || []) {
          if (!['performance-baseline', 'training-baseline'].includes(attachment.name)) continue;
          const value = JSON.parse(attachment.path
            ? await readFile(attachment.path, 'utf8')
            : Buffer.from(attachment.body, 'base64').toString());
          measurements.push({ project: test.projectName, type: attachment.name, ...value });
        }
      }
    }
    summary.storageModes[mode] = {
      status: 'recorded',
      passed: report.stats.expected,
      failed: report.stats.unexpected,
      skipped: report.stats.skipped,
      durationMs: report.stats.duration,
      report: relative(process.cwd(), htmlReportPath),
      measurements,
    };
  } catch (error) {
    // Preserve an actionable summary when an earlier CI step failed before browser tests.
    // Missing or malformed evidence must never be mistaken for a passing verification.
    summary.storageModes[mode] = {
      status: 'unavailable',
      passed: 0,
      failed: 0,
      skipped: 0,
      report: relative(process.cwd(), reportPath),
      measurements: [],
      error: `${error.code || error.name}: ${error.message}`,
    };
  }
}

await mkdir('.artifacts', { recursive: true });
await writeFile('.artifacts/verification-summary.json', JSON.stringify(summary, null, 2));

for (const [mode, result] of Object.entries(summary.storageModes)) {
  console.log(`${mode}: ${result.status} · ${result.passed} passed, ${result.failed} failed, ${result.skipped} skipped`);
  if (result.error) console.error(`${mode}: ${result.error}`);
  for (const row of result.measurements) {
    console.log(JSON.stringify({
      project: row.project, type: row.type, readyMs: row.readyMs,
      modelReadyMs: row.modelReadyMs, tenEpochsMs: row.tenEpochsMs, stopMs: row.stopMs,
    }));
  }
}

if (Object.values(summary.storageModes).some(result =>
  result.status !== 'recorded' || result.failed || result.skipped || result.passed < 14)) {
  process.exitCode = 1;
}
