import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {learningSnippet} from '../client/src/codegen/learning/templateRegistry.js';
const root='.artifacts/f22/code-fixtures';await mkdir(root,{recursive:true});
const require=createRequire(new URL('../client/package.json',import.meta.url)),tf=pathToFileURL(require.resolve('@tensorflow/tfjs')).href;
const contexts=[
 {workspace:'playground',algorithm:'Linear Regression',method:'ols'},
 {workspace:'playground',algorithm:'Linear Regression',method:'gd',epochs:5},
 {workspace:'playground',algorithm:'Logistic Regression',epochs:5,lambda:.01,threshold:.4},
 {workspace:'workbench',algorithm:'baseline',task:'regression',features:4},
 {workspace:'workbench',algorithm:'baseline',task:'multiclass_classification',features:5,classCount:3},
 {workspace:'workbench',algorithm:'ridge',features:4,lambda:.1},
 {workspace:'workbench',algorithm:'logistic',features:6,lambda:.1,epochs:5,learningRate:.25},
 ...['sgd','momentum','adam'].map((optimizer,i)=>({workspace:'studio',optimizer,epochs:3,batchSize:i===1?7:8,layers:[{units:2,activation:'Linear'},{units:3,activation:i===1?'Tanh':'ReLU'},...(i===2?[{units:2,activation:'Tanh'}]:[]),{units:1,activation:'Sigmoid'}]}))
];
const execute=code=>JSON.parse(execFileSync(process.execPath,['--input-type=module','-'],{input:code.replace("'@tensorflow/tfjs'",JSON.stringify(tf)),encoding:'utf8',windowsHide:true,timeout:60000}).trim().split('\n').at(-1));
const manifest=[];
for(const [index,context] of contexts.entries()){
 const native=learningSnippet(context,{language:'javascript',style:'scratch'}),expected=execute(native.code),framework=learningSnippet(context,{language:'javascript',style:'framework'}),frameworkResult=execute(framework.code);
 if(frameworkResult.features!==expected.features||frameworkResult.prediction.length!==8||!Number.isFinite(frameworkResult.value))throw new Error('Invalid framework example evidence');
 await writeFile(root+'/'+index+'-native.mjs',native.code);await writeFile(root+'/'+index+'-framework.mjs',framework.code);
 for(const style of ['scratch','framework'])await writeFile(root+'/'+index+'-'+style+'.py',learningSnippet(context,{language:'python',style}).code);
 manifest.push({id:index,context:native.context,expected,javascriptFramework:frameworkResult,python:{scratch:index+'-scratch.py',framework:index+'-framework.py'},frameworkParity:['baseline','ridge','linear'].includes(native.context.family)&&['ols','ridge','gradient'].includes(native.context.method),provenance:'synthetic_example_only'});
}
await writeFile(root+'/manifest.json',JSON.stringify({kind:'neuroforge-learning-code-fixtures',schemaVersion:1,fixtures:manifest},null,2));
console.log('Exported and executed '+manifest.length+' native/TF.js examples; wrote NumPy/PyTorch fixtures for CI.');
