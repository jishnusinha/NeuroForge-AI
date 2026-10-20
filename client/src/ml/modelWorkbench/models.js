/**
 * Small, deterministic, browser-local N-feature models. Models see only
 * training rows. Each fitted artifact is JSON-safe and supports replay.
 */
const numeric = value => typeof value === 'number' && Number.isFinite(value);
const clamp = (value,low,high) => Math.max(low,Math.min(high,value));
const sigmoid = value => 1 / (1 + Math.exp(-clamp(value,-35,35)));
const dot = (left,right) => left.reduce((sum,value,index)=>sum+value*right[index],0);

export const MODEL_DEFINITIONS = Object.freeze([
  { id:'baseline',label:'Training-only baseline',tasks:['regression','binary_classification','multiclass_classification'] },
  { id:'logistic',label:'Logistic regression (N features)',tasks:['binary_classification'] },
  { id:'ridge',label:'Ridge regression (N features)',tasks:['regression'] },
  { id:'knn',label:'k-Nearest Neighbors (N features)',tasks:['binary_classification','multiclass_classification'] },
]);

const vectors = rows => rows.map(row => row.values);
function fitStandardizer(trainRows) {
  const n = trainRows.length, columns = trainRows[0].values.length;
  const mean=Array.from({length:columns},(_,j)=>trainRows.reduce((sum,row)=>sum+row.values[j],0)/n);
  const scale=Array.from({length:columns},(_,j)=>{
    const v=Math.sqrt(trainRows.reduce((sum,row)=>sum+(row.values[j]-mean[j])**2,0)/n);
    return v>1e-12?v:1;
  });
  return {mean,scale};
}
const standardized = (vector,stat) => vector.map((value,i)=>(value-stat.mean[i])/stat.scale[i]);

function solveLinearSystem(matrix, rhs) {
  const a=matrix.map((row,i)=>[...row,rhs[i]]);
  const n=a.length;
  for(let col=0;col<n;col++) {
    let pivot=col;
    for(let row=col+1;row<n;row++) if(Math.abs(a[row][col])>Math.abs(a[pivot][col])) pivot=row;
    if(Math.abs(a[pivot][col])<1e-12) throw new Error('F12_SINGULAR_SYSTEM');
    [a[pivot],a[col]]=[a[col],a[pivot]];
    const divisor=a[col][col];
    for(let j=col;j<=n;j++)a[col][j]/=divisor;
    for(let row=0;row<n;row++)if(row!==col) {
      const factor=a[row][col];
      for(let j=col;j<=n;j++)a[row][j]-=factor*a[col][j];
    }
  }
  const coefficients=a.map(row=>row[n]);
  if(!coefficients.every(numeric))throw new Error('F12_NONFINITE_COEFFICIENT');
  return coefficients;
}

function validateModelConfig(matrix, algorithm, options) {
  const def=MODEL_DEFINITIONS.find(item=>item.id===algorithm);
  if(!def||!def.tasks.includes(matrix?.task?.type))throw new Error('F12_UNSUPPORTED_MODEL_TASK');
  if(matrix.features.length<1||matrix.features.length>20)throw new Error('F12_FEATURE_LIMIT');
  const lambda=options.lambda??0.1;
  if(['ridge','logistic'].includes(algorithm) && (!numeric(lambda)||lambda<0.000001||lambda>10))
    throw new Error('F12_REGULARIZATION_RANGE');
  const k=options.k??5;
  if(algorithm==='knn' && (!Number.isInteger(k)||k<1||k>25))
    throw new Error('F12_K_RANGE');
  const epochs=options.epochs??180;
  if(algorithm==='logistic'&&(!Number.isInteger(epochs)||epochs<20||epochs>400))
    throw new Error('F12_EPOCH_RANGE');
  return {lambda,k,epochs};
}

