import {learningContext} from './contracts.js';
import {classicKernelSource} from './classicTemplates.js';
import {validateSearchRequest} from '../../ml/modelSelection/searchManifest.js';
export function searchExampleContext(input){const c=learningContext({...input,learningRate:input.learningRate??.25}),request=validateSearchRequest(c.task,c.algorithm,{folds:input.folds,seed:c.seed,metric:input.metric});return {context:c,request};}
export function searchJavascript(input){const {context,request}=searchExampleContext(input);return `// F22 synthetic F15 protocol example; Node.js 24, no dependencies.
// Same configured algorithm, folds, configuration list and metric; different generated data and fold membership.
// 120 LCG rows: first 96 for inner CV; last 24 reserved and NEVER accessed. No final-test data.
// Classification uses balanced synthetic labels and deterministic stratified folds; regression uses round-robin folds.
const classicExample = (${classicKernelSource()});
const C=${JSON.stringify(context)},REQUEST=${JSON.stringify(request)};
const score=(result)=>{const y=result.actual,p=result.prediction,n=y.length;if(REQUEST.metric==='accuracy')return result.value;if(REQUEST.metric==='rmse')return Math.sqrt(result.value);if(REQUEST.metric==='mae')return y.reduce((s,v,i)=>s+Math.abs(v-p[i]),0)/n;if(REQUEST.metric==='r2'){const mean=y.reduce((a,b)=>a+b,0)/n,total=y.reduce((s,v)=>s+(v-mean)**2,0);return total?1-result.value*n/total:0;}return Array.from({length:C.task==='multiclass_classification'?C.classCount:2},(_,k)=>{const tp=y.filter((v,i)=>v===k&&p[i]===k).length,fp=y.filter((v,i)=>v!==k&&p[i]===k).length,fn=y.filter((v,i)=>v===k&&p[i]!==k).length;return 2*tp/(2*tp+fp+fn||1);}).reduce((a,b)=>a+b,0)/(C.task==='multiclass_classification'?C.classCount:2);};
const results=REQUEST.configs.map(options=>{const scores=Array.from({length:REQUEST.folds},(_,fold)=>score(classicExample({...C,...options,seed:C.seed,modelSeed:options.seed??C.seed,search:true,folds:REQUEST.folds,fold})));return {options,scores,mean:scores.reduce((a,b)=>a+b,0)/scores.length};});
console.log(JSON.stringify({mode:'synthetic_example_only',protocol:REQUEST,results,holdoutAccess:false}));
`;}
export function searchPython(input){const {context,request}=searchExampleContext(input);return `# F22 synthetic F15 protocol analog; Python 3.12, numpy==2.2.6, scikit-learn==1.7.2
# Exact configured candidate list and metric; generated data and framework conventions differ from browser engines.
# Train-only standardization occurs INSIDE each fold. Reserved rows are never evaluated or used for selection.
import json, numpy as np
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.dummy import DummyClassifier,DummyRegressor
from sklearn.linear_model import Ridge,LogisticRegression
from sklearn.neighbors import KNeighborsClassifier
from sklearn.tree import DecisionTreeClassifier,DecisionTreeRegressor
from sklearn.ensemble import RandomForestClassifier,RandomForestRegressor
from sklearn.metrics import accuracy_score,f1_score,mean_squared_error,mean_absolute_error,r2_score
C=json.loads(${JSON.stringify(JSON.stringify(context))});REQUEST=json.loads(${JSON.stringify(JSON.stringify(request))})
state=C['seed']
def random():
    global state
    state=(1664525*state+1013904223)&0xffffffff
    return state/4294967296
X=np.array([[2*random()-1 for _ in range(C['features'])] for _ in range(120)])
classes=C['classCount'] if C['task']=='multiclass_classification' else 2
regression=C['task']=='regression'
y=.3+X@(np.arange(1,C['features']+1)/C['features']) if regression else np.arange(120)%classes
results=[]
for options in REQUEST['configs']:
    scores=[]
    for fold in range(REQUEST['folds']):
        ids=np.arange(96); membership=(ids if regression else ids//classes)%REQUEST['folds']
        train,valid=ids[membership!=fold],ids[membership==fold]
        algorithm=C['algorithm']
        if algorithm=='baseline': model=DummyRegressor(strategy='mean') if regression else DummyClassifier(strategy='most_frequent')
        elif algorithm=='ridge': model=Ridge(alpha=options['lambda']*len(train))
        elif algorithm in ('logistic','softmax'): model=LogisticRegression(C=1/(options['lambda']*len(train)),max_iter=options['epochs'],solver='lbfgs',random_state=C['seed'])
        elif algorithm=='knn': model=KNeighborsClassifier(n_neighbors=options['k'])
        elif algorithm=='cart': model=(DecisionTreeRegressor if regression else DecisionTreeClassifier)(max_depth=options['maxDepth'],min_samples_leaf=options['minLeaf'],random_state=C['seed'])
        else: model=(RandomForestRegressor if regression else RandomForestClassifier)(n_estimators=options['trees'],max_depth=options['maxDepth'],min_samples_leaf=options['minLeaf'],max_features='sqrt',random_state=C['seed'],n_jobs=1)
        # New preprocessing and model for EVERY fold; no validation/test fit.
        pipeline=make_pipeline(StandardScaler(),model);pipeline.fit(X[train],y[train]);p=pipeline.predict(X[valid])
        metric=REQUEST['metric']
        if metric=='accuracy': value=accuracy_score(y[valid],p)
        elif metric=='macroF1': value=f1_score(y[valid],p,labels=list(range(classes)),average='macro',zero_division=0)
        elif metric=='rmse': value=np.sqrt(mean_squared_error(y[valid],p))
        elif metric=='mae': value=mean_absolute_error(y[valid],p)
        else: value=r2_score(y[valid],p)
        scores.append(float(value))
    results.append({'options':options,'scores':scores,'mean':float(np.mean(scores))})
print(json.dumps({'mode':'synthetic_example_only','protocol':REQUEST,'results':results,'holdoutAccess':False},allow_nan=False))
`;}
