import { useMemo, useState } from 'react';
import { localWhatIfSensitivity, nearestClassFlip } from '../../ml/whatIf.js';

const display = value => Number.isFinite(value) ? Number(value.toFixed(4)).toLocaleString() : 'Unavailable';

export default function WhatIfExplorer({ predictProbability, trainPoints, threshold = .5 }) {
  const limits = useMemo(() => {
    const observed = (trainPoints || []).filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
    const span = key => {
      const min = observed.length ? Math.min(...observed.map(point=>point[key])) : -2;
      const max = observed.length ? Math.max(...observed.map(point=>point[key])) : 2;
      const width = Math.max(1, max - min);
      return [min - width*.2, max + width*.2];
    };
    return { x:span('x'), y:span('y') };
  }, [trainPoints]);
  const [x, setX] = useState(() => (limits.x[0]+limits.x[1])/2);
  const [y, setY] = useState(() => (limits.y[0]+limits.y[1])/2);
  const [lockX,setLockX] = useState(false);
  const [lockY,setLockY] = useState(false);
  const [radius,setRadius] = useState(8);
  const [search,setSearch] = useState(null);
  const [error,setError] = useState('');
  const stepX = Math.max(.01,(limits.x[1]-limits.x[0])/24);
  const stepY = Math.max(.01,(limits.y[1]-limits.y[0])/24);
  const original=useMemo(() => {
    try {
      return { evidence:localWhatIfSensitivity(predictProbability,x,y,stepX,stepY,threshold),error:null };
    }catch(reason){return {evidence:null,error:reason.message};}
  },[predictProbability,x,y,stepX,stepY,threshold]);
  const update = (axis,value) => {
    if (axis==='x') setX(Number(value)); else setY(Number(value));
    setSearch(null);setError('');
  };
  const investigate = () => {
    try {
      const result=nearestClassFlip(predictProbability,{x,y},
        { threshold, stepX, stepY, radius, lockX,lockY,xBounds:limits.x,yBounds:limits.y });
      setSearch(result);
      setError('');
    }catch(reason){setSearch(null);setError(reason.message);}
  };
  return <section role="region" aria-label="Model-backed What-If Lab" className="space-y-4 rounded-xl border border-cyan-400/20 bg-[#151E30] p-3 sm:p-5">
    <h3 className="text-lg font-semibold text-white">What-If Lab · real model inference</h3>
    <p className="text-xs leading-relaxed text-[#9EACC4]">
      Probe the currently fitted classifier. Changing coordinates only queries the model; it does not edit datasets,
      retrain, alter saved runs or inspect held-out true labels. Counterfactuals are candidate input changes, not causal guarantees.
    </p>
    <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="What-If feature inputs">
      {[['x',x,limits.x],['y',y,limits.y]].map(([key,value,bounds])=><label key={key} className="text-xs font-medium text-[#9EACC4]">
        Feature {key.toUpperCase()}
        <input type="range" aria-label={`What-If ${key.toUpperCase()} coordinate`} min={bounds[0]} max={bounds[1]} step={(bounds[1]-bounds[0])/100}
          value={value} onChange={event=>update(key,event.target.value)} className="mt-3 block w-full accent-cyan-300"/>
        <input type="number" aria-label={`What-If ${key.toUpperCase()} value`} step="0.05" value={Number(value.toFixed(4))}
          onChange={event=>update(key,event.target.value)} className="mt-2 min-h-10 w-full rounded-lg border border-white/20 bg-[#0D1422] px-3 text-sm text-white"/>
      </label>)}
    </div>
    {original.error ? <p role="alert" className="text-sm text-red-300">{original.error}</p> : <>
      <div role="status" className="rounded-lg border border-white/10 bg-[#0D1422] p-3">
        <div className="text-xs text-[#9EACC4]">Live predicted class / probability (threshold {threshold.toFixed(2)})</div>
        <div className="mt-1 text-lg font-semibold text-white tabular-nums">
          Class {original.evidence.baseline.predictedClass} · {(original.evidence.baseline.predictedProbability*100).toFixed(2)}%
        </div>
        <p className="mt-1 text-xs text-[#9EACC4]">
          Sensitivity from a positive local input step: ΔP(+X) = {display(original.evidence.xPlusDelta)},
          {' '}ΔP(+Y) = {display(original.evidence.yPlusDelta)}. These are finite-difference probes, not learned weights.
        </p>
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={lockX} onChange={event=>{setLockX(event.target.checked);setSearch(null);}}/> Lock X</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={lockY} onChange={event=>{setLockY(event.target.checked);setSearch(null);}}/> Lock Y</label>
        <label className="text-xs text-[#9EACC4]">Search radius: {radius} steps
          <input aria-label="Counterfactual search radius" type="range" min="1" max="12" step="1" value={radius}
            onChange={event=>{setRadius(Number(event.target.value));setSearch(null);}} className="ml-2 align-middle accent-cyan-300"/>
        </label>
      </div>
      <button type="button" onClick={investigate}
        className="min-h-11 rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-600">
        Find nearest class flip
      </button>
      {search && <div role="region" aria-label="Counterfactual search evidence" className="rounded-lg border border-white/10 bg-[#0D1422] p-3 text-sm">
        <p className="text-[#9EACC4]">Evaluated {search.evaluated} real bounded model probes, respecting locked features and input ranges.</p>
        {search.candidate ? <>
          <p className="mt-2 font-semibold text-emerald-200">Observed class flip found in searched grid</p>
          <table className="mt-2 w-full text-left text-xs">
            <caption className="sr-only">Original and candidate model predictions</caption>
            <thead><tr><th scope="col" className="p-2">Probe</th><th scope="col" className="p-2">X</th><th scope="col" className="p-2">Y</th><th scope="col" className="p-2">Class</th><th scope="col" className="p-2">Probability</th></tr></thead>
            <tbody>{[['Original',search.baseline],['Candidate',search.candidate]].map(([label,probe])=><tr key={label} className="border-t border-white/10">
              <th scope="row" className="p-2">{label}</th><td className="p-2 tabular-nums">{display(probe.x)}</td>
              <td className="p-2 tabular-nums">{display(probe.y)}</td><td className="p-2">{probe.predictedClass}</td>
              <td className="p-2 tabular-nums">{(probe.predictedProbability*100).toFixed(2)}%</td>
            </tr>)}</tbody>
          </table>
          <p className="mt-2 text-xs text-[#9EACC4]">
            Input changes: X {display(search.candidate.deltaX)}, Y {display(search.candidate.deltaY)}.
            Nearest refers only to this normalized finite grid, not to a globally optimal or feasible real-world action.
          </p>
        </> : <p className="mt-2 font-medium text-amber-200">No class-changing candidate found in the allowed search grid. Try a wider radius or unlock an axis; this does not prove no counterfactual exists.</p>}
      </div>}
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    </>}
  </section>;
}
