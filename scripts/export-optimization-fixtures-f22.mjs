import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {simulate} from '../client/src/ml/optimization/simulation.js';
import {OPTIMIZERS} from '../client/src/ml/optimization/traceContracts.js';
import {OBJECTIVES} from '../client/src/ml/optimization/objectives.js';
import {optimizationPython} from '../client/src/codegen/learning/optimizationTemplates.js';
import {searchPython,searchJavascript} from '../client/src/codegen/learning/searchTemplates.js';
const root='.artifacts/f22/optimization-fixtures';await mkdir(root,{recursive:true});
const configs=[...OPTIMIZERS.map(optimizerId=>({objectiveId:optimizerId==='sgd'?'logistic_data':'bowl',optimizerId,start:[1,1],learningRate:.03,steps:6,seed:73,beta2:.99})),...OBJECTIVES.map(objectiveId=>({objectiveId,optimizerId:'adam',steps:12,seed:42})),{objectiveId:'saddle',optimizerId:'gd',start:[1,1],learningRate:1,steps:20}];
const expected=configs.map(simulate);await writeFile(root+'/reference.json',JSON.stringify(expected,null,2));
for(const framework of [true,false])await writeFile(root+'/'+(framework?'framework':'scratch')+'.py',optimizationPython(configs,{framework}));
const searches=[];
for(const algorithm of ['baseline','ridge','logistic','knn','softmax','cart','forest']){
 const context={workspace:'workbench',algorithm,task:['ridge'].includes(algorithm)?'regression':'binary_classification',features:3,folds:3,seed:42,metric:algorithm==='ridge'?'rmse':'macroF1'};
 const js=searchJavascript(context),result=JSON.parse(execFileSync(process.execPath,['--input-type=module','-'],{input:js,encoding:'utf8',windowsHide:true,timeout:60000}));
 if(result.holdoutAccess!==false||!result.results.every(r=>r.scores.length===3&&r.scores.every(Number.isFinite)))throw new Error('Invalid search recipe');
 await writeFile(root+'/search-'+algorithm+'.mjs',js);await writeFile(root+'/search-'+algorithm+'.py',searchPython(context));searches.push({algorithm,result});
}
await writeFile(root+'/search-reference.json',JSON.stringify(searches,null,2));
console.log(`Exported ${configs.length} optimization configurations in both Python styles, executed all seven JS search recipes.`);
