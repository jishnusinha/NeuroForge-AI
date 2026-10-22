import {learningContext,learningConcept} from './contracts.js';
import {pythonScratch,pythonFramework} from './pythonTemplates.js';
import {javascriptScratch,javascriptFramework} from './javascriptTemplates.js';
const registry=Object.freeze({python:Object.freeze({scratch:pythonScratch,framework:pythonFramework}),javascript:Object.freeze({scratch:javascriptScratch,framework:javascriptFramework})});
export function learningSnippet(input,{language='python',style='framework'}={}){
 const context=learningContext(input);
 if(!context.supported)return {context,available:false,reason:context.reason};
 const template=registry[language]?.[style];if(!template)throw new Error('Unknown allowlisted template');
 const native=language==='javascript'&&(context.family==='baseline'||['ols','ridge'].includes(context.method));
 const code=template(context),framework=language==='python'?(style==='scratch'?'NumPy':'PyTorch'):style==='scratch'||native?'Native JavaScript':'TensorFlow.js';
 return Object.freeze({available:true,context,language,style,framework,code,concept:learningConcept(context),
  filename:'neuroforge-example.'+(language==='python'?'py':'mjs'),
  dependencies:language==='python'?[style==='scratch'?'numpy==2.2.6':'torch==2.5.1']:framework==='TensorFlow.js'?['@tensorflow/tfjs@4.22.0']:['Node.js 24'],
  shapes:context.family==='baseline'?[`[batch, ${context.features}] → training-only constant → [batch, 1]`]:context.layers.slice(1).map((layer,i)=>`[batch, ${context.layers[i].units}] → Dense(${context.layers[i].units}, ${layer.units}) → ${layer.activation} → [batch, ${layer.units}]`),
  provenance:'Synthetic example only. Current reviewed settings and dimensions are used; source observations, feature names, fitted preprocessing, split membership and saved weights are absent. This is not exact browser-run reproduction.',
  recipe:'40 deterministic LCG-generated observations, seed '+context.seed+'. First 32 train; last 8 validate. Synthetic feature order: feature_1 through feature_'+context.features+'. No final-test access. Fixed epoch budget; source preprocessing, browser early stopping and historical checkpoints are not reproduced. Framework initializers and precision differ; outputs need not match each other or observed browser evidence.'});
}
