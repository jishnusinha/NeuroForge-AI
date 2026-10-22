import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';

const dist = process.argv[2]?pathToFileURL(resolve(process.argv[2])+sep):new URL('../client/dist/', import.meta.url);
const html = await readFile(new URL('index.html', dist), 'utf8');
const prefix = '/NeuroForge-AI/';
const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1]);
const assets = refs.filter(ref => ref.startsWith(prefix + 'assets/'));

assert.match(html, /NeuroForge AI/, 'Expected the NeuroForge document title.');
assert(assets.some(ref => ref.endsWith('.js')), 'Expected a bundled JS asset under the Pages base URL.');
assert(assets.some(ref => ref.endsWith('.css')), 'Expected a bundled CSS asset under the Pages base URL.');
assert(refs.includes(prefix + 'favicon.svg'), 'Expected a correctly prefixed favicon URL.');

for (const asset of assets) {
  const path = asset.slice(prefix.length);
  assert(!path.includes('..'), 'Invalid bundle asset path.');
  await access(new URL(path, dist));
}
console.log(`Pages build verified: ${assets.length} correctly prefixed assets.`);
