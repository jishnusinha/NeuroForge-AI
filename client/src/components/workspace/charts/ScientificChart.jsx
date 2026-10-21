import {useContext,useEffect,useRef,useState} from 'react';
import {ThemeContext} from '../../../theme/themeConfig.js';
import {chartDefinition} from '../../../visualization/chartRegistry.js';
import {chartOptions} from '../../../visualization/chartOptions.js';
import {brushEvidenceIndexes,linkedRows} from '../../../visualization/linkedSelection.js';
import {chartCsv,portableChart,sourceCsv,sourceJson,downloadText} from '../../../visualization/chartExport.js';
import {generatePython} from '../../../visualization/codegen/pythonCodegen.js';
import {generateJavaScript} from '../../../visualization/codegen/javascriptCodegen.js';
import ChartInspector from './ChartInspector.jsx';

const display=value=>value==null?'Unavailable':typeof value==='number'?String(Number(value.toPrecision(12))):String(value);
const populationLabel={source:'Source',filtered_source:'Filtered View',selection:'Selection',working_copy:'Working Copy',prepared_pipeline:'Prepared Pipeline Output'};
function dataDownload(name,url){const a=document.createElement('a');a.download=name;a.href=url;document.body.append(a);a.click();a.remove();}
async function rasterize(url,background){
  const image=new Image();image.src=url;await image.decode();
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,image.width)*2;canvas.height=Math.max(1,image.height)*2;
  const context=canvas.getContext('2d');context.fillStyle=background;context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
  return canvas.toDataURL('image/png');
}

