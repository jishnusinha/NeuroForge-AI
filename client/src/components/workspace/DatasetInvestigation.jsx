import { useState } from 'react';
import { eligibleGroupColumns, scatterEvidence, classBalance, tukeyOutliers, qualitySignals } from '../../ml/datasetInsights.js';

const PALETTE = ['#46D7F2','#A78BFA','#3CD5AA','#F8BD78','#F58EA8','#8DB9FF','#C8DB79','#D4A1ED','#70D0BA','#EFAB7C','#A5AEF5','#E1D18D'];
const format = value => Number.isFinite(value) ? Number(value.toFixed(3)).toLocaleString() : 'N/A';

function Selector({ label, value, onChange, options, optional = false }) {
  return <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-[#F2F5FC]">{label}
    <select aria-label={label} value={value} onChange={event=>onChange(event.target.value)}
      className="min-h-11 w-full min-w-0 rounded-lg border border-white/20 bg-[#151E30] px-3 py-2 text-sm text-white">
      {optional && <option value="">No color grouping</option>}
      {options.map(name=><option key={name} value={name}>{name}</option>)}
    </select>
  </label>;
}

function Relationships({ dataset, report }) {
  const numeric = report.columns.filter(column=>column.type==='numeric').map(column=>column.name);
  const groupOptions = eligibleGroupColumns(report);
  const [x,setX] = useState(numeric[0] ?? '');
  const [y,setY] = useState(numeric[1] ?? numeric[0] ?? '');
  const [color,setColor] = useState(groupOptions.includes('label') ? 'label' : '');
  if (numeric.length<2) return <p role="status" className="rounded-xl bg-[#151E30] p-4 text-sm">
    Feature relationships require at least two numeric columns. This CSV can still be explored in the other Workbench views.
  </p>;
  if (x===y) return <div className="space-y-3">
    <div className="grid gap-3 sm:grid-cols-3">
      <Selector label="X feature" value={x} onChange={setX} options={numeric}/>
      <Selector label="Y feature" value={y} onChange={setY} options={numeric}/>
      <Selector label="Color by category" value={color} onChange={setColor} options={groupOptions} optional/>
    </div>
    <p role="status" className="text-sm text-amber-200">Choose two distinct numeric features to investigate their relationship.</p>
  </div>;
  const evidence = scatterEvidence(dataset.rows,x,y,color);
  const xmin=evidence.xDomain.min,xmax=evidence.xDomain.max,ymin=evidence.yDomain.min,ymax=evidence.yDomain.max;
  const width = xmax-xmin, height=ymax-ymin;
  const colors = new Map(evidence.groups.map((group,index)=>[group,PALETTE[index%PALETTE.length]]));
  return <div className="space-y-4">
    <p className="text-sm text-[#9EACC4]">Explore observed numeric pairs. Optional colors identify categories; associations do not establish causality. Missing X/Y pairs are excluded, never imputed.</p>
    <div className="grid gap-3 sm:grid-cols-3">
      <Selector label="X feature" value={x} onChange={setX} options={numeric}/>
      <Selector label="Y feature" value={y} onChange={setY} options={numeric}/>
      <Selector label="Color by category" value={color} onChange={setColor} options={groupOptions} optional/>
    </div>
    <p role="status" className="text-xs text-[#9EACC4]">{evidence.count} complete pairs · {evidence.excluded} excluded · {evidence.sampled} plotted. At most 400 evenly spaced source rows are visualized; the original data is unchanged.</p>
    {evidence.count ? <>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,1fr)]">
        <div className="rounded-xl border border-white/10 bg-[#151E30] p-2 sm:p-3">
          <svg viewBox="0 0 520 290" role="img" aria-label={`Observed scatter plot of ${x} versus ${y}: ${evidence.sampled} plotted of ${evidence.count} complete pairs`}
            className="w-full rounded-lg bg-[#080D18]">
            <line x1="48" y1="250" x2="493" y2="250" stroke="#9EACC4"/>
            <line x1="48" y1="16" x2="48" y2="250" stroke="#9EACC4"/>
            {evidence.points.map(point=><circle key={point.id} cx={48+(point.x-xmin)/width*438} cy={250-(point.y-ymin)/height*218}
              r="3.8" fill={colors.get(point.group)} fillOpacity=".8" stroke="#080D18" strokeWidth=".55">
              <title>{`Row ${point.rowNumber}: ${x}=${point.x}, ${y}=${point.y}; ${color || 'Group'}: ${point.group}`}</title>
            </circle>)}
            <text x="48" y="270" fill="#9EACC4" fontSize="11">{format(xmin)}</text>
            <text x="493" y="270" fill="#9EACC4" textAnchor="end" fontSize="11">{format(xmax)}</text>
            <text x="43" y="25" fill="#9EACC4" textAnchor="end" fontSize="11">{format(ymax)}</text>
            <text x="43" y="246" fill="#9EACC4" textAnchor="end" fontSize="11">{format(ymin)}</text>
            <text x="270" y="286" fill="#F2F5FC" textAnchor="middle" fontSize="12">{x}</text>
            <text x="12" y="133" fill="#F2F5FC" textAnchor="middle" fontSize="12" transform="rotate(-90 12 133)">{y}</text>
          </svg>
          <div aria-label="Scatter color legend" className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[#F2F5FC]">
            {evidence.groups.map(group=><span key={group} className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{backgroundColor:colors.get(group)}} />
              <span className="break-all">{group}</span>
            </span>)}
          </div>
        </div>
        <div role="region" aria-label="Scatter point evidence" tabIndex={0} className="max-h-[430px] overflow-auto rounded-xl border border-white/10">
          <table className="w-full text-left text-xs">
            <caption className="p-3 text-left text-[#9EACC4]">First {Math.min(30,evidence.points.length)} plotted rows, from actual observations. The chart is a bounded display sample.</caption>
            <thead className="sticky top-0 bg-[#202B43]"><tr><th scope="col" className="p-2">CSV row</th><th scope="col" className="p-2">{x}</th><th scope="col" className="p-2">{y}</th>{color && <th scope="col" className="p-2">{color}</th>}</tr></thead>
            <tbody>{evidence.points.slice(0,30).map(point=><tr key={point.id} className="border-t border-white/10">
              <th scope="row" className="p-2">{point.rowNumber}</th><td className="p-2 tabular-nums">{format(point.x)}</td><td className="p-2 tabular-nums">{format(point.y)}</td>{color && <td className="p-2 break-words">{point.group}</td>}
            </tr>)}</tbody>
          </table>
        </div>
      </div>
    </> : <p role="status" className="rounded-xl bg-[#151E30] p-4 text-sm">No rows have two observed finite values for this feature pair.</p>}
  </div>;
}

