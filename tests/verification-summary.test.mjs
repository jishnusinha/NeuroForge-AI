import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/summarize-verification.mjs', import.meta.url));
const fixture = { stats: { expected: 24, unexpected: 0, skipped: 0, duration: 1200 }, suites: [] };

async function withSandbox(run) {
  const cwd = await mkdtemp(join(tmpdir(), 'neuroforge-summary-'));
  try { await run(cwd); } finally { await rm(cwd, { recursive: true, force: true }); }
}

async function record(cwd, mode, report = fixture) {
  const dir = join(cwd, '.artifacts', `e2e-${mode}`);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'results.json'), JSON.stringify(report));
}

function execute(cwd) {
  return spawnSync(process.execPath, [script], { cwd, encoding: 'utf8' });
}

async function readSummary(cwd) {
  return JSON.parse(await readFile(join(cwd, '.artifacts', 'verification-summary.json'), 'utf8'));
}

test('verification summary records missing reports and fails without obscuring original CI failure', async () => {
  await withSandbox(async cwd => {
    await record(cwd, 'database');
    const result = execute(cwd);
    assert.equal(result.status, 1, result.stderr);
    const summary = await readSummary(cwd);
    assert.equal(summary.storageModes.database.status, 'recorded');
    assert.equal(summary.storageModes.database.passed, 24);
    assert.equal(summary.storageModes.memory.status, 'unavailable');
    assert.match(summary.storageModes.memory.error, /ENOENT/);
  });
});

test('verification summary accepts real-looking successful reports for both storage modes', async () => {
  await withSandbox(async cwd => {
    await record(cwd, 'database');
    await record(cwd, 'memory');
    const result = execute(cwd);
    assert.equal(result.status, 0, result.stderr);
    const summary = await readSummary(cwd);
    assert.equal(summary.storageModes.database.status, 'recorded');
    assert.equal(summary.storageModes.memory.status, 'recorded');
    assert.equal(summary.storageModes.database.failed, 0);
  });
});

test('verification summary rejects malformed evidence without crashing', async () => {
  await withSandbox(async cwd => {
    await record(cwd, 'database', { suites: [] });
    await record(cwd, 'memory');
    const result = execute(cwd);
    assert.equal(result.status, 1);
    const summary = await readSummary(cwd);
    assert.equal(summary.storageModes.database.status, 'unavailable');
    assert.match(summary.storageModes.database.error, /Invalid Playwright JSON report structure/);
  });
});
