import { useMemo, useState } from 'react';
import { calibrationEvidence, subgroupEvidence, featureShiftEvidence } from '../../ml/reliabilityAnalysis.js';

const format = value => Number.isFinite(value) ? Number(value.toFixed(4)).toLocaleString() : 'Not recorded';

export default function ReliabilityLab({ predictProbability, samples = [], trainPoints = [], threshold = .5 }) {
  const [groupAxis,setGroupAxis] = useState('x');
  const [deltaX,setDeltaX] = useState(0);
  const [deltaY,setDeltaY] = useState(0);
  const trained = useMemo(() => (trainPoints || []).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y)),[trainPoints]);
  const boundary = useMemo(() => {
    const values=trained.map(p=>p[groupAxis]).sort((a,b)=>a-b);
    if(!values.length) return 0;
    const middle=Math.floor(values.length/2);
    return values.length%2 ? values[middle] : (values[middle-1]+values[middle])/2;
  },[trained,groupAxis]);
  const evidence = useMemo(() => {
    try {
      const observed=samples.filter(row=>Number.isFinite(row.x)&&Number.isFinite(row.y)&&[0,1].includes(row.label))
        .map(row=>({...row,probability:predictProbability(row.x,row.y)}));
      return {
        observed,
        calibration:calibrationEvidence(observed),
        groups:subgroupEvidence(observed,groupAxis,boundary,threshold),
        shifted:featureShiftEvidence(observed,predictProbability,{deltaX,deltaY,threshold}),
        error:null,
      };
    } catch(reason) {return {error:reason.message};}
  },[samples,predictProbability,groupAxis,boundary,threshold,deltaX,deltaY]);
  return <section role="region" aria-label="Reliability and shift lab"
    className="space-y-4 rounded-xl border border-cyan-400/20 bg-[#151E30] p-3 sm:p-5">
    <div>
      <h3 className="text-lg font-semibold text-white">Reliability & Shift Laboratory</h3>
      <p className="mt-1 text-xs leading-relaxed text-[#9EACC4]">
        Measured calibration and error rates use the current validation partition only.
        The feature shift is a controlled hypothetical simulation using your fitted classifier,
        not evidence of real production drift or a causal intervention.
      </p>
    </div>
    {evidence.error ? <p role="alert" className="text-sm text-red-300">{evidence.error}</p> : <>
      {evidence.calibration.count === 0 ? <p role="status" className="text-sm text-amber-200">
        No complete binary-labeled validation observations are available for reliability analysis.
      </p> : <>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ['Validation rows',evidence.calibration.count],
            ['Brier score',format(evidence.calibration.brier)],
            ['Calibration gap (ECE)',format(evidence.calibration.expectedCalibrationError)],
            ['Decision threshold',format(threshold)],
          ].map(([label,value]) => <div key={label} className="rounded-lg border border-white/10 bg-[#0D1422] p-3">
            <div className="text-[11px] text-[#9EACC4]">{label}</div>
            <div className="mt-1 text-lg font-semibold text-white tabular-nums">{value}</div>
          </div>)}
        </div>
        <p className="text-xs text-[#9EACC4]">
          Lower Brier scores indicate smaller squared probability errors.
          ECE is an approximate five-bin calibration diagnostic and depends on binning and sample size.
          Empty bins remain unavailable, never zero.
        </p>
        <div role="region" aria-label="Validation calibration table" tabIndex={0}
          className="max-h-72 overflow-auto rounded-lg border border-white/10">
          <table className="w-full min-w-[520px] text-left text-xs">
            <caption className="p-3 text-left text-[#9EACC4]">Real validation outcomes grouped by predicted probability</caption>
            <thead className="bg-[#202B43]">
              <tr>{['Probability range','Observations','Mean prediction','Observed positive share','Absolute gap'].map(label=>
                <th scope="col" key={label} className="p-2">{label}</th>)}</tr>
            </thead>
            <tbody>{evidence.calibration.bins.map(bin=><tr key={bin.bin} className="border-t border-white/10">
              <th scope="row" className="p-2">{bin.from.toFixed(1)}–{bin.to.toFixed(1)}</th>
              <td className="p-2 tabular-nums">{bin.count}</td>
              <td className="p-2 tabular-nums">{format(bin.meanProbability)}</td>
              <td className="p-2 tabular-nums">{format(bin.observedRate)}</td>
              <td className="p-2 tabular-nums">{format(bin.gap)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </>}
      <div className="space-y-2">
        <h4 className="font-semibold text-white">Feature-defined subgroup error</h4>
        <p className="text-xs text-[#9EACC4]">Groups are split at a median computed from training inputs, without inspecting validation labels for the boundary. These groups are mathematical feature bins, not demographic attributes or fairness certification.</p>
        <label className="block max-w-sm text-xs text-[#9EACC4]">Grouping feature
          <select aria-label="Reliability grouping feature" value={groupAxis} onChange={event=>setGroupAxis(event.target.value)}
            className="mt-1 block min-h-11 w-full rounded-lg border border-white/20 bg-[#0D1422] px-3 text-white">
            <option value="x">Feature X</option><option value="y">Feature Y</option>
          </select>
        </label>
        <div role="region" aria-label="Subgroup error table" tabIndex={0} className="overflow-auto rounded-lg border border-white/10">
          <table className="w-full min-w-[450px] text-left text-xs">
            <caption className="p-3 text-left text-[#9EACC4]">Measured subgroup validation errors · training-derived split boundary {format(boundary)}</caption>
            <thead className="bg-[#202B43]"><tr>{['Feature bin','Observations','Positive labels','Accuracy','Error rate'].map(label=>
              <th key={label} scope="col" className="p-2">{label}</th>)}</tr></thead>
            <tbody>{evidence.groups.map(group=><tr key={group.label} className="border-t border-white/10">
              <th scope="row" className="p-2">{group.label}</th><td className="p-2">{group.count}</td>
              <td className="p-2">{group.positives}</td><td className="p-2">{format(group.accuracy)}</td>
              <td className="p-2">{format(group.errorRate)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </div>
      <div className="space-y-3 rounded-xl border border-white/10 bg-[#0D1422] p-3">
        <h4 className="font-semibold text-white">Synthetic input distribution shift</h4>
        <p className="text-xs leading-relaxed text-[#9EACC4]">
          Add fixed offsets to both input features and rerun actual model predictions on the same validation cases.
          Labels are held fixed *by assumption* for illustration; model accuracy under this hypothetical change is not real measured deployment performance.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ['X',deltaX,setDeltaX],['Y',deltaY,setDeltaY],
          ].map(([axis,value,setter])=><label key={axis} className="block text-xs font-medium text-[#9EACC4]">
            Shift feature {axis} (−4 to +4)
            <input aria-label={`Shift feature ${axis}`} type="number" min="-4" max="4" step=".25"
              value={value} onChange={event=>setter(Number(event.target.value))}
              className="mt-1 block min-h-11 w-full rounded-lg border border-white/20 bg-[#151E30] px-3 text-sm text-white"/>
          </label>)}
        </div>
        <div role="region" aria-label="Synthetic shift results" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ['Observed prediction flips',evidence.shifted.flipRate===null?'Not recorded':`${(100*evidence.shifted.flipRate).toFixed(1)}%`],
            ['Mean probability change',format(evidence.shifted.meanProbabilityDelta)],
            ['Original accuracy',format(evidence.shifted.originalAccuracy)],
            ['Hypothetical shifted accuracy',format(evidence.shifted.shiftedAccuracy)],
          ].map(([label,value])=><div key={label} className="rounded-lg border border-white/10 bg-[#151E30] p-2">
            <div className="text-[11px] text-[#9EACC4]">{label}</div><div className="mt-1 text-base font-semibold tabular-nums text-white">{value}</div>
          </div>)}
        </div>
        <p role="status" className="text-xs text-[#9EACC4]">
          Compared {evidence.shifted.count} model-backed predictions. No saved dataset or model weights were changed.
        </p>
      </div>
    </>}
  </section>;
}