function Balance({ dataset, report }) {
  // Include observed single-class columns so the one-class warning remains reachable.
  const options=report.columns.filter(item=>item.present>0 && item.unique>=1 && item.unique<=12).map(item=>item.name);
  const [column,setColumn]=useState(options.includes('label')?'label':options[0]??'');
  if (!options.length) return <p role="status" className="rounded-xl bg-[#151E30] p-4 text-sm">No low-cardinality class columns are available (1–12 distinct observed values). Inspect distributions for other columns.</p>;
  const evidence=classBalance(dataset.rows,column);
  return <div className="space-y-4">
    <p className="text-sm text-[#9EACC4]">Class frequencies describe the imported data, not model accuracy. A majority-to-minority ratio of at least 3:1 is flagged for review, not automatically corrected.</p>
    <div className="max-w-sm"><Selector label="Class or category column" value={column} options={options} onChange={setColumn}/></div>
    {evidence.available && <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[['Observed labels',evidence.observed],['Missing labels',evidence.missing],['Categories',evidence.categories.length],['Majority:minority',evidence.categories.length>1?`${format(evidence.ratio)}:1`:'N/A']].map(([label,value])=><div key={label} className="rounded-lg bg-[#151E30] p-3">
          <div className="text-xs text-[#9EACC4]">{label}</div><div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
        </div>)}
      </div>
      <p role="status" className={`text-sm ${evidence.status!=='not_flagged'?'text-amber-200':'text-emerald-200'}`}>
        {evidence.status==='single_class'?'Only one class is observed. Binary classification needs more than one class.'
          :evidence.status==='imbalanced'?'Class imbalance flagged for review (at least 3:1). Use stratified evaluation and inspect minority-class errors.'
          :'No 3:1 class imbalance threshold was crossed. Minority-class quality still requires evaluation.'}
      </p>
      <div className="rounded-xl border border-white/10 bg-[#151E30] p-3" role="region" aria-label="Class distribution">
        <table className="w-full text-left text-sm">
          <caption className="mb-2 text-left text-xs text-[#9EACC4]">Exact observed category counts and shares</caption>
          <thead><tr><th scope="col" className="p-2">Class</th><th scope="col" className="p-2">Count</th><th scope="col" className="p-2">Share</th><th scope="col" className="p-2">Distribution</th></tr></thead>
          <tbody>{evidence.categories.map((item,index)=><tr key={item.label} className="border-t border-white/10">
            <th scope="row" className="p-2 break-words">{item.label}</th><td className="p-2 tabular-nums">{item.count}</td><td className="p-2 tabular-nums">{item.percentage.toFixed(1)}%</td>
            <td className="w-1/3 p-2"><div className="h-3 rounded-full bg-[#080D18]"><div className="h-3 rounded-full" style={{width:`${item.percentage}%`,backgroundColor:PALETTE[index%PALETTE.length]}} /></div></td>
          </tr>)}</tbody>
        </table>
      </div>
    </>}
  </div>;
}