export function fitWorkbenchModel(matrix,algorithm,options={}) {
  const cfg=validateModelConfig(matrix,algorithm,options);
  const train=matrix.rows.filter(row=>row.split==='train');
  if(train.length<2)throw new Error('F12_INSUFFICIENT_TRAINING_ROWS');
  const task=matrix.task.type, classes=[...matrix.task.classes];
  const fitted={schemaVersion:1,kind:'neuroforge-f12-model',algorithm,task,classes,
    features:[...matrix.features],trainingCount:train.length,parameters:{}};
  if(algorithm==='baseline') {
    if(task==='regression')fitted.parameters.mean=train.reduce((sum,row)=>sum+row.target,0)/train.length;
    else {
      const counts=classes.map(name=>train.filter(row=>row.target===name).length);
      fitted.parameters.probabilities=counts.map(n=>n/train.length);
      fitted.parameters.majority=counts.indexOf(Math.max(...counts));
    }
  }
  if(algorithm==='ridge') {
    const stat=fitStandardizer(train);
    const p=matrix.features.length+1;
    const gram=Array.from({length:p},()=>Array(p).fill(0));
    const rhs=Array(p).fill(0);
    for(const row of train) {
      const x=[1,...standardized(row.values,stat)];
      for(let i=0;i<p;i++) {
        rhs[i]+=x[i]*row.target;
        for(let j=0;j<p;j++)gram[i][j]+=x[i]*x[j];
      }
    }
    for(let i=1;i<p;i++)gram[i][i]+=cfg.lambda*train.length;
    fitted.parameters={standardizer:stat,weights:solveLinearSystem(gram,rhs),lambda:cfg.lambda};
  }
  if(algorithm==='logistic') {
    const stat=fitStandardizer(train);
    const weights=Array(matrix.features.length+1).fill(0);
    const rate=0.25;
    for(let epoch=0;epoch<cfg.epochs;epoch++) {
      const grad=Array(weights.length).fill(0);
      for(const row of train) {
        const x=[1,...standardized(row.values,stat)];
        const error=sigmoid(dot(weights,x))-Number(row.target===classes[1]);
        for(let j=0;j<grad.length;j++)grad[j]+=error*x[j];
      }
      for(let j=0;j<weights.length;j++) {
        const regularization=j===0?0:cfg.lambda*weights[j];
        weights[j]-=rate*(grad[j]/train.length+regularization);
      }
    }
    if(weights.some(value=>!numeric(value)))throw new Error('F12_TRAINING_DIVERGED');
    fitted.parameters={standardizer:stat,weights,lambda:cfg.lambda,epochs:cfg.epochs};
  }
  if(algorithm==='knn') {
    const stat=fitStandardizer(train);
    fitted.parameters={standardizer:stat,k:Math.min(cfg.k,train.length),
      training:train.map(row=>({id:row.id,values:standardized(row.values,stat),target:row.target}))};
  }
  return fitted;
}

export function predictWorkbenchModel(model,inputs) {
  if(model?.schemaVersion!==1||model.kind!=='neuroforge-f12-model'||!Array.isArray(model.features)||
      !Array.isArray(inputs))throw new Error('F12_INVALID_MODEL_ARTIFACT');
  return inputs.map(vector=>{
    if(!Array.isArray(vector)||vector.length!==model.features.length||!vector.every(numeric))
      throw new Error('F12_PREDICTION_SCHEMA_MISMATCH');
    const p=model.parameters;
    if(model.task==='regression') {
      const predicted=model.algorithm==='baseline'?p.mean:dot(p.weights,[1,...standardized(vector,p.standardizer)]);
      if(!numeric(predicted))throw new Error('F12_NONFINITE_PREDICTION');
      return {predicted,probabilities:null};
    }
    let probabilities;
    if(model.algorithm==='baseline')probabilities=[...p.probabilities];
    if(model.algorithm==='logistic') {
      const prob=sigmoid(dot(p.weights,[1,...standardized(vector,p.standardizer)]));
      probabilities=[1-prob,prob];
    }
    if(model.algorithm==='knn') {
      const input=standardized(vector,p.standardizer);
      const distances=p.training.map((row,index)=>({
        index,target:row.target,dist:row.values.reduce((sum,x,j)=>sum+(x-input[j])**2,0),
      })).sort((a,b)=>a.dist-b.dist||a.index-b.index).slice(0,p.k);
      const scores=model.classes.map(value=>distances.filter(item=>item.target===value).length);
      probabilities=scores.map(score=>score/distances.length);
    }
    if(!probabilities||probabilities.length!==model.classes.length||
        probabilities.some(v=>!numeric(v)||v<0||v>1))throw new Error('F12_INVALID_PROBABILITIES');
    const index=probabilities.indexOf(Math.max(...probabilities));
    return {predicted:model.classes[index],probabilities};
  });
}
