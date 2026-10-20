import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('F10 release documentation distinguishes GitHub Pages from cloud accounts',async()=>{
 const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
 const [security,release,docs,contrib]=await Promise.all([
  read('SECURITY.md'),read('docs/RELEASE_CHECKLIST.md'),read('docs/FEATURE_MATRIX.md'),read('CONTRIBUTING.md'),
 ]);
 for(const source of [security,release,docs,contrib]){
  assert.match(source,/GitHub Pages/);
  assert.match(source,/(secret|credential)/i);
 }
 assert.match(release,/NOT automatically released/);
 assert.match(docs,/must not be marked deployed/);
});

test('F10 public Pages deployment uses an isolated static build and release checks',async()=>{
 const workflow=await readFile(new URL('../.github/workflows/deploy-pages.yml',import.meta.url),'utf8');
 assert.match(workflow,/GITHUB_PAGES: 'true'/);
 assert.match(workflow,/VITE_STATIC_DEMO: 'true'/);
 assert.match(workflow,/scripts\/verify-pages-build\.mjs/);
 assert.match(workflow,/npm test/);
 assert.match(workflow,/npm run lint/);
 assert.doesNotMatch(workflow,/(MONGODB_URI:|AUTH_EMAIL_WEBHOOK_SECRET:|AWS_ACCESS_KEY_ID:)/);
});
