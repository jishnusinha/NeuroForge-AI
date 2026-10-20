import { spawn } from 'node:child_process';
const storage = process.argv[2] || 'database';
if (!['database','memory'].includes(storage)) throw new Error('Choose database or memory test storage.');
const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js','test',...process.argv.slice(3)], {
  stdio:'inherit', windowsHide:true, env:{...process.env,NEUROFORGE_E2E_STORAGE:storage},
});
child.on('error', error => { console.error(error.message); process.exitCode=1; });
child.on('exit', code => { process.exitCode=code ?? 1; });