function Outliers({ dataset, report }) {
  const numeric=report.columns.filter(column=>column.type==='numeric').map(column=>column.name);
  const [column,setColumn]=useState(numeric[0]??'');
  const signals=qualitySignals(report);
  const evidence=column?tukeyOutliers(dataset.rows,column):null;
  return <div className="space-y-4">
    <div className="rounded-xl border border-white/10 bg-[#151E30] p-4">
      <h5 className="font-semibold text-white">Dataset quality signals</h5>
      <p className="mt-1 text-xs text-[#9EACC4]">Review prompts only. No records are changed or removed automatically.</p>
      <ul aria-label="Dataset quality signals" className="mt-3 space-y-2">
        {signals.map(signal=><li key={signal.id} className={`rounded-lg border px-3 py-2 text-sm ${signal.severity==='review'?'border-amber-400/20 text-amber-200':'border-white/10 text-[#F2F5FC]'}`}>{signal.label}</li>)}
      </ul>
    </div>
    <div className="space-y-3 rounded-xl border border-white/10 bg-[#151E30] p-4">
      <h5 className="font-semibold">Tukey IQR outlier investigation</h5>
      <p className="text-xs text-[#9EACC4]">Descriptive 1.5×IQR fences, calculated from observed finite values only. Flagged values can be valid; review before any decision. At least four values and a positive IQR are required.</p>
      {numeric.length ? <>
        <div className="max-w-sm"><Selector label="Outlier feature" value={column} onChange={setColumn} options={numeric}/></div>
        {evidence.available ? <>
          <div role="status" className="text-sm text-[#F2F5FC]"><strong>{evidence.count} flagged</strong> of {evidence.observed} observed ({evidence.percentage.toFixed(1)}%). {evidence.missing} missing.</div>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[['Q1',evidence.q1],['Q3',evidence.q3],['Lower fence',evidence.lower],['Upper fence',evidence.upper]].map(([label,value])=><div key={label} className="rounded-lg bg-[#080D18] p-3"><dt className="text-xs text-[#9EACC4]">{label}</dt><dd className="text-lg font-semibold tabular-nums">{format(value)}</dd></div>)}
          </dl>
          <div role="region" aria-label="Flagged outlier observations" tabIndex={0} className="max-h-72 overflow-auto rounded-lg border border-white/10">
            <table className="w-full text-left text-xs">
              <caption className="p-3 text-left text-[#9EACC4]">First {Math.min(evidence.count,30)} flagged original observations. No values have been removed.</caption>
              <thead className="bg-[#202B43]"><tr><th scope="col" className="p-2">CSV row</th><th scope="col" className="p-2">Source ID</th><th scope="col" className="p-2">{column}</th></tr></thead>
              <tbody>{evidence.examples.map(item=><tr key={item.id} className="border-t border-white/10">
                <th scope="row" className="p-2">{item.rowNumber}</th><td className="p-2">{item.id}</td><td className="p-2 tabular-nums">{format(item.value)}</td>
              </tr>)}
              {!evidence.count && <tr><td colSpan={3} className="p-3">No values fall outside the calculated fences.</td></tr>}
              </tbody>
            </table>
          </div>
        </> : <p role="status" className="text-sm text-amber-200">Outlier calculation unavailable: {evidence.reason}</p>}
      </> : <p role="status" className="text-sm text-[#9EACC4]">No numeric column is available for outlier analysis.</p>}
    </div>
  </div>;
}

export default function DatasetInvestigation({ dataset, report, mode }) {
  if (mode === 'relationships') return <Relationships dataset={dataset} report={report}/>;
  if (mode === 'balance') return <Balance dataset={dataset} report={report}/>;
  return <Outliers dataset={dataset} report={report}/>;
}
