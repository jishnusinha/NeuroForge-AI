import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { relative } from 'node:path';
const summary={recordedAt:new Date().toISOString(),node:process.version,platform:process.platform,storageModes:{}};
function specs(suite) { return [...(suite.specs || []),...(suite.suites || []).flatMap(specs)]; }
for (const mode of ['database','memory']) {
  const report=JSON.parse(await readFile(`.artifacts/e2e-${mode}/results.json`,'utf8'));
  const measurements=[];
  for (const spec of report.suites.flatMap(specs)) for (const test of spec.tests || []) {
    const result=test.results.at(-1);
    for (const attachment of result?.attachments || []) {
      if (!['performance-baseline','training-baseline'].includes(attachment.name)) continue;
      const value=JSON.parse(attachment.path ? await readFile(attachment.path,'utf8') : Buffer.from(attachment.body,'base64').toString());
      measurements.push({project:test.projectName,type:attachment.name,...value});
    }
  }
  summary.storageModes[mode]={passed:report.stats.expected,failed:report.stats.unexpected,skipped:report.stats.skipped,
    durationMs:report.stats.duration,report:relative(process.cwd(),`.artifacts/e2e-${mode}/report/index.html`),measurements};
}
await mkdir('.artifacts',{recursive:true});
await writeFile('.artifacts/verification-summary.json',JSON.stringify(summary,null,2));
for (const [mode,result] of Object.entries(summary.storageModes)) {
  console.log(`${mode}: ${result.passed} passed, ${result.failed} failed, ${result.skipped} skipped`);
  for (const row of result.measurements) console.log(JSON.stringify({project:row.project,type:row.type,readyMs:row.readyMs,modelReadyMs:row.modelReadyMs,tenEpochsMs:row.tenEpochsMs,stopMs:row.stopMs}));
}
if (Object.values(summary.storageModes).some(result=>result.failed || result.skipped || result.passed<14)) process.exitCode=1;
