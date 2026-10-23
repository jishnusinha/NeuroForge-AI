import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const directory=join('.artifacts','academy-executable');
const expected=new Set(['house-prices','telecom-churn','flower-species','retail-purchase','delivery-times','energy-use','manufacturing-defects','customer-segmentation','loan-payment-risk','product-returns']);
const scripts=(await readdir(directory)).filter(name=>name.endsWith('.mjs')).map(name=>name.slice(0,-4));
if(scripts.length!==expected.size||scripts.some(name=>!expected.has(name)))throw new Error('Expected one JavaScript example for each Academy case.');
for(const name of scripts){
  const result=spawnSync(process.execPath,[`${name}.mjs`],{cwd:directory,encoding:'utf8',timeout:30000});
  if(result.status!==0)throw new Error(`${name} JavaScript example failed: ${result.stderr}`);
  const evidence=JSON.parse(result.stdout);
  if(evidence.case!==name||!Number.isInteger(evidence.sourceRows)||!evidence.rows?.length)throw new Error(`${name} emitted invalid measured evidence.`);
}
console.log(`Executed ${scripts.length} JavaScript Academy evidence examples.`);
