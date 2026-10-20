/**
 * F15 numerically-stable, regularized N-dimensional multinomial logistic model.
 * The only fitted statistics come from the current TRAIN membership.
 */
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
function stableProbabilities(logits) {
  const maximum=Math.max(...logits);
  const exps=logits.map(value=>Math.exp(value-maximum));
  const total=exps.reduce((sum,value)=>sum+value,0);
  if(!finite(total)||total<=0)throw new Error('F15_SOFTMAX_NONFINITE');
  return exps.map(value=>value/total);
}
export function trainSoftmax(rows,features,classes,{lambda=0.01,epochs=160,learningRate=0.2}={}) {
  if(!Array.isArray(rows)||rows.length<4||rows.length>2000 ||
      !Array.isArray(features)||features.length<1||features.length>20 ||
      !Array.isArray(classes)||classes.length<2||classes.length>12 ||
      !finite(lambda)||lambda<0.000001||lambda>10 ||
      !Number.isInteger(epochs)||epochs<20||epochs>400 ||
      !finite(learningRate)||learningRate<0.001||learningRate>0.5)
    throw new Error('F15_SOFTMAX_CONFIGURATION');
  const d=features.length,c=classes.length;
  const mean=Array.from({length:d},(_,j)=>rows.reduce((s,r)=>s+r.values[j],0)/rows.length);
  const scale=Array.from({length:d},(_,j)=>{
    const variance=rows.reduce((s,r)=>s+(r.values[j]-mean[j])**2,0)/rows.length;
    return variance>1e-24?Math.sqrt(variance):1;
  });
  if(!mean.every(finite)||!scale.every(v=>finite(v)&&v>0) ||
     rows.some(row=>row.values.length!==d||row.values.some(v=>!finite(v))||!classes.includes(row.target)))
    throw new Error('F15_SOFTMAX_TRAINING_SCHEMA');
  const transformed=rows.map(row=>({
    x:[1,...row.values.map((v,j)=>(v-mean[j])/scale[j])],
    index:classes.indexOf(row.target),
  }));
  const weights=Array.from({length:c},()=>Array(d+1).fill(0));
  for(let epoch=0;epoch<epochs;epoch++){
    const grad=Array.from({length:c},()=>Array(d+1).fill(0));
    for(const {x,index} of transformed){
      const probs=stableProbabilities(weights.map(w=>dot(w,x)));
      for(let k=0;k<c;k++){
        const error=probs[k]-(k===index?1:0);
        for(let j=0;j<x.length;j++)grad[k][j]+=error*x[j];
      }
    }
    for(let k=0;k<c;k++)for(let j=0;j<=d;j++){
      const regularizer=j===0?0:lambda*weights[k][j];
      weights[k][j]-=learningRate*(grad[k][j]/rows.length+regularizer);
    }
  }
  if(weights.some(row=>row.some(v=>!finite(v))))throw new Error('F15_SOFTMAX_DIVERGED');
  return {standardizer:{mean,scale},weights,lambda,epochs,learningRate};
}
export function softmaxOutput(parameters,vector) {
  const {standardizer,weights}=parameters;
  const x=[1,...vector.map((v,j)=>(v-standardizer.mean[j])/standardizer.scale[j])];
  return stableProbabilities(weights.map(row=>dot(row,x)));
}
