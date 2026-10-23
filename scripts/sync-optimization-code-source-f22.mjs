import {readFile,writeFile} from 'node:fs/promises';
const files=['objectives','traceContracts','optimizerEngine','simulation'];
const source=(await Promise.all(files.map(file=>readFile('client/src/ml/optimization/'+file+'.js','utf8')))).map(text=>text.replace(/^import .*\r?\n/gm,'').replace(/\bexport /g,'')).join('\n');
const output='// Generated from the reviewed pure engine. Run node scripts/sync-optimization-code-source-f22.mjs after engine changes.\nexport const optimizationKernelSource='+JSON.stringify(source)+';\n';
const classic=await readFile('client/src/codegen/learning/classicTemplates.js','utf8');
const classicSource=classic.slice(classic.indexOf('export function classicExample'),classic.indexOf('export const classicKernelSource')).replace(/^export /,'');
const classicOutput='// Generated reviewed source; preserves readable code through production minification.\nexport const classicKernelSourceValue='+JSON.stringify(classicSource)+';\n';
if(process.argv.includes('--check')){if(await readFile('client/src/codegen/learning/optimizationKernelSource.js','utf8')!==output)throw new Error('Optimization export source is stale');}
else await writeFile('client/src/codegen/learning/optimizationKernelSource.js',output);
if(process.argv.includes('--check')){if(await readFile('client/src/codegen/learning/classicKernelSource.js','utf8')!==classicOutput)throw new Error('Classic export source is stale');}
else await writeFile('client/src/codegen/learning/classicKernelSource.js',classicOutput);
