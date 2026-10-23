export function javascriptScratch(c){return `// NeuroForge synthetic example only / template v1
// Dependencies: Node.js 24. Run: node neuroforge-example.mjs
// No source observations, names, split membership or model weights are embedded.
const C = ${JSON.stringify(c,null,2)};
let state = C.seed >>> 0;
const random = () => {state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296;};
const X = Array.from({length:40}, () => Array.from({length:C.features}, () => 2*random()-1));
const y = X.map(row => C.task === 'regression' ? .3 + row.reduce((sum,x,j)=>sum+x*(j+1)/C.features,0) : C.family === 'mlp' ? Number((row[0]>0)!==(row[1]>0)) : C.task === 'multiclass_classification' ? Math.min(C.classCount-1,Math.floor((row[0]+1)*C.classCount/2)) : Number(row.reduce((a,b)=>a+b,0)>0));
let A=X.slice(0,32).map(row=>[...row]), B=X.slice(32).map(row=>[...row]), prediction, updates=0;
const sum=values=>values.reduce((a,b)=>a+b,0);
if(C.family==='baseline'){
 const counts=Array(C.classCount).fill(0); y.slice(0,32).forEach(v=>{if(C.task!=='regression')counts[v]++;});
 const constant=C.task==='regression'?sum(y.slice(0,32))/32:counts.indexOf(Math.max(...counts));
 prediction=Array(8).fill(constant);
}else if(['ols','ridge'].includes(C.method)){
 if(C.method==='ridge'){
  const mean=Array.from({length:C.features},(_,j)=>sum(A.map(row=>row[j]))/32);
  const scale=mean.map((m,j)=>Math.sqrt(sum(A.map(row=>(row[j]-m)**2))/32)).map(s=>s>1e-12?s:1);
  A=A.map(row=>row.map((v,j)=>(v-mean[j])/scale[j]));B=B.map(row=>row.map((v,j)=>(v-mean[j])/scale[j]));
 }
 A=A.map(row=>[1,...row]);B=B.map(row=>[1,...row]);const n=A[0].length;
 const matrix=Array.from({length:n},(_,i)=>[...Array.from({length:n},(_,j)=>sum(A.map(row=>row[i]*row[j]))+(C.method==='ridge'&&i===j&&i>0?C.lambda*32:0)),sum(A.map((row,k)=>row[i]*y[k]))]);
 // Partial pivoting; the intercept is excluded from the ridge penalty.
 for(let col=0;col<n;col++){
  let pivot=col;for(let row=col+1;row<n;row++)if(Math.abs(matrix[row][col])>Math.abs(matrix[pivot][col]))pivot=row;
  [matrix[col],matrix[pivot]]=[matrix[pivot],matrix[col]];
  const d=matrix[col][col];if(Math.abs(d)<1e-12)throw new Error('Singular example design');
  for(let j=col;j<=n;j++)matrix[col][j]/=d;
  for(let row=0;row<n;row++)if(row!==col){const factor=matrix[row][col];for(let j=col;j<=n;j++)matrix[row][j]-=factor*matrix[col][j];}
 }
 const weights=matrix.map(row=>row[n]);prediction=B.map(row=>sum(row.map((v,j)=>v*weights[j])));
}else{
 const params=[];
 for(let l=1;l<C.layers.length;l++){const n=C.layers[l-1].units,m=C.layers[l].units,r=Math.sqrt(6/(n+m));params.push(Array.from({length:n*m},()=> (2*random()-1)*r),Array(m).fill(0));}
 const memory=Array.from({length:3},()=>params.map(p=>p.map(()=>0)));
 const activation=(v,name)=>name==='ReLU'?Math.max(0,v):name==='Tanh'?Math.tanh(v):name==='Sigmoid'?1/(1+Math.exp(-Math.max(-35,Math.min(35,v)))):v;
 const derivative=(a,name)=>name==='ReLU'?Number(a>0):name==='Tanh'?1-a*a:name==='Sigmoid'?a*(1-a):1;
 const forward=row=>{const values=[row];for(let l=1;l<C.layers.length;l++){const prev=values.at(-1),out=C.layers[l].units;values.push(Array.from({length:out},(_,j)=>activation(params[2*l-1][j]+sum(prev.map((v,i)=>v*params[2*l-2][i*out+j])),C.layers[l].activation)));}return values;};
 for(let epoch=0;epoch<C.epochs;epoch++)for(let start=0;start<32;start+=C.batchSize){
  const batch=A.slice(start,Math.min(start+C.batchSize,32)),gradients=params.map(p=>p.map(()=>0));
  batch.forEach((row,index)=>{
   const values=forward(row);let delta=[(values.at(-1)[0]-y[start+index])*(C.task==='regression'?2:1)/batch.length];
   for(let l=C.layers.length-2;l>=0;l--){
    const out=C.layers[l+1].units,prev=values[l];
    for(let i=0;i<prev.length;i++)for(let j=0;j<out;j++)gradients[2*l][i*out+j]+=prev[i]*delta[j];
    for(let j=0;j<out;j++)gradients[2*l+1][j]+=delta[j];
    if(l)delta=prev.map((v,i)=>sum(delta.map((d,j)=>params[2*l][i*out+j]*d))*derivative(v,C.layers[l].activation));
   }
  });
  updates++;
  params.forEach((p,k)=>p.forEach((value,j)=>{
   const g=gradients[k][j]+(k%2===0?C.lambda*value:0);let update=g;
   if(C.optimizer==='momentum'){memory[0][k][j]=.9*memory[0][k][j]+g;update=memory[0][k][j];}
   if(C.optimizer==='adam'){memory[1][k][j]=.9*memory[1][k][j]+.1*g;memory[2][k][j]=.999*memory[2][k][j]+.001*g*g;update=(memory[1][k][j]/(1-.9**updates))/(Math.sqrt(memory[2][k][j]/(1-.999**updates))+1e-8);}
   p[j]-=C.learningRate*update;if(!Number.isFinite(p[j]))throw new Error('Example diverged; lower the learning rate');
  }));
 }
 prediction=B.map(row=>forward(row).at(-1)[0]);
}
const value=C.task==='regression'?sum(prediction.map((p,i)=>(p-y[32+i])**2))/8:sum(prediction.map((p,i)=>Number((C.family==='baseline'?p:Number(p>=C.threshold))===y[32+i])))/8;
if(!Number.isFinite(value))throw new Error('Non-finite example evidence');
console.log(JSON.stringify({mode:'synthetic_example_only',metric:C.task==='regression'?'validation_mse':'validation_accuracy',value,updates,prediction,features:C.features}));
`;}

