import { useMemo, useRef, useState } from 'react';
import { Code2, Copy, Download, Expand, Minus, Plus, Table2, ChartColumn, RotateCcw } from 'lucide-react';
import { createChartEvidenceBundle, createHistogramChartSpec } from '../../../visualization/chartSpec.js';
import { generateHistogramPython, histogramChartCsv, histogramChartJson } from '../../../visualization/pythonCodegen.js';

const display=n=>Number.isFinite(n)?Number(n.toPrecision(6)).toLocaleString(undefined,{maximumFractionDigits:6}):'Unavailable';
const chartButton='prism-action min-h-10 gap-2 px-3 py-2 text-xs font-medium disabled:opacity-40';

function saveText(filename,text,type){
  const url=URL.createObjectURL(new Blob([text],{type}));
  const anchor=document.createElement('a');
  anchor.href=url;anchor.download=filename;
  document.body.appendChild(anchor);anchor.click();anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1200);
}

function HistogramPlot({spec,zoom}){
  const bins=spec.bins;
  const max=Math.max(1,...bins.map(bin=>bin.count));
  const top=Math.ceil(max/4)*4;
  const left=68,right=727,base=281,topPx=38;
  const space=(right-left)/Math.max(1,bins.length);
  return <div className="prism-plot-scroll" role="region" tabIndex={0} aria-label="Scrollable PRISM histogram plot">
    <svg viewBox="0 0 780 347" style={{width:(zoom*100)+'%',minWidth:'540px'}}
      className="prism-plot" role="img"
      aria-label={spec.column+' observed histogram: '+bins.map(bin=>display(bin.from)+' to '+display(bin.to)+', '+bin.count+' rows').join('; ')}>
      <defs>
        <linearGradient id="prism-f16-hist-gradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgb(var(--nf-accent-rgb))" stopOpacity=".98"/>
          <stop offset="100%" stopColor="rgb(var(--nf-accent-rgb))" stopOpacity=".42"/>
        </linearGradient>
      </defs>
      {Array.from({length:5},(_,i)=>{
        const y=base-i*(base-topPx)/4;
        return <g key={i}>
          <line x1={left} x2={right} y1={y} y2={y} className="prism-gridline"/>
          <text x={left-12} y={y+4} textAnchor="end" className="prism-axis-label">{display(top*i/4)}</text>
        </g>;
      })}
      <line x1={left} x2={left} y1={topPx} y2={base} className="prism-axis"/>
      <line x1={left} x2={right} y1={base} y2={base} className="prism-axis"/>
      <text x="20" y="164" textAnchor="middle" className="prism-axis-title"
        transform="rotate(-90 20 164)">Observed rows</text>
      {bins.map((bin,index)=>{
        const h=bin.count/top*(base-topPx);
        const x=left+index*space+3;
        const w=Math.max(2,space-6);
        return <g key={index}>
          <rect className="prism-hist-bar" x={x} y={base-h} width={w} height={h}
            rx="3" fill="url(#prism-f16-hist-gradient)">
            <title>{'Bin '+bin.index+': '+display(bin.from)+'–'+display(bin.to)+', '+bin.count+' observed rows'}</title>
          </rect>
          {(index%Math.max(1,Math.ceil(bins.length/7))===0||index===bins.length-1)&&
            <text x={x+w/2} y={base+20} textAnchor="middle" className="prism-axis-label">{bin.index}</text>}
        </g>;
      })}
      <text x={(right+left)/2} y="329" textAnchor="middle" className="prism-axis-title">
        {spec.column+' · numbered equal-width bins'}
      </text>
    </svg>
  </div>;
}

