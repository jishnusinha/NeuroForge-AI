import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {learningContext} from '../client/src/codegen/learning/contracts.js';
import {learningSnippet} from '../client/src/codegen/learning/templateRegistry.js';
const run=snippet=>JSON.parse(execFileSync(process.execPath,['--input-type=module','-'],{input:snippet.code,encoding:'utf8',windowsHide:true,timeout:60000}).trim().split('\n').at(-1));
const linear={workspace:'playground',algorithm:'Linear Regression',method:'ols',seed:42};
const logistic={workspace:'playground',algorithm:'Logistic Regression',epochs:6,features:2,learningRate:.08};
test('F22 learning code contracts strip private data and reject non-allowlisted settings',()=>{
 const snippet=learningSnippet({...logistic,sourceRows:['PRIVATE_SENTINEL'],weights:['PRIVATE_SENTINEL'],featureNames:['PRIVATE_SENTINEL'],receipt:{secret:'PRIVATE_SENTINEL'}});
 assert(!JSON.stringify(snippet).includes('PRIVATE_SENTINEL'));assert.equal(snippet.context.provenance,'synthetic_example_only');
 for(const patch of [{algorithm:'eval("x")'},{learningRate:'0.1;evil()'},{features:1000},{seed:NaN},{epochs:0}])assert.throws(()=>learningSnippet({...logistic,...patch}));
 assert.throws(()=>learningSnippet(logistic,{language:'html'}));assert.throws(()=>learningSnippet(logistic,{style:'unreviewed'}));
 assert.throws(()=>learningSnippet({workspace:'studio',layers:[{units:2,activation:'Linear'},{units:1,activation:'evil()'}]}));
});
test('F22 normalized code context is immutable and does not freeze caller objects',()=>{const input={workspace:'studio',layers:[{units:2,activation:'Linear'},{units:4,activation:'Tanh'},{units:1,activation:'Sigmoid'}]},context=learningContext(input);input.layers[1].units=8;assert.equal(context.layers[1].units,4);assert(Object.isFrozen(context.layers[1]));assert(!Object.isFrozen(input.layers[1]));});
test('F22 ordinary least squares example reproduces the known noiseless line',()=>{const snippet=learningSnippet(linear,{language:'javascript',style:'scratch'}),result=run(snippet);assert.equal(result.features,1);assert.equal(result.prediction.length,8);assert(result.value<1e-24);assert.equal(result.updates,0);assert.equal(result.mode,'synthetic_example_only');assert.match(learningSnippet(linear).code,/torch.linalg.lstsq/);});
test('F22 native examples are deterministic, parameter-sensitive and finite for reviewed methods',()=>{
 const configs=[logistic,{...linear,method:'gd',epochs:6},{workspace:'workbench',algorithm:'ridge',features:4,lambda:.1},{workspace:'workbench',algorithm:'baseline',features:4,task:'multiclass_classification',classCount:3},...['sgd','momentum','adam'].map(optimizer=>({workspace:'studio',optimizer,epochs:4,batchSize:8}))];
 for(const context of configs){const snippet=learningSnippet(context,{language:'javascript',style:'scratch'}),a=run(snippet),b=run(snippet);assert.deepEqual(a,b);assert(Number.isFinite(a.value));assert(a.prediction.every(Number.isFinite));assert.equal(a.prediction.length,8);}
 assert.notDeepEqual(run(learningSnippet(logistic,{language:'javascript',style:'scratch'})).prediction,run(learningSnippet({...logistic,learningRate:.2},{language:'javascript',style:'scratch'})).prediction);
});
test('F22 TF.js framework example executes its configured shapes and disposes tensors',()=>{
 const require=createRequire(new URL('../client/package.json',import.meta.url)),uri=pathToFileURL(require.resolve('@tensorflow/tfjs')).href;
 for(const context of [logistic,{workspace:'studio',epochs:2,batchSize:8,layers:[{units:2,activation:'Linear'},{units:3,activation:'Tanh'},{units:1,activation:'Sigmoid'}]}]){
  const snippet=learningSnippet(context,{language:'javascript',style:'framework'}),result=run({...snippet,code:snippet.code.replace("'@tensorflow/tfjs'",JSON.stringify(uri))+"\nif(tf.memory().numTensors!==0)throw new Error('TF.js example leaked tensors');\n"});assert.equal(result.features,2);assert.equal(result.prediction.length,8);assert(Number.isFinite(result.value));assert.equal(result.updates,context.workspace==='studio'?8:6);
 }
});
test('F22 unsupported models never emit an unrelated runnable template',()=>{for(const algorithm of ['knn','cart','forest','softmax']){const snippet=learningSnippet({workspace:'workbench',algorithm});assert.equal(snippet.available,false);assert.equal(snippet.code,undefined);assert.match(snippet.reason,/no reviewed F22.0 template/);}});
