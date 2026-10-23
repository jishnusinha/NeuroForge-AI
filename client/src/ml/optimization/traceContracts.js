import {OBJECTIVES,freeze} from './objectives.js';
export const OPTIMIZERS=['gd','sgd','momentum','nesterov','adagrad','rmsprop','adam','adamw'];
export const finite=(n,min,max,integer=false)=>{if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max||integer&&!Number.isInteger(n))throw new Error('Invalid optimization setting');return n;};
export function simulationConfig(input={}){
 const objectiveId=input.objectiveId??'multiwell',optimizerId=input.optimizerId??'adam';
 if(!OBJECTIVES.includes(objectiveId)||!OPTIMIZERS.includes(optimizerId))throw new Error('Unknown objective or optimizer');
 if(optimizerId==='sgd'&&!['linear_data','logistic_data','neural_slice'].includes(objectiveId))throw new Error('Mini-batch SGD requires actual seeded examples');
 const start=input.start??[.3,.6];if(!Array.isArray(start)||start.length!==2)throw new Error('Invalid starting coordinates');
 return freeze({schemaVersion:1,objectiveId,optimizerId,start:start.map(n=>finite(n,-1e5,1e5)),learningRate:finite(input.learningRate??.04,Number.MIN_VALUE,1.5),steps:finite(input.steps??80,1,300,true),seed:finite(input.seed??42,0,4294967295,true),momentum:finite(input.momentum??.9,0,1-Number.EPSILON/2),beta1:finite(input.beta1??.9,0,.9999),beta2:finite(input.beta2??.999,0,.99999),epsilon:finite(input.epsilon??1e-8,1e-12,.1),weightDecay:finite(input.weightDecay??.01,0,1),batchSize:finite(input.batchSize??8,1,32,true),tolerance:finite(input.tolerance??1e-7,0,.1),permittedDomain:input.permittedDomain==='legacy'?'legacy':'viewport'});
}
export const equations={gd:'θ ← θ − αg',sgd:'g = mean gradient of actual sampled training rows; θ ← θ − αg',momentum:'v ← μv + g; θ ← θ − αv',nesterov:'g = ∇L(θ − αμv); v ← μv + g; θ ← θ − αv (explicit look-ahead convention)',adagrad:'s ← s + g²; θ ← θ − αg/(√s + ε)',rmsprop:'s ← β₂s + (1−β₂)g²; θ ← θ − αg/(√s + ε), uncentered',adam:'Bias-corrected m and s; θ ← θ − αm̂/(√ŝ + ε)',adamw:'Adam update minus α × decay × pre-step θ; decoupled from objective L2'};
