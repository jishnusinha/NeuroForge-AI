import { validateExplanationContext } from './explainabilityContracts.js';
import { predictWorkbenchModel } from './models.js';

const sigmoid = value => 1/(1+Math.exp(-Math.max(-35,Math.min(35,value))));
const close = (a,b) => Math.abs(a-b) <= 1e-8*Math.max(1,Math.abs(b));

/**
 * Return only model-derived explanations for an observed VALIDATION row.
 * Logistic weights add in log-odds, ridge weights in prediction units.
 * kNN neighbor IDs and training feature vectors are never returned.
 */
export function explainLocalPrediction(matrix, model, rowId) {
  const validation=validateExplanationContext(matrix,model);
  const row=validation.find(candidate=>candidate.id===rowId);
  if (!row) throw new Error('F13_VALIDATION_ROW_REQUIRED');
  const prediction=predictWorkbenchModel(model,[row.values])[0];
  const base={status:'ok',scope:'validation',algorithm:model.algorithm,
    rowId,modelOutput:prediction,features:[...matrix.features]};
  if (model.algorithm==='baseline') return {
    ...base,method:'training-only-baseline',contributions:[],
    baseline:model.task==='regression'?model.parameters.mean:null,
    classPrior:model.task==='regression'?null:[...model.parameters.probabilities],
    explanation:'This model predicts the training-only mean or class prior, independently of each input feature.',
  };
  if (model.algorithm==='ridge'||model.algorithm==='logistic') {
    const {weights,standardizer}=model.parameters;
    const intercept=weights[0];
    const contributions=matrix.features.map((name,index)=>({
      feature:name,contribution:weights[index+1]*
        ((row.values[index]-standardizer.mean[index])/standardizer.scale[index]),
      preparedValue:row.values[index],
    }));
    const total=intercept+contributions.reduce((sum,item)=>sum+item.contribution,0);
    const reconstructed=model.algorithm==='ridge'?total:sigmoid(total);
    const expected=model.algorithm==='ridge'?prediction.predicted:prediction.probabilities[1];
    if (!Number.isFinite(total)||!close(reconstructed,expected))throw new Error('F13_LOCAL_RECONSTRUCTION_MISMATCH');
    return {...base,method:model.algorithm==='ridge'?'exact-linear-prediction':'exact-log-odds',
      scale:model.algorithm==='ridge'?'predicted-target':'log-odds-of-class-'+String(model.classes[1]),
      intercept,contributions,total,reconstructed,
      explanation:model.algorithm==='ridge'
        ?'Intercept plus contributions exactly reconstruct the regression prediction.'
        :'Intercept plus contributions exactly reconstruct log-odds; sigmoid maps them to class probability. Contributions are not additive probabilities.',
    };
  }
  if (model.algorithm==='knn') {
    const {standardizer,training,k}=model.parameters;
    const vector=row.values.map((value,i)=>(value-standardizer.mean[i])/standardizer.scale[i]);
    const ranked=training.map((sample,index)=>({
      index, label:sample.target,
      distance:Math.sqrt(sample.values.reduce((sum,value,i)=>sum+(value-vector[i])**2,0)),
    })).sort((a,b)=>a.distance-b.distance||a.index-b.index).slice(0,k);
    const votes=model.classes.map(name=>({
      name,count:ranked.filter(item=>item.label===name).length,
    }));
    return {...base,method:'nearest-training-neighbor-vote',neighbors:ranked.map(item=>({
      classLabel:item.label,distance:item.distance,
    })),votes,
      explanation:'Distances and class votes from the training set. Neighbor identities and raw training values are withheld; proximity is not a causal explanation.',
    };
  }
  throw new Error('F13_UNSUPPORTED_LOCAL_METHOD');
}
