import { useMemo, useState } from 'react';
import { createStratifiedSplit } from '../../ml/evaluationProtocol.js';
import { trainDecisionTree, evaluateDecisionTree, flattenTreeRules } from '../../ml/decisionTree.js';
import { pcaTwoFeatures } from '../../ml/pcaTwoFeatures.js';

const fmt = n => Number.isFinite(n) ? Number(n.toFixed(4)).toLocaleString() : 'N/A';

function Pick({ title, value, choices, setValue }) {
  return <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-[#9EACC4]">{title}
    <select aria-label={title} value={value} onChange={event=>setValue(event.target.value)}
      className="min-h-11 rounded-lg border border-white/20 bg-[#151E30] px-2 text-sm text-white">
      {choices.map(item=><option key={item} value={item}>{item}</option>)}
    </select>
  </label>;
}

function DecisionTreePanel({dataset, numeric}) {
  const [x,setX]=useState(numeric[0]??'');
  const [y,setY]=useState(numeric[1]??'');
  const suggested=dataset.headers.find(header=>/^(target|label|class|outcome)$/i.test(header));
  const [target,setTarget]=useState(suggested??dataset.headers.at(-1)??'');
  const [maxDepth,setMaxDepth]=useState(3);
  const result=useMemo(()=>{
    try {
      if(x===y || [x,y].includes(target)) throw new Error('Select different X, Y and target columns.');
      const complete=dataset.rows.filter(row => Number.isFinite(row[x]) && Number.isFinite(row[y])
        && [0,1].includes(row[target]));
      if(complete.length<6) throw new Error('At least six complete binary-labeled rows are required.');
      const raw=complete.map(row=>({id:row.id,x:row[x],y:row[y],label:row[target]}));
      const split=createStratifiedSplit(raw,'label',{seed:42});
      const model=trainDecisionTree(split.train,{maxDepth,minLeaf:2});
      const validation=evaluateDecisionTree(model,split.validation);
      return {model,validation,counts:split.protocol.counts,excluded:dataset.rows.length-complete.length,rules:flattenTreeRules(model.root),issue:null};
    }catch(error){return {issue:error.message};}
  },[dataset,x,y,target,maxDepth]);
  if(numeric.length<2) return <p role="status" className="rounded-lg bg-[#151E30] p-4 text-sm">Decision trees require two numeric features.</p>;
  return <section aria-label="Decision tree learning lab" className="space-y-4">
    <p className="text-sm text-[#9EACC4]">Real binary CART/Gini tree. Training rows alone determine thresholds. Accuracy is measured on the validation split; held-out test rows remain unevaluated.</p>
    <div className="grid gap-3 sm:grid-cols-3">
      <Pick title="Tree X feature" value={x} choices={numeric} setValue={setX}/>
      <Pick title="Tree Y feature" value={y} choices={numeric} setValue={setY}/>
      <Pick title="Tree target" value={target} choices={dataset.headers} setValue={setTarget}/>
    </div>
    <label className="block max-w-lg text-xs font-semibold text-[#9EACC4]">
      Maximum depth: <span className="text-white">{maxDepth}</span>
      <input aria-label="Tree maximum depth" type="range" min="1" max="5" step="1" value={maxDepth}
        onChange={event=>setMaxDepth(Number(event.target.value))}
        className="mt-3 w-full accent-cyan-300"/>
    </label>
    {result.issue ? <p role="status" className="rounded-lg border border-amber-400/20 p-3 text-sm text-amber-200">{result.issue}</p> :
      <div role="region" aria-label="Decision tree results" className="space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ['Training rows',result.counts.train],['Validation rows',result.counts.validation],
            ['Held-out test',result.counts.test],['Validation accuracy',`${(result.validation.accuracy*100).toFixed(1)}%`],
          ].map(([name,value])=><div key={name} className="rounded-lg bg-[#151E30] p-3"><p className="text-xs text-[#9EACC4]">{name}</p>
            <p className="mt-1 text-lg font-semibold text-white tabular-nums">{value}</p></div>)}
        </div>
        <p className="text-xs text-[#9EACC4]">{result.excluded} rows excluded for missing/nonfinite inputs or unsupported labels before splitting. Seed 42. {result.model.nodeCount} actual decision nodes and leaves.</p>
        <div role="region" aria-label="Decision tree rules" tabIndex={0} className="max-h-72 overflow-auto rounded-xl border border-white/10 bg-[#151E30]">
          <table className="w-full min-w-[550px] text-left text-xs">
            <caption className="p-3 text-left text-[#9EACC4]">Exact learned leaf rules, not estimated explanations</caption>
            <thead className="bg-[#202B43]"><tr><th scope="col" className="p-2">Rule</th><th scope="col" className="p-2">Training rows</th><th scope="col" className="p-2">Class 1 probability</th><th scope="col" className="p-2">Prediction</th></tr></thead>
            <tbody>{result.rules.map((row,index)=><tr key={index} className="border-t border-white/10">
              <th scope="row" className="p-2 font-medium">{row.rule.replaceAll('x',x).replaceAll('y',y)}</th>
              <td className="p-2">{row.samples}</td><td className="p-2">{(row.probability*100).toFixed(1)}%</td><td className="p-2">{row.prediction}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <p className="text-xs text-[#9EACC4]">Normalized Gini impurity reduction: {x} {fmt(result.model.featureImportance.x)}, {y} {fmt(result.model.featureImportance.y)}. Importance is descriptive, not causal.</p>
      </div>}
  </section>;
}

function PCAProjection({dataset, numeric}) {
  const [x,setX]=useState(numeric[0]??'');
  const [y,setY]=useState(numeric[1]??'');
  if(numeric.length<2) return <p role="status" className="rounded-lg bg-[#151E30] p-4 text-sm">PCA requires two numeric features.</p>;
  const result=pcaTwoFeatures(dataset.rows,x,y);
  const valid=result.available;
  const points=valid ? result.projected.slice(0,300) : [];
  const span=axis => {
    const values=points.map(row=>row[axis]);const min=Math.min(...values),max=Math.max(...values);
    return {min,max,width:max-min || 1};
  };
  const pc1=valid?span('pc1'):null,pc2=valid?span('pc2'):null;
  return <section aria-label="PCA projection lab" className="space-y-4">
    <p className="text-sm text-[#9EACC4]">Two-variable, mean-centered PCA fitted to complete imported observations for exploratory visualization. This is not a train-only preprocessing transform and is not fed to the model labs.</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <Pick title="PCA feature X" value={x} choices={numeric} setValue={setX}/>
      <Pick title="PCA feature Y" value={y} choices={numeric} setValue={setY}/>
    </div>
    {!valid ? <p role="status" className="rounded-lg border border-amber-400/20 p-3 text-sm text-amber-200">{result.reason}</p> :
      <div role="region" aria-label="PCA results" className="space-y-3">
        <p className="text-sm text-[#9EACC4]">{result.count} complete rows · {result.excluded} excluded · {points.length} displayed.</p>
        <div className="grid grid-cols-2 gap-3">
          {result.explained.map((ratio,index)=><div key={index} className="rounded-xl border border-white/10 bg-[#151E30] p-3">
            <div className="text-xs text-[#9EACC4]">PC{index+1} explained variance</div>
            <div className="mt-1 text-xl font-semibold text-white tabular-nums">{(ratio*100).toFixed(2)}%</div>
          </div>)}
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,1fr)]">
          <svg role="img" aria-label={`PCA projection of ${x} and ${y}: PC1 explains ${(result.explained[0]*100).toFixed(1)} percent`}
            viewBox="0 0 520 290" className="w-full rounded-xl border border-white/10 bg-[#0D1422]">
            <line x1="45" x2="497" y1="253" y2="253" stroke="#9EACC4"/>
            <line x1="45" x2="45" y1="15" y2="253" stroke="#9EACC4"/>
            {points.map(row=><circle key={row.id} cx={45+(row.pc1-pc1.min)/pc1.width*445} cy={253-(row.pc2-pc2.min)/pc2.width*223}
              r="3" fill="#46D7F2" fillOpacity=".8"><title>{`Row ${row.rowNumber}; PC1 ${fmt(row.pc1)}; PC2 ${fmt(row.pc2)}`}</title></circle>)}
            <text x="268" y="283" textAnchor="middle" fill="#F2F5FC" fontSize="12">Principal component 1</text>
            <text x="14" y="131" textAnchor="middle" fill="#F2F5FC" fontSize="12" transform="rotate(-90 14 131)">PC2</text>
          </svg>
          <div role="region" aria-label="PCA projection table" tabIndex={0} className="max-h-[315px] overflow-auto rounded-xl border border-white/10">
            <table className="w-full text-left text-xs">
              <caption className="p-3 text-left text-[#9EACC4]">First {Math.min(30,points.length)} displayed actual projections</caption>
              <thead className="sticky top-0 bg-[#202B43]"><tr><th scope="col" className="p-2">Source row</th><th scope="col" className="p-2">PC1</th><th scope="col" className="p-2">PC2</th></tr></thead>
              <tbody>{points.slice(0,30).map(row=><tr key={row.id} className="border-t border-white/10">
                <th scope="row" className="p-2">{row.rowNumber}</th><td className="p-2 tabular-nums">{fmt(row.pc1)}</td><td className="p-2 tabular-nums">{fmt(row.pc2)}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </div>
        <p className="text-xs text-[#9EACC4]">Component 1 weights: {x} = {fmt(result.components[0][0])}, {y} = {fmt(result.components[0][1])}. PCA detects directions of variance, not classes, fairness, or causality.</p>
      </div>}
  </section>;
}

export default function AlgorithmInsights({dataset,report}) {
  const numeric=report.columns.filter(column=>column.type==='numeric').map(column=>column.name);
  const [view,setView]=useState('tree');
  return <section aria-label="Algorithm Insights" className="space-y-4">
    <div role="group" aria-label="Algorithm Insights modes" className="flex flex-wrap gap-2">
      {[['tree','Decision tree'],['pca','PCA projection']].map(([id,label])=><button type="button" key={id} aria-pressed={view===id}
        onClick={()=>setView(id)}
        className={`min-h-11 rounded-lg border px-3 py-2 text-sm ${view===id?'border-cyan-400 bg-cyan-400/10 text-cyan-200':'border-white/10 bg-[#151E30] text-[#F2F5FC]'}`}>{label}</button>)}
    </div>
    {view==='tree'?<DecisionTreePanel dataset={dataset} numeric={numeric}/>:<PCAProjection dataset={dataset} numeric={numeric}/>}
  </section>;
}
