import {classicKernelSourceValue} from './classicKernelSource.js';
/** Reviewed synthetic example kernel; exported as source, never executed by the application. */
export function classicExample(C){
 let state=C.seed>>>0;const random=()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296;};
 const X=Array.from({length:C.search?120:40},()=>Array.from({length:C.features},()=>2*random()-1)),classes=C.task==='multiclass_classification'?C.classCount:2;
 const y=X.map((row,i)=>C.task==='regression'?.3+row.reduce((s,v,j)=>s+v*(j+1)/C.features,0):C.search?i%classes:Math.min(classes-1,Math.floor((row[0]+1)*classes/2)));
 if(C.modelSeed!==undefined)state=C.modelSeed>>>0; // Data seed stays fixed across candidate configurations.
 const foldFor=i=>(C.task==='regression'?i:Math.floor(i/classes))%C.folds;
 const trainIds=Array.from({length:C.search?96:32},(_,i)=>i).filter(i=>C.fold===undefined||foldFor(i)!==C.fold),validationIds=C.fold===undefined?Array.from({length:8},(_,i)=>i+32):Array.from({length:C.search?96:32},(_,i)=>i).filter(i=>foldFor(i)===C.fold);
 const A=trainIds.map(i=>X[i]),B=validationIds.map(i=>X[i]),target=trainIds.map(i=>y[i]),validationTargets=validationIds.map(i=>y[i]),majority=values=>Array.from({length:classes},(_,i)=>values.filter(v=>v===i).length).reduce((best,v,i,counts)=>v>counts[best]?i:best,0),mean=v=>v.reduce((a,b)=>a+b,0)/v.length;
 let prediction,updates=0;
 if(C.family==='kmeans'){
  let centers=A.slice(0,C.clusters).map(row=>[...row]);
  const nearest=row=>centers.map(center=>row.reduce((s,v,j)=>s+(v-center[j])**2,0)).reduce((best,v,i,d)=>v<d[best]?i:best,0);
  for(let t=0;t<C.epochs;t++){const assignment=A.map(nearest),next=centers.map((center,k)=>{const group=A.filter((_,i)=>assignment[i]===k);return group.length?center.map((_,j)=>mean(group.map(row=>row[j]))):center;});updates++;if(JSON.stringify(next)===JSON.stringify(centers)){centers=next;break;}centers=next;}
  prediction=B.map(nearest);const value=mean(B.map((row,i)=>row.reduce((s,v,j)=>s+(v-centers[prediction[i]][j])**2,0)));return {mode:'synthetic_example_only',metric:'validation_inertia_per_row',value,prediction,features:C.features,updates};
 }
 if(['baseline','ridge','logistic'].includes(C.family)){
  if(C.family==='baseline')prediction=B.map(()=>C.task==='regression'?mean(target):majority(target));
  else{
   const mu=A[0].map((_,j)=>mean(A.map(row=>row[j]))),sd=mu.map((m,j)=>Math.sqrt(mean(A.map(row=>(row[j]-m)**2)))||1),standard=row=>[1,...row.map((v,j)=>(v-mu[j])/sd[j])],train=A.map(standard),validation=B.map(standard),weights=Array(C.features+1).fill(0);
   if(C.family==='ridge'){
    const matrix=weights.map((_,j)=>[...weights.map((_,k)=>train.reduce((s,row)=>s+row[j]*row[k],0)+(j===k&&j>0?C.lambda*A.length:0)),train.reduce((s,row,i)=>s+row[j]*target[i],0)]);
    for(let col=0;col<weights.length;col++){let pivot=col;for(let r=col+1;r<weights.length;r++)if(Math.abs(matrix[r][col])>Math.abs(matrix[pivot][col]))pivot=r;[matrix[col],matrix[pivot]]=[matrix[pivot],matrix[col]];const value=matrix[col][col];for(let j=col;j<=weights.length;j++)matrix[col][j]/=value;for(let r=0;r<weights.length;r++)if(r!==col){const f=matrix[r][col];for(let j=col;j<=weights.length;j++)matrix[r][j]-=f*matrix[col][j];}}
    weights.forEach((_,i)=>weights[i]=matrix[i].at(-1));prediction=validation.map(row=>row.reduce((s,v,j)=>s+v*weights[j],0));
   }else{for(let epoch=0;epoch<C.epochs;epoch++){const gradient=weights.map(()=>0);train.forEach((row,i)=>{const z=row.reduce((s,v,j)=>s+v*weights[j],0),d=1/(1+Math.exp(-z))-target[i];gradient.forEach((_,j)=>gradient[j]+=d*row[j]/A.length);});weights.forEach((v,j)=>weights[j]-=C.learningRate*(gradient[j]+(j?C.lambda*v:0)));updates++;}prediction=validation.map(row=>Number(1/(1+Math.exp(-row.reduce((s,v,j)=>s+v*weights[j],0)))>=.5));}
  }
 }else if(C.family==='knn'){
  const mu=A[0].map((_,j)=>mean(A.map(row=>row[j]))),sd=mu.map((m,j)=>Math.sqrt(mean(A.map(row=>(row[j]-m)**2)))||1),standard=row=>row.map((v,j)=>(v-mu[j])/sd[j]),train=A.map(standard);
  prediction=B.map(row=>{const values=standard(row),neighbors=train.map((r,i)=>({i,d:C.metric==='manhattan'?r.reduce((s,v,j)=>s+Math.abs(v-values[j]),0):Math.sqrt(r.reduce((s,v,j)=>s+(v-values[j])**2,0))})).sort((a,b)=>a.d-b.d||a.i-b.i).slice(0,C.k),votes=Array(classes).fill(0);neighbors.forEach(({i,d})=>votes[target[i]]+=C.weighted?1/Math.max(d,1e-12):1);return votes.reduce((best,v,i)=>v>votes[best]?i:best,0);});
 }else if(C.family==='softmax'){
  const weights=Array.from({length:C.features+1},()=>Array(classes).fill(0)),predict=row=>{const values=Array.from({length:classes},(_,k)=>weights.reduce((s,w,j)=>s+w[k]*(j===C.features?1:row[j]),0)),max=Math.max(...values),p=values.map(v=>Math.exp(v-max)),sum=p.reduce((a,b)=>a+b,0);return p.map(v=>v/sum);};
  for(let epoch=0;epoch<C.epochs;epoch++){const gradients=weights.map(w=>w.map(()=>0));A.forEach((row,i)=>{const p=predict(row);gradients.forEach((g,j)=>g.forEach((_,k)=>g[k]+=(p[k]-Number(target[i]===k))*(j===C.features?1:row[j])/A.length));});weights.forEach((w,j)=>w.forEach((v,k)=>w[k]-=C.learningRate*(gradients[j][k]+(j===C.features?0:C.lambda*v))));updates++;}
  prediction=B.map(row=>predict(row).reduce((best,v,i,p)=>v>p[best]?i:best,0));
 }else{
  const impurity=ids=>{const values=ids.map(i=>target[i]);return C.task==='regression'?values.reduce((s,v)=>s+(v-mean(values))**2,0)/values.length:1-Array.from({length:classes},(_,k)=>(values.filter(v=>v===k).length/values.length)**2).reduce((a,b)=>a+b,0);};
  const build=(ids,depth)=>{const values=ids.map(i=>target[i]),leaf={value:C.task==='regression'?mean(values):majority(values)};if(depth>=C.maxDepth||ids.length<2*C.minLeaf||impurity(ids)<1e-12)return leaf;
   const features=Array.from({length:C.features},(_,i)=>i);if(C.family==='forest'){for(let i=features.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[features[i],features[j]]=[features[j],features[i]];}features.length=Math.max(1,Math.floor(Math.sqrt(C.features)));}
   let best=null;for(const feature of features){const sorted=[...new Set(ids.map(i=>A[i][feature]))].sort((a,b)=>a-b);for(let k=1;k<sorted.length;k++){const threshold=(sorted[k-1]+sorted[k])/2,left=ids.filter(i=>A[i][feature]<=threshold),right=ids.filter(i=>A[i][feature]>threshold);if(left.length<C.minLeaf||right.length<C.minLeaf)continue;const score=(left.length*impurity(left)+right.length*impurity(right))/ids.length;if(!best||score<best.score)best={feature,threshold,left,right,score};}}
   return best?{feature:best.feature,threshold:best.threshold,left:build(best.left,depth+1),right:build(best.right,depth+1)}:leaf;};
  const count=C.family==='forest'?C.trees:1,trees=Array.from({length:count},()=>build(Array.from({length:A.length},(_,i)=>C.family==='forest'?Math.floor(random()*A.length):i),0)),predict=(tree,row)=>Object.hasOwn(tree,'value')?tree.value:predict(row[tree.feature]<=tree.threshold?tree.left:tree.right,row);
  prediction=B.map(row=>{const values=trees.map(tree=>predict(tree,row));return C.task==='regression'?mean(values):majority(values);});
 }
 const value=mean(prediction.map((p,i)=>C.task==='regression'?(p-validationTargets[i])**2:Number(p===validationTargets[i])));if(!Number.isFinite(value)||!prediction.every(Number.isFinite))throw new Error('Example diverged');
 return {mode:'synthetic_example_only',metric:C.task==='regression'?'validation_mse':'validation_accuracy',value,prediction,actual:validationTargets,features:C.features,updates};
}
export const classicKernelSource=()=>classicKernelSourceValue;
export function classicJavascript(c){return `// NeuroForge  synthetic example, Node.js 24, no dependencies.
// Imported observations, feature names and saved weights are absent. This is not browser-run replay.
const classicExample = (${classicKernelSource()});
console.log(JSON.stringify(classicExample(${JSON.stringify(c,null,2)})));
`;}
export function classicPython(c,framework=false){return `# NeuroForge  synthetic example only, Python 3.12, numpy==2.2.6
# ${framework?'Framework: scikit-learn==1.7.2 (PyTorch 2.5.1 for softmax). Framework conventions may differ from browser engines.':'From-scratch NumPy implementation of the configured algorithm.'}
import json
import numpy as np
C=json.loads(${JSON.stringify(JSON.stringify(c))})
state=C['seed'] & 0xffffffff
def random():
    global state
    state=(1664525*state+1013904223)&0xffffffff
    return state/4294967296
X=np.array([[2*random()-1 for _ in range(C['features'])] for _ in range(40)])
classes=C['classCount'] if C['task']=='multiclass_classification' else 2
y=.3+X@(np.arange(1,C['features']+1)/C['features']) if C['task']=='regression' else np.minimum(classes-1,((X[:,0]+1)*classes/2).astype(int))
A,B,target=X[:32].copy(),X[32:].copy(),y[:32]
updates=0
framework=${framework?'True':'False'}
if C['family']=='knn':
    mean,scale=A.mean(axis=0),A.std(axis=0);scale=np.where(scale>1e-12,scale,1)
    A,B=(A-mean)/scale,(B-mean)/scale
if framework and C['family']!='softmax':
    from sklearn.neighbors import KNeighborsClassifier
    from sklearn.cluster import KMeans
    from sklearn.tree import DecisionTreeClassifier,DecisionTreeRegressor
    from sklearn.ensemble import RandomForestClassifier,RandomForestRegressor
    if C['family']=='knn': model=KNeighborsClassifier(n_neighbors=C['k'],weights='distance' if C['weighted'] else 'uniform',metric=C['metric'])
    elif C['family']=='kmeans': model=KMeans(n_clusters=C['clusters'],init=A[:C['clusters']].copy(),n_init=1,max_iter=C['epochs'],random_state=C['seed'])
    elif C['family']=='cart': model=(DecisionTreeRegressor if C['task']=='regression' else DecisionTreeClassifier)(max_depth=C['maxDepth'],min_samples_leaf=C['minLeaf'],random_state=C['seed'])
    else: model=(RandomForestRegressor if C['task']=='regression' else RandomForestClassifier)(n_estimators=C['trees'],max_depth=C['maxDepth'],min_samples_leaf=C['minLeaf'],max_features='sqrt',random_state=C['seed'],n_jobs=1)
    model.fit(A,target);prediction=model.predict(B)
    if C['family']=='kmeans': centers=model.cluster_centers_;updates=int(model.n_iter_)
elif C['family']=='kmeans':
    centers=A[:C['clusters']].copy()
    for _ in range(C['epochs']):
        assignment=((A[:,None,:]-centers[None,:,:])**2).sum(axis=2).argmin(axis=1)
        next_centers=np.array([A[assignment==k].mean(axis=0) if np.any(assignment==k) else centers[k] for k in range(C['clusters'])])
        updates+=1
        if np.array_equal(centers,next_centers): centers=next_centers;break
        centers=next_centers
    prediction=((B[:,None,:]-centers[None,:,:])**2).sum(axis=2).argmin(axis=1)
elif C['family']=='knn':
    prediction=[]
    for row in B:
        distance=np.abs(A-row).sum(axis=1) if C['metric']=='manhattan' else np.sqrt(((A-row)**2).sum(axis=1))
        ids=np.argsort(distance,kind='stable')[:C['k']]
        votes=np.bincount(target[ids].astype(int),weights=1/np.maximum(distance[ids],1e-12) if C['weighted'] else None,minlength=classes)
        prediction.append(votes.argmax())
    prediction=np.array(prediction)
elif C['family']=='softmax':
    if framework:
        import torch
        torch.set_num_threads(1);torch.set_default_dtype(torch.float64);torch.manual_seed(C['seed'])
        model=torch.nn.Linear(C['features'],classes)
        with torch.no_grad(): model.weight.zero_();model.bias.zero_()
        opt=torch.optim.SGD(model.parameters(),lr=C['learningRate'])
        inputs=torch.tensor(A);labels=torch.tensor(target,dtype=torch.long)
        for _ in range(C['epochs']):
            opt.zero_grad();loss=torch.nn.functional.cross_entropy(model(inputs),labels)+C['lambda']/2*(model.weight**2).sum();loss.backward();opt.step();updates+=1
        with torch.no_grad(): prediction=model(torch.tensor(B)).argmax(dim=1).numpy()
    else:
        train=np.column_stack((A,np.ones(32)));weights=np.zeros((C['features']+1,classes))
        for _ in range(C['epochs']):
            z=train@weights;z-=z.max(axis=1,keepdims=True);p=np.exp(z);p/=p.sum(axis=1,keepdims=True)
            gradient=train.T@(p-np.eye(classes)[target.astype(int)])/32;gradient[:-1]+=C['lambda']*weights[:-1];weights-=C['learningRate']*gradient;updates+=1
        prediction=(np.column_stack((B,np.ones(8)))@weights).argmax(axis=1)
else:
    def majority(values): return int(np.bincount(np.array(values,dtype=int),minlength=classes).argmax())
    def impurity(ids):
        values=target[ids]
        return float(np.var(values)) if C['task']=='regression' else 1-float(((np.bincount(values.astype(int),minlength=classes)/len(values))**2).sum())
    def build(ids,depth):
        values=target[ids];leaf={'value':float(values.mean()) if C['task']=='regression' else majority(values)}
        if depth>=C['maxDepth'] or len(ids)<2*C['minLeaf'] or impurity(ids)<1e-12: return leaf
        features=list(range(C['features']))
        if C['family']=='forest':
            for i in range(len(features)-1,0,-1):
                j=int(random()*(i+1));features[i],features[j]=features[j],features[i]
            features=features[:max(1,int(np.sqrt(C['features'])))]
        best=None
        for feature in features:
            ordered=sorted(set(A[ids,feature]))
            for lo,hi in zip(ordered[:-1],ordered[1:]):
                threshold=(lo+hi)/2;left=[i for i in ids if A[i,feature]<=threshold];right=[i for i in ids if A[i,feature]>threshold]
                if min(len(left),len(right))<C['minLeaf']: continue
                score=(len(left)*impurity(left)+len(right)*impurity(right))/len(ids)
                if best is None or score<best[0]: best=(score,feature,threshold,left,right)
        if best is None: return leaf
        _,feature,threshold,left,right=best
        return {'feature':feature,'threshold':threshold,'left':build(left,depth+1),'right':build(right,depth+1)}
    def predict(tree,row): return tree['value'] if 'value' in tree else predict(tree['left'] if row[tree['feature']]<=tree['threshold'] else tree['right'],row)
    trees=[build([int(random()*32) if C['family']=='forest' else i for i in range(32)],0) for _ in range(C['trees'] if C['family']=='forest' else 1)]
    prediction=np.array([np.mean([predict(tree,row) for tree in trees]) if C['task']=='regression' else majority([predict(tree,row) for tree in trees]) for row in B])
if C['family']=='kmeans': value=float(((B-centers[prediction.astype(int)])**2).sum(axis=1).mean());metric='validation_inertia_per_row'
elif C['task']=='regression': value=float(((prediction-y[32:])**2).mean());metric='validation_mse'
else: value=float((prediction==y[32:]).mean());metric='validation_accuracy'
print(json.dumps({'mode':'synthetic_example_only','metric':metric,'value':value,'prediction':prediction.tolist(),'features':C['features'],'updates':updates},allow_nan=False))
`;}
