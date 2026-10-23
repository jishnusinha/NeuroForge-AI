export const LEARNING_CODE_VERSION=1;
const ALGORITHMS=Object.freeze({playground:{'Linear Regression':'linear','Logistic Regression':'logistic','K-Nearest Neighbors (KNN)':'knn','K-Means Clustering':'kmeans'},workbench:{baseline:'baseline',ridge:'ridge',logistic:'logistic',softmax:'softmax',knn:'knn',cart:'cart',forest:'forest'}});
const number=(value,fallback,min,max,integer=false)=>{const n=value??fallback;if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max||(integer&&!Number.isInteger(n)))throw new Error('Unsupported code example setting');return n;};
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
/** Only allowlisted configuration enters code. Data, names, IDs, weights and receipts are never read. */
export function learningContext(input){
 if(!input||!['playground','studio','workbench'].includes(input.workspace))throw new Error('Unknown code workspace');
 const workspace=input.workspace,algorithm=workspace==='studio'?'dense_network':input.algorithm;
 if(workspace!=='studio'&&!Object.hasOwn(ALGORITHMS[workspace],algorithm))throw new Error('Unknown code algorithm');
 const family=workspace==='studio'?'mlp':ALGORITHMS[workspace][algorithm];
 if(!family)return freeze({schemaVersion:1,workspace,algorithm,supported:false,reason:'This algorithm has no reviewed learning template yet; existing chart code reproduces plotted evidence only.'});
 const task=family==='kmeans'?'clustering':family==='linear'||family==='ridge'?'regression':['baseline','softmax','knn','cart','forest'].includes(family)?(input.task??'binary_classification'):'binary_classification';
 if(!['regression','binary_classification','multiclass_classification','clustering'].includes(task)||['softmax','knn'].includes(family)&&['regression','clustering'].includes(task))throw new Error('Unsupported learning task');
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
  ...(['knn','kmeans','softmax','cart','forest'].includes(family)?{k:number(input.k,5,1,31,true),clusters:number(input.clusters,3,2,8,true),maxDepth:number(input.maxDepth,4,1,10,true),minLeaf:number(input.minLeaf,3,1,30,true),trees:number(input.trees,12,1,40,true),metric:input.metric==='manhattan'?'manhattan':'euclidean',weighted:input.weighted===true}:{}),
  provenance:'synthetic_example_only',rows:40,trainingRows:32,validationRows:8});
}
export const learningConcept=context=>({baseline:'A training-only constant: mean for regression, majority class for classification.',linear:'Ordinary least squares or full-batch gradient descent for one input coordinate and one continuous response.',ridge:'Training-only standardization and a closed-form ridge objective. The intercept is not penalized.',logistic:'A sigmoid probability and binary cross-entropy, with L2 applied to weights only.',mlp:'Dense layers transform [batch, input features] into [batch, output units]; backward computes gradients, then the selected optimizer updates parameters.',knn:'Training-standardized distances and stable nearest-neighbor votes. Distance-weighted examples use inverse distance with a 1e-12 floor.',kmeans:'Lloyd updates fit centroids on training rows only; held-out inertia measures squared distance to fitted centers. Initial centers are the first K training rows.',softmax:'Multiclass logits of shape [batch, classes], stable softmax cross-entropy and full-batch gradient descent. No final-test access.',cart:'Axis-aligned CART splits minimize weighted Gini or variance. Max depth and minimum leaf size limit complexity.',forest:'Seeded bootstrap CART ensemble with sqrt(feature count) candidate features per split; majority votes or mean regression predictions.'})[context.family];