export function javascriptFramework(c){
 if(c.family==='baseline'||['ols','ridge'].includes(c.method))return javascriptScratch(c);
 return `// NeuroForge TF.js analog on deterministic example data / template v1
// npm install @tensorflow/tfjs@4.22.0 ; node neuroforge-example.mjs
// Initializers/precision differ from PyTorch and NumPy. This does not replay a browser model.
import * as tf from '@tensorflow/tfjs';
const C=${JSON.stringify(c,null,2)};
await tf.setBackend('cpu');await tf.ready();
let state=C.seed>>>0;const random=()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296;};
const X=Array.from({length:40},()=>Array.from({length:C.features},()=>2*random()-1));
const y=X.map(row=>[C.task==='regression'?.3+row.reduce((s,v,j)=>s+v*(j+1)/C.features,0):C.family==='mlp'?Number((row[0]>0)!==(row[1]>0)):Number(row.reduce((s,v)=>s+v,0)>0)]);
const trainX=tf.tensor2d(X.slice(0,32)),trainY=tf.tensor2d(y.slice(0,32)),validationX=tf.tensor2d(X.slice(32));
const model=tf.sequential();
C.layers.slice(1).forEach((layer,index)=>model.add(tf.layers.dense({units:layer.units,activation:layer.activation.toLowerCase(),...(index===0?{inputShape:[C.features]}:{}),kernelInitializer:tf.initializers.glorotNormal({seed:C.seed+index}),biasInitializer:'zeros',kernelRegularizer:C.lambda?tf.regularizers.l2({l2:C.lambda/2}):undefined})));
const optimizer=C.optimizer==='adam'?tf.train.adam(C.learningRate):C.optimizer==='momentum'?tf.train.momentum(C.learningRate,.9):tf.train.sgd(C.learningRate);
model.compile({optimizer,loss:C.task==='regression'?'meanSquaredError':'binaryCrossentropy'});
let output;
try{
 // Training sees the first 32 example rows only; no validation or final-test fitting.
 await model.fit(trainX,trainY,{epochs:C.epochs,batchSize:C.batchSize,shuffle:false,verbose:0});
 output=model.predict(validationX);const prediction=Array.from(await output.data());
 const value=prediction.reduce((sum,p,i)=>sum+(C.task==='regression'?(p-y[32+i][0])**2:Number(Number(p>=C.threshold)===y[32+i][0])),0)/8;
 if(!Number.isFinite(value)||prediction.some(p=>!Number.isFinite(p)))throw new Error('Example diverged; lower the learning rate');
 console.log(JSON.stringify({mode:'synthetic_example_only',metric:C.task==='regression'?'validation_mse':'validation_accuracy',value,updates:C.epochs*Math.ceil(32/C.batchSize),prediction,features:C.features}));
}finally{output?.dispose();trainX.dispose();trainY.dispose();validationX.dispose();model.dispose();optimizer.dispose();}
`;}
