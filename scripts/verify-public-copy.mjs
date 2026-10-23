import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const roots=['client/src/pages','client/src/components','client/src/design','client/src/codegen/learning','client/src/visualization/pythonCodegen.js','client/src/ml/modelRegistry/reports.js'];
const phasePrefix=/\bF(?:1[0-9]|2[0-2])(?=\s|[—–·:/-])(?:\s*[—–·:/-]\s*)?/;
const offenders=[];
async function inspect(path){
  let info;try{info=await (await import('node:fs/promises')).stat(path);}catch{return;}
  if(info.isDirectory()){for(const entry of await readdir(path))await inspect(join(path,entry));return;}
  if(!path.endsWith('.jsx')&&!path.includes('codegen/learning')&&!path.endsWith('pythonCodegen.js')&&!path.endsWith('reports.js'))return;
  const content=await readFile(path,'utf8');
  content.split(/\r?\n/).forEach((line,index)=>{if(phasePrefix.test(line))offenders.push(`${path}:${index+1}`);});
}
for(const root of roots)await inspect(root);
if(offenders.length)throw new Error(`Public copy exposes phase labels:\n${offenders.join('\n')}`);
console.log('Public UI and generated learning copy contain no feature-phase labels.');
