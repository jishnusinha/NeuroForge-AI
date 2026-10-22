export const LEARNING_CODE_VERSION=1;
const ALGORITHMS=Object.freeze({playground:{'Linear Regression':'linear','Logistic Regression':'logistic','K-Nearest Neighbors (KNN)':null,'K-Means Clustering':null},workbench:{baseline:'baseline',ridge:'ridge',logistic:'logistic',softmax:null,knn:null,cart:null,forest:null}});
const number=(value,fallback,min,max,integer=false)=>{const n=value??fallback;if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max||(integer&&!Number.isInteger(n)))throw new Error('Unsupported code example setting');return n;};
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
/** Only allowlisted configuration enters code. Data, names, IDs, weights and receipts are never read. */
export function learningContext(input){
 if(!input||!['playground','studio','workbench'].includes(input.workspace))throw new Error('Unknown code workspace');
 const workspace=input.workspace,algorithm=workspace==='studio'?'dense_network':input.algorithm;
 if(workspace!=='studio'&&!Object.hasOwn(ALGORITHMS[workspace],algorithm))throw new Error('Unknown code algorithm');
 const family=workspace==='studio'?'mlp':ALGORITHMS[workspace][algorithm];
 if(!family)return freeze({schemaVersion:1,workspace,algorithm,supported:false,reason:'This algorithm has no reviewed F22.0 template. Expanded model templates belong to F22.4; existing chart code reproduces plotted evidence only.'});
 const task=family==='linear'||family==='ridge'?'regression':family==='baseline'?(input.task??'binary_classification'):'binary_classification';
 if(!['regression','binary_classification','multiclass_classification'].includes(task))throw new Error('Unsupported learning task');
 const features=number(family==='linear'?1:workspace==='studio'?2:input.features,2,1,64,true);
 const epochs=number(input.epochs,90,1,5000,true),seed=number(input.seed,42,0,4294967295,true);
 const optimizer=workspace==='studio'?(input.optimizer??'adam'):'gd';
 if(!['gd','sgd','momentum','adam'].includes(optimizer))throw new Error('Unsupported example optimizer');
 const method=family==='linear'?(input.method??'ols'):family==='ridge'?'ridge':'gradient';
 if(!['ols','ridge','gd','gradient'].includes(method))throw new Error('Unsupported solver');
 const requested=workspace==='studio'?(input.layers??[{units:2,activation:'Linear'},{units:4,activation:'ReLU'},{units:1,activation:'Sigmoid'}]):[{units:features,activation:'Linear'},{units:1,activation:task==='regression'?'Linear':'Sigmoid'}];
 if(!Array.isArray(requested)||requested.length<2||requested.length>6)throw new Error('Unsupported example architecture');
 const layers=requested.map(l=>({units:number(l.units,undefined,1,workspace==='studio'?16:64,true),activation:l.activation}));
 if(layers.length<2||layers.length>6||layers[0].units!==features||layers.at(-1).units!==1||layers.some(l=>!['Linear','ReLU','Tanh','Sigmoid'].includes(l.activation))||(workspace==='studio'&&layers.at(-1).activation!=='Sigmoid'))throw new Error('Unsupported example architecture');
 return freeze({schemaVersion:1,templateVersion:LEARNING_CODE_VERSION,supported:true,workspace,algorithm,family,task,features,layers,method,epochs,seed,optimizer,
  learningRate:number(input.learningRate,.08,.000001,1.5),lambda:workspace==='studio'||['linear','baseline'].includes(family)?0:number(input.lambda,family==='ridge'?.1:0,family==='ridge'?.000001:0,10),threshold:number(input.threshold,.5,0,1),batchSize:workspace==='studio'?number(input.batchSize,16,1,128,true):32,
  classCount:task==='multiclass_classification'?number(input.classCount,3,2,12,true):2,
  provenance:'synthetic_example_only',rows:40,trainingRows:32,validationRows:8});
}
export const learningConcept=context=>({baseline:'A training-only constant: mean for regression, majority class for classification.',linear:'Ordinary least squares or full-batch gradient descent for one input coordinate and one continuous response.',ridge:'Training-only standardization and a closed-form ridge objective. The intercept is not penalized.',logistic:'A sigmoid probability and binary cross-entropy, with L2 applied to weights only.',mlp:'Dense layers transform [batch, input features] into [batch, output units]; backward computes gradients, then the selected optimizer updates parameters.'})[context.family];
