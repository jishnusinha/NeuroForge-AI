import { useMemo, useState } from 'react';
import {Link} from 'react-router-dom';
import { simulateOptimizer } from '../../ml/optimizerLandscape.js';

const format = value => Number.isFinite(value) ? Number(value.toFixed(5)).toLocaleString() : 'Unavailable';
const px = x => 210 + x/4*180;
const py = y => 210 - y/4*180;

export default function OptimizerLandscapeLab() {
  const [method,setMethod] = useState('sgd');
  const [learningRate,setLearningRate] = useState(.08);
  const [steps,setSteps] = useState(45);
  const model = useMemo(()=>simulateOptimizer({method,learningRate,steps}),[method,learningRate,steps]);
  const visible = model.history.filter(row=>Math.abs(row.x)<=4&&Math.abs(row.y)<=4);
  const clipped=model.history.length-visible.length;
  return <section role="region" aria-label="Optimizer landscape simulator" className="space-y-4 rounded-xl border border-violet-400/20 bg-obsidian p-3 sm:p-5">
    <div>
      <h3 className="text-lg font-semibold text-white">Optimizer Landscape Simulator</h3>
      <Link className="underline" to="/app/optimization">Open 3D Optimization Lab</Link>
      <p className="mt-1 text-xs text-text-muted">Exact simulated gradient updates on a convex quadratic surface, L(x,y) = ½(x² + 6y²). Compare optimizer dynamics without modifying your actual TensorFlow.js network or confusing this with real model training loss.</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="text-xs font-semibold text-text-muted">Optimizer
        <select aria-label="Simulated optimizer" value={method} onChange={event=>setMethod(event.target.value)}
          className="mt-1 block min-h-11 w-full rounded-lg border border-white/20 bg-surface-dark px-3 text-sm text-white">
          <option value="sgd">Gradient descent</option><option value="momentum">Momentum (β=0.9)</option><option value="adam">Adam</option>
        </select>
      </label>
      <label className="text-xs font-semibold text-text-muted">Learning rate: {learningRate.toFixed(2)}
        <input aria-label="Simulator learning rate" type="range" min=".01" max="1" step=".01"
          value={learningRate} onChange={event=>setLearningRate(Number(event.target.value))}
          className="mt-4 block w-full accent-violet-300"/>
      </label>
      <label className="text-xs font-semibold text-text-muted">Update steps: {steps}
        <input aria-label="Simulation steps" type="range" min="10" max="100" step="5"
          value={steps} onChange={event=>setSteps(Number(event.target.value))}
          className="mt-4 block w-full accent-violet-300"/>
      </label>
    </div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {[
        ['Status',model.status==='diverged'?'Diverged':'Completed'],
        ['Initial loss',format(model.initialLoss)],['Final recorded loss',format(model.finalLoss)],
        ['Completed updates',model.completedSteps],
      ].map(([label,value])=><div key={label} className="rounded-lg border border-white/10 bg-surface-dark p-3">
        <div className="text-[11px] text-text-muted">{label}</div><div className="mt-1 text-base font-semibold text-white tabular-nums">{value}</div>
      </div>)}
    </div>
    {model.status==='diverged' && <p role="status" className="rounded-lg border border-amber-400/30 p-3 text-sm text-amber-200">
      The optimizer left the numerical safety range. The path stops at the last finite recorded update; convergence is not claimed.
    </p>}
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(260px,1fr)]">
      <div className="rounded-xl border border-white/10 bg-surface-dark p-3">
        <svg role="img" aria-label={`${method} trajectory on simulated quadratic loss; ${model.completedSteps} updates`}
          viewBox="0 0 420 420" className="mx-auto w-full max-w-md rounded-xl">
          <defs><clipPath id="optimizer-path-clip"><rect x="30" y="30" width="360" height="360"/></clipPath></defs>
          <rect x="30" y="30" width="360" height="360" fill="#0A0F1D"/>
          {[.1,.3,.6,1.2,2.4,4.8,9.6,19.2].map(level=>{
            const rx=Math.sqrt(2*level)/4*180,ry=Math.sqrt(2*level/6)/4*180;
            return <ellipse key={level} cx="210" cy="210" rx={rx} ry={ry} stroke="#576780" fill="none" strokeWidth=".8" clipPath="url(#optimizer-path-clip)"/>;
          })}
          <line x1="30" x2="390" y1="210" y2="210" stroke="#74859A"/>
          <line x1="210" x2="210" y1="30" y2="390" stroke="#74859A"/>
          <g clipPath="url(#optimizer-path-clip)">
            <polyline fill="none" stroke="#46D7F2" strokeWidth="2"
              points={model.history.map(row=>`${px(row.x)},${py(row.y)}`).join(' ')}/>
            {visible.map(row=><circle key={row.step} cx={px(row.x)} cy={py(row.y)} r={row.step===0?'5':'2'}
              fill={row.step===0?'#F8BD78':'#46D7F2'}><title>{`Step ${row.step}, loss ${format(row.loss)}`}</title></circle>)}
          </g>
          <circle cx="210" cy="210" r="5" fill="#3CD5AA"/>
          <text x="210" y="407" textAnchor="middle" fill="#F2F5FC" fontSize="12">Parameter x</text>
          <text x="12" y="210" textAnchor="middle" fill="#F2F5FC" fontSize="12" transform="rotate(-90 12 210)">Parameter y</text>
        </svg>
        <p className="mt-2 text-xs text-text-muted">Amber: initial point · Cyan: numerical updates · Green: known optimum (0,0). Ellipses: equal-loss contours. {clipped>0?`${clipped} update(s) extend beyond the display axes.`:''}</p>
      </div>
      <div role="region" aria-label="Optimizer numeric history" tabIndex={0} className="max-h-[420px] overflow-auto rounded-xl border border-white/10">
        <table className="w-full text-left text-xs">
          <caption className="p-3 text-left text-text-muted">Actual simulated loss and parameter coordinates by update</caption>
          <thead className="sticky top-0 bg-surface-elevated"><tr><th scope="col" className="p-2">Step</th><th scope="col" className="p-2">x</th><th scope="col" className="p-2">y</th><th scope="col" className="p-2">Loss</th></tr></thead>
          <tbody>{model.history.map(row=><tr key={row.step} className="border-t border-white/10">
            <th scope="row" className="p-2">{row.step}</th><td className="p-2 tabular-nums">{format(row.x)}</td>
            <td className="p-2 tabular-nums">{format(row.y)}</td><td className="p-2 tabular-nums">{format(row.loss)}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>
    <p className="text-xs text-text-muted">Educational model: L = ½(x² + 6y²), gradient (x,6y), initial point (2.8,1.9). The simulator deliberately stops on divergence; changing these settings does not alter fitted neural model weights, saved experiments or held-out test data.</p>
  </section>;
}
