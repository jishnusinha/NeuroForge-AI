import { validateChartSpec } from './chartSpecV2.js';
import { chartOptions } from './chartOptions.js';
import { delimitedExport } from '../ml/datasheet/transactions.js';
export function chartCsv(spec,{consent=false}={}){
  validateChartSpec(spec);
  if(spec.privacy.observationLevel&&!consent)throw new Error('F18_OBSERVATION_EXPORT_REQUIRES_CONSENT');
  return delimitedExport([spec.evidence.columns.map(c=>c.key),...spec.evidence.rows.map(r=>spec.evidence.columns.map(c=>r[c.key]??null))])+'\r\n';
}
export function portableChart(spec,{consent=false}={}){
  validateChartSpec(spec);
  const result=structuredClone(spec),requires=spec.privacy.observationLevel&&!consent;
  if(requires){
    result.evidence.rows=[];result.evidence.stats={withheld:true};result.evidence.status='unavailable';
    // Local softmax axis units can name the observed predicted class. Keep
    // metadata-only exports free of those observation-derived plot labels too.
    result.plot={kind:spec.plot.kind,xLabel:'Observation evidence withheld',yLabel:'Observation evidence withheld'};
    result.evidence.warnings=['Observation-level plot data withheld. Explicit export consent is required to reproduce the plot.'];
  }
  result.exportManifest={mode:requires?'metadata_only':spec.privacy.observationLevel?'observation_plot_data':'aggregate_plot_data',
    reproduction:'Plots exported measured evidence; does not recompute analysis or fit preprocessing.',
    dataFilename:'neuroforge-chart-data.csv',schemaVersion:1,rawRowIds:false,observationConsent:!!consent,csvEscapes:[]};
  if(!requires){
    result.evidence.rows.forEach((row,i)=>spec.evidence.columns.forEach(c=>{
      const value=row[c.key];
      // eslint-disable-next-line no-control-regex
      if(typeof value==='string'&&/^[\s\u0000-\u001f]*[=+@-]/.test(value))result.exportManifest.csvEscapes.push([i,c.key]);
    }));
    result.renderOption=chartOptions(spec);
  }
  return result;
}
export function sourceCsv(dataset,{consent=false}={}){
  if(!consent)throw new Error('F18_OBSERVATION_EXPORT_REQUIRES_CONSENT');
  return delimitedExport([dataset.headers,...dataset.rows.map(r=>dataset.headers.map(h=>r[h]??null))])+'\r\n';
}
export function sourceJson(dataset,{consent=false}={}){
  if(!consent)throw new Error('F18_OBSERVATION_EXPORT_REQUIRES_CONSENT');
  return {kind:'neuroforge-observations',schemaVersion:1,columns:[...dataset.headers],
    values:dataset.rows.map(row=>dataset.headers.map(column=>row[column]??null)),
    notes:'Typed observation values for explicit analysis reproduction. No raw row IDs. CSV exports separately escape formula-like strings.'};
}
export function downloadText(name,text,type='text/plain'){
  const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