export default function ScientificChart({result,dataset,onLink=()=>{},onShowSheet,onFilterMissing}){
  const {spec,links}=result,{theme}=useContext(ThemeContext),dark=theme!=='paper';
  const host=useRef(null),chart=useRef(null),root=useRef(null),optionRef=useRef(null),exportRef=useRef(null);
  const [tab,setTab]=useState('Chart'),[renderer,setRenderer]=useState(spec.evidence.rows.length>4000?'canvas':'svg'),[consent,setConsent]=useState(false);
  const [message,setMessage]=useState(''),[error,setError]=useState(''),[page,setPage]=useState(0),[benchmark,setBenchmark]=useState(null);
  const onLinkRef=useRef(onLink);
  useEffect(()=>{onLinkRef.current=onLink;},[onLink]);
  const python=generatePython(spec),javascript=generateJavaScript(spec);
  useEffect(()=>{
    if(tab!=='Chart'||!host.current||spec.evidence.status!=='ok')return;
    let cancelled=false,instance,observer;
    const start=performance.now(),family=chartDefinition(spec.chartType).family;
    const loader=family==='distribution'?import('../../../visualization/renderers/distribution.js'):
      family==='relationship'?import('../../../visualization/renderers/relationship.js'):
      family==='quality'?import('../../../visualization/renderers/quality.js'):import('../../../visualization/renderers/pipeline.js');
    loader.then(({echarts})=>{
      if(cancelled||!host.current)return;
      const options=chartOptions(spec,{dark,compact:host.current.clientWidth<420});optionRef.current=options;
      instance=echarts.init(host.current,null,{renderer});chart.current=instance;
      instance.setOption(options);
      const initMs=performance.now()-start;
      setBenchmark({renderer,initMs:Number(initMs.toFixed(2)),evidenceRows:spec.evidence.rows.length});
      instance.on('click',event=>{
        const index=event.data?.evidenceIndex;if(Number.isInteger(index)){const ids=linkedRows(links,[index]);if(ids.length)onLinkRef.current(ids);}
      });
      instance.on('brushselected',event=>{
        const indexes=brushEvidenceIndexes(options,event);
        if(indexes.length||(event.batch||[]).some(batch=>batch.areas?.length))onLinkRef.current(linkedRows(links,indexes));
      });
      observer=new ResizeObserver(()=>instance.resize());observer.observe(host.current);
      exportRef.current=async format=>{
        let temporary,element;
        try{
          if(format==='svg'&&renderer==='canvas'){
            element=document.createElement('div');element.style.cssText='position:fixed;left:-10000px;width:1000px;height:550px';document.body.append(element);
            temporary=echarts.init(element,null,{renderer:'svg'});temporary.setOption(chartOptions(spec,{dark:false}));
          }
          let url=(temporary||instance).getDataURL({type:format,pixelRatio:2,backgroundColor:dark?'#122128':'#fff'});
          if(format==='png'&&url.startsWith('data:image/svg'))url=await rasterize(url,dark?'#122128':'#fff');
          dataDownload('neuroforge-chart.'+format,url);
        }finally{temporary?.dispose();element?.remove();}
      };
    }).catch(e=>{if(!cancelled)setError('Chart renderer failed: '+e.message);});
    return ()=>{cancelled=true;observer?.disconnect();instance?.dispose();chart.current=null;exportRef.current=null;};
  },[spec,links,renderer,dark,tab]);
  const action=async fn=>{setError('');setMessage('');try{await fn();}catch(e){setError(e.message);}};
  const exportAllowed=!spec.privacy.observationLevel||consent;
  const changeTab=value=>{setTab(value);setError('');setMessage('');};
  const maxPage=Math.max(0,Math.ceil(spec.evidence.rows.length/100)-1),currentPage=Math.min(page,maxPage);
  return <section ref={root} className="prism-chart-card prism-f18-chart" aria-label="F18 scientific chart">
    <header className="prism-chart-head"><div>
      <p className="prism-eyebrow">PRISM / REPRODUCIBLE VISUAL EVIDENCE</p><h5 className="prism-chart-title">{spec.title}</h5>
      <p className="prism-subtitle">Population: <strong>{populationLabel[spec.source.population]}</strong> · {spec.source.rowCount} observations · {spec.evidence.rows.length} measured plot records</p>
    </div><button className="prism-action" onClick={()=>action(async()=>{if(document.fullscreenElement)await document.exitFullscreen();else await root.current.requestFullscreen();})}>Fullscreen chart</button></header>
    <div className="prism-chart-toolbar"><div className="prism-chart-tabs" role="group" aria-label="F18 chart views">
      {['Chart','Data','Python','JavaScript','Methods'].map(value=><button key={value} className={'prism-chart-tab '+(tab===value?'prism-chart-tab-active':'')} aria-pressed={tab===value} onClick={()=>changeTab(value)}>{value}</button>)}
    </div></div>
    <div className="prism-chart-body">
      {spec.evidence.warnings.map((warning,i)=><p className="prism-chart-caption" key={i} role="note">{warning}</p>)}
      {tab==='Chart'&&<>
        <div className="prism-sheet-tools">
          <label>Renderer<select aria-label="F18 renderer" value={renderer} onChange={e=>setRenderer(e.target.value)}><option value="svg">SVG</option><option value="canvas">Canvas</option></select></label>
          {links.some(ids=>ids.length)&&<><button onClick={()=>chart.current?.dispatchAction({type:'takeGlobalCursor',key:'brush',brushOption:{brushType:'rect',brushMode:'single'}})}>Brush observations</button>
            <button onClick={()=>{chart.current?.dispatchAction({type:'brush',areas:[]});onLink([]);}}>Clear chart selection</button></>}
          {onShowSheet&&<button onClick={onShowSheet}>Show linked DataSheet</button>}
        </div>
        <div className="prism-f18-plot-layout"><div className="min-w-0 overflow-x-auto">{spec.evidence.status==='ok'?<div ref={host} className="prism-f18-canvas" style={spec.plot.kind==='matrix'?{minWidth:600}:undefined} role="img" aria-label={spec.title+' measured chart; equivalent exact values in Data view'} data-renderer={renderer}/>:
          <p role="status" className="prism-empty">No defined measured evidence for this chart and population. Adjust the variables or inspect Methods.</p>}</div><ChartInspector spec={spec}/></div>
        {benchmark&&<p className="prism-chart-caption" data-testid="f18-render-benchmark">{benchmark.renderer.toUpperCase()} ready in {benchmark.initMs} ms · {benchmark.evidenceRows} evidence records · zoom by wheel/pinch or slider; Data provides keyboard row linking</p>}
      </>}
      {tab==='Data'&&<div className="space-y-3">
        <div className="prism-table-scroll" role="region" tabIndex={0} aria-label="F18 exact plotted data">
          <table className="prism-data-table"><caption>Exact plotted evidence · records {spec.evidence.rows.length?currentPage*100+1:0}–{Math.min((currentPage+1)*100,spec.evidence.rows.length)} of {spec.evidence.rows.length}</caption>
            <thead><tr>{spec.evidence.columns.map(c=><th scope="col" key={c.key}>{c.key}</th>)}{links.length>0&&<th scope="col">Linked observations</th>}</tr></thead>
            <tbody>{spec.evidence.rows.slice(currentPage*100,(currentPage+1)*100).map((row,index)=><tr key={index}>
              {spec.evidence.columns.map(c=><td key={c.key}>{display(row[c.key])}</td>)}
              {links.length>0&&<td><button disabled={!links[currentPage*100+index]?.length} onClick={()=>onLink(linkedRows(links,[currentPage*100+index]))}>Link plotted row {currentPage*100+index+1}</button></td>}
            </tr>)}</tbody></table>
        </div>
        <div className="prism-sheet-tools"><button disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>Previous plot records</button><span>Page {currentPage+1} of {maxPage+1}</span><button disabled={currentPage===maxPage} onClick={()=>setPage(currentPage+1)}>Next plot records</button></div>
        {onFilterMissing&&['missingness','completeness','quality'].includes(spec.chartType)&&<button className="prism-action" onClick={()=>onFilterMissing(spec.variables.x)}>Filter DataSheet to missing {spec.variables.x}</button>}
      </div>}
      {['Python','JavaScript'].includes(tab)&&<div className="space-y-3">
        <p className="prism-chart-caption">Plot-data reproduction: recreates recorded coordinates/counts from the chart JSON and CSV. It does not recalculate statistics or refit a pipeline.</p>
        <button className="prism-action" onClick={()=>action(async()=>{await navigator.clipboard.writeText(tab==='Python'?python:javascript);setMessage(tab+' copied');})}>Copy {tab}</button>
        <pre tabIndex={0} className="prism-code-block"><code>{tab==='Python'?python:javascript}</code></pre>
      </div>}
      {tab==='Methods'&&<div className="space-y-3" aria-label="F18 methods and provenance">
        <p>Method: {spec.method.name} · implementation v{spec.method.implementationVersion} · registry v{spec.registryVersion}</p>
        {spec.method.notes.map((note,i)=><p key={i} className="prism-chart-caption">{note}</p>)}
        <dl className="prism-f18-provenance"><dt>Source</dt><dd>{spec.source.name}</dd><dt>Dataset version</dt><dd>{spec.source.datasetVersion||'Imported source'}</dd><dt>Dataset SHA-256</dt><dd>{spec.source.datasetDigest}</dd><dt>Population SHA-256</dt><dd>{spec.source.scopeDigest}</dd>
          <dt>Pipeline SHA-256</dt><dd>{spec.source.pipelineDigest||'Not a pipeline chart'}</dd><dt>Selection provenance</dt><dd>{spec.source.selectionDigest||'No explicit selection'}</dd></dl>
        <pre className="prism-code-block" tabIndex={0}>{JSON.stringify(spec.evidence.stats,null,2)}</pre>
        <p className="prism-chart-caption">Analysis reproduction requires explicitly exporting original observations and implementing these documented definitions. The supplied scripts only reproduce plotted evidence. No raw row IDs are included in portable exports.</p>
      </div>}
    </div>
    <footer className="prism-chart-footer"><div className="prism-sheet-tools">
      <button onClick={()=>action(()=>{downloadText('neuroforge-chart.json',JSON.stringify(portableChart(spec,{consent}),null,2),'application/json');setMessage(exportAllowed?'Exact chart evidence exported':'Metadata exported; observation-level evidence withheld');})}>Download chart JSON</button>
      <button disabled={!exportAllowed} onClick={()=>action(()=>downloadText('neuroforge-chart-data.csv',chartCsv(spec,{consent}),'text/csv'))}>Download plotted CSV</button>
      <button onClick={()=>downloadText('neuroforge-chart.py',python,'text/x-python')}>Download .py</button>
      <button onClick={()=>downloadText('neuroforge-chart.js',javascript,'text/javascript')}>Download .js</button>
      <button disabled={!exportAllowed||tab!=='Chart'||spec.evidence.status!=='ok'||benchmark?.renderer!==renderer} onClick={()=>action(()=>{if(!exportRef.current)throw new Error('Renderer is not ready for export.');return exportRef.current('svg');})}>Export SVG</button>
      <button disabled={!exportAllowed||tab!=='Chart'||spec.evidence.status!=='ok'||benchmark?.renderer!==renderer} onClick={()=>action(()=>{if(!exportRef.current)throw new Error('Renderer is not ready for export.');return exportRef.current('png');})}>Export PNG</button>
    </div></footer>
    <div className="prism-f18-consent"><label><input type="checkbox" aria-label="Allow observation-level chart exports" checked={consent} onChange={e=>setConsent(e.target.checked)}/> I allow observation-level coordinates, ordered values, missingness patterns and source data to be exported from this population.</label>
      {consent&&dataset&&<button className="prism-action" onClick={()=>action(()=>downloadText('neuroforge-source-observations.csv',sourceCsv(dataset,{consent}),'text/csv'))}>Export source observations CSV</button>}
      {consent&&dataset&&<button className="prism-action" onClick={()=>action(()=>downloadText('neuroforge-source-observations.json',JSON.stringify(sourceJson(dataset,{consent}),null,2),'application/json'))}>Export typed source observations JSON</button>}
      {spec.privacy.observationLevel&&!consent&&<p className="prism-chart-caption">This plot contains observation-level values. CSV/image exports require consent; JSON is metadata-only until consent is granted.</p>}
    </div>
    {message&&<p role="status" className="prism-feedback">{message}</p>}{error&&<p role="alert" className="prism-feedback">{error}</p>}
  </section>;
}