export default function ScientificHistogram({dataset,column,binCount=8,sourceName='Imported CSV',sourceCount=null}){
  const [view,setView]=useState('chart');
  const [zoom,setZoom]=useState(1);
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const root=useRef(null);
  const spec=useMemo(()=>createHistogramChartSpec({
    dataset,column,binCount,sourceName,sourceCount,
  }),[dataset,column,binCount,sourceName,sourceCount]);
  const python=useMemo(()=>generateHistogramPython(spec),[spec]);
  const csv=useMemo(()=>histogramChartCsv(spec),[spec]);
  const copy=async()=>{
    try{
      await navigator.clipboard.writeText(python);
      setMessage('Python code copied. Export the CSV and JSON inputs to run it.');
    }catch{
      setMessage('Clipboard unavailable. Select the Python text below to copy manually.');
      setView('python');
    }
  };
  const exportEvidence=async()=>{
    if(busy)return;
    setBusy(true);setMessage('');
    try{
      const stamped=await createChartEvidenceBundle(spec,dataset);
      saveText('neuroforge-chart.json',histogramChartJson(stamped),'application/json');
      setMessage('Summary-only chart JSON exported with a chart-scope fingerprint. No original rows included.');
    }catch(reason){setMessage('Chart evidence export failed: '+reason.message);}
    finally{setBusy(false);}
  };
  const expand=async()=>{
    try{
      if(document.fullscreenElement){await document.exitFullscreen();}
      else if(root.current?.requestFullscreen)await root.current.requestFullscreen();
      else setMessage('Fullscreen is not available in this browser.');
    }catch{setMessage('Fullscreen is not available in this browser.');}
  };
  const controls=[
    {id:'chart',title:'Chart',icon:ChartColumn},
    {id:'data',title:'Data',icon:Table2},
    {id:'python',title:'Python',icon:Code2},
  ];
  return <section ref={root} className="prism-chart-card" aria-label="PRISM scientific histogram">
    <header className="prism-chart-head">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="prism-eyebrow">PRISM / SCIENTIFIC VISUALIZATION</span>
          <span className="prism-status-pill">F16 · Live F10 evidence</span>
        </div>
        <h5 className="prism-chart-title">{spec.title}</h5>
        <p className="prism-subtitle">Equal-width bins · filtered source population · missing values excluded</p>
      </div>
      <button type="button" onClick={expand} className={chartButton} aria-label="Expand PRISM chart">
        <Expand size={14} aria-hidden="true"/> Expand
      </button>
    </header>
    <div className="prism-metric-strip">
      <span><strong>{spec.population.selectedCount}</strong> filtered rows</span>
      <span><strong>{spec.population.observedCount}</strong> observed</span>
      <span><strong>{spec.population.missingCount}</strong> missing</span>
      <span><strong>{spec.bins.length}</strong> plotted bins</span>
    </div>
    <div className="prism-chart-toolbar">
      <div className="prism-chart-tabs" role="group" aria-label="PRISM chart views">
        {controls.map(({id,title,icon:Icon})=><button key={id} type="button"
          aria-pressed={view===id} onClick={()=>{setView(id);setMessage('');}}
          className={'prism-chart-tab '+(view===id?'prism-chart-tab-active':'')}>
          <Icon size={14} aria-hidden="true"/>{title}
        </button>)}
      </div>
      {view==='chart'&&<div className="flex items-center gap-1" role="group" aria-label="PRISM plot zoom">
        <button type="button" title="Zoom out" aria-label="PRISM zoom out" disabled={zoom<=1}
          className={chartButton} onClick={()=>setZoom(value=>Math.max(1,value-.25))}><Minus size={14}/></button>
        <span className="prism-zoom-label">{Math.round(zoom*100)}%</span>
        <button type="button" title="Zoom in" aria-label="PRISM zoom in" disabled={zoom>=2}
          className={chartButton} onClick={()=>setZoom(value=>Math.min(2,value+.25))}><Plus size={14}/></button>
        <button type="button" title="Reset zoom" aria-label="PRISM reset zoom" disabled={zoom===1}
          className={chartButton} onClick={()=>setZoom(1)}><RotateCcw size={14}/></button>
      </div>}
    </div>
    <div className="prism-chart-body">
      {view==='chart'&&<div className="space-y-2">
        <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(220px,0.35fr)]">
          {spec.bins.length?
            <HistogramPlot spec={spec} zoom={zoom}/>:
            <div role="status" className="prism-empty">No observed finite numeric values in this filter scope.</div>}
          <div role="region" aria-label="Distribution values" tabIndex={0}
            className="prism-table-scroll">
            <table className="prism-data-table prism-compact-table">
              <caption>Measured distribution values</caption>
              <thead><tr><th scope="col">Group</th><th scope="col">Range</th><th scope="col">Rows</th></tr></thead>
              <tbody>{spec.bins.map(bin=><tr key={bin.index}>
                <th scope="row">{bin.index}</th>
                <td>{display(bin.from)} to {display(bin.to)}</td>
                <td>{bin.count}</td>
              </tr>)}</tbody>
              <tfoot><tr><th scope="row" colSpan={2}>Total</th><td>{spec.population.observedCount}</td></tr></tfoot>
            </table>
          </div>
        </div>
        <p className="prism-chart-caption">
          Hover any bar for its exact count. X-axis labels are bin numbers; the adjacent table retains the measured distribution values. Open <strong>Data</strong> for the full numerical table.
        </p>
      </div>}
      {view==='data'&&<div role="region" aria-label="PRISM histogram data table" tabIndex={0} className="prism-table-scroll">
        <table className="prism-data-table">
          <caption>Exact F10 distribution evidence for {spec.column}</caption>
          <thead><tr><th scope="col">Bin</th><th scope="col">Lower edge</th><th scope="col">Upper edge</th><th scope="col">Observed rows</th></tr></thead>
          <tbody>{spec.bins.map(bin=><tr key={bin.index}>
            <th scope="row">{bin.index}</th><td>{display(bin.from)}</td>
            <td>{display(bin.to)}</td><td className="tabular-nums">{bin.count}</td>
          </tr>)}</tbody>
          <tfoot><tr><th scope="row" colSpan={3}>Observed total</th><td>{spec.population.observedCount}</td></tr></tfoot>
        </table>
      </div>}
      {view==='python'&&<div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="prism-chart-caption">Matplotlib + Seaborn · exported exact histogram bins</p>
          <button type="button" onClick={copy} className={chartButton}>
            <Copy size={14} aria-hidden="true"/> Copy Python
          </button>
        </div>
        <pre className="prism-code-block" tabIndex={0}><code>{python}</code></pre>
        <p className="prism-chart-caption">
          Download the data CSV and chart JSON below alongside the Python script.
          This script plots saved counts; it does not access private original observations or train a model.
        </p>
      </div>}
    </div>
    <footer className="prism-chart-footer">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={()=>{saveText('neuroforge-chart-data.csv',csv,'text/csv');setMessage('Histogram summary CSV exported. No original observations included.');}} className={chartButton}>
          <Download size={14} aria-hidden="true"/> Data CSV
        </button>
        <button type="button" disabled={busy} onClick={exportEvidence} className={chartButton}>
          <Download size={14} aria-hidden="true"/> Chart JSON
        </button>
        <button type="button" onClick={()=>{saveText('neuroforge-chart.py',python,'text/x-python');setMessage('Runnable Python chart script exported.');}} className={chartButton}>
          <Download size={14} aria-hidden="true"/> Python script
        </button>
      </div>
      <p className="prism-chart-caption">Browser-local · summary-only exports</p>
    </footer>
    {message&&<p role="status" className="prism-feedback">{message}</p>}
  </section>;
}
