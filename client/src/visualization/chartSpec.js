import { distributionEvidence } from '../ml/edaStatistics.js';
import { digest } from '../../../shared/domain.mjs';

export const PRISM_CHART_SCHEMA_VERSION=1;
export const PRISM_CHART_DATA_FILENAME='neuroforge-chart-data.csv';
export const PRISM_CHART_SPEC_FILENAME='neuroforge-chart.json';

const finite=value=>typeof value==='number'&&Number.isFinite(value);
const safeLabel=(value,max=140)=>typeof value==='string'?value.slice(0,max):'';
const isValidBin=bin=>bin&&finite(bin.from)&&finite(bin.to)&&bin.to>=bin.from&&
  Number.isInteger(bin.count)&&bin.count>=0;

/**
 * The existing F10 distribution engine remains the single source of truth.
 * This bounded aggregate spec contains no source rows, row IDs or fitted data.
 */
export function createHistogramChartSpec({
  dataset,column,binCount=8,sourceName='Imported CSV',sourceCount=null,
}={}){
  if(!dataset||!Array.isArray(dataset.rows)||!Array.isArray(dataset.headers)||
     dataset.rows.length>2000||dataset.headers.length>20||
     typeof column!=='string'||!dataset.headers.includes(column)||
     !Number.isInteger(binCount)||binCount<4||binCount>16||
     (sourceCount!==null&&(!Number.isInteger(sourceCount)||sourceCount<dataset.rows.length)))
    throw new Error('PRISM_INVALID_HISTOGRAM_SOURCE');
  const evidence=distributionEvidence(dataset.rows,column,'numeric',binCount);
  if(evidence.bins.some(bin=>!isValidBin(bin))||
     evidence.bins.reduce((total,bin)=>total+bin.count,0)!==evidence.observed)
    throw new Error('PRISM_INVALID_HISTOGRAM_EVIDENCE');
  return {
    kind:'neuroforge-prism-chart',schemaVersion:PRISM_CHART_SCHEMA_VERSION,
    chartType:'histogram',method:'equal-width-observed',
    title:'Distribution · '+safeLabel(column),column,
    sourceName:safeLabel(sourceName),population:{
      sourceCount:sourceCount??dataset.rows.length,selectedCount:dataset.rows.length,
      observedCount:evidence.observed,missingCount:evidence.missing,
    },
    configuration:{requestedBins:binCount,aggregation:'count',missingPolicy:'exclude'},
    bins:evidence.bins.map(({from,to,count},index)=>({index:index+1,from,to,count})),
    limitations:[
      'Descriptive counts of observed finite values in the current filtered population.',
      'Histogram upper boundary belongs to the final bin. A constant column uses one zero-width bin.',
      'Charts do not imply causation or modify original dataset observations.',
    ],
  };
}
export function validatePrismChartSpec(spec){
  if(!spec||spec.kind!=='neuroforge-prism-chart'||spec.schemaVersion!==1||
     spec.chartType!=='histogram'||spec.method!=='equal-width-observed'||
     typeof spec.column!=='string'||!spec.column||typeof spec.title!=='string'||
     !spec.configuration||!Number.isInteger(spec.configuration.requestedBins)||
     spec.configuration.requestedBins<4||spec.configuration.requestedBins>16||
     !Array.isArray(spec.bins)||spec.bins.length>16||
     spec.bins.some((bin,i)=>!isValidBin(bin)||bin.index!==i+1)||
     !spec.population||!['sourceCount','selectedCount','observedCount','missingCount']
       .every(key=>Number.isInteger(spec.population[key])&&spec.population[key]>=0)||
     spec.population.selectedCount>spec.population.sourceCount||
     spec.population.observedCount+spec.population.missingCount!==spec.population.selectedCount||
     spec.bins.reduce((n,bin)=>n+bin.count,0)!==spec.population.observedCount)
    throw new Error('PRISM_INVALID_CHART_SPEC');
  return spec;
}

/** The digest covers chart-scoped source columns and row identities without exporting them. */
export async function createChartEvidenceBundle(spec,dataset){
  validatePrismChartSpec(spec);
  if(!dataset||!Array.isArray(dataset.rows)||!Array.isArray(dataset.headers)||
     !dataset.headers.includes(spec.column)||
     dataset.rows.length!==spec.population.selectedCount)
    throw new Error('PRISM_CHART_SCOPE_MISMATCH');
  const matching=createHistogramChartSpec({
    dataset,column:spec.column,binCount:spec.configuration.requestedBins,
    sourceName:spec.sourceName,sourceCount:spec.population.sourceCount,
  });
  if(JSON.stringify(matching.bins)!==JSON.stringify(spec.bins)||
     matching.population.observedCount!==spec.population.observedCount)
    throw new Error('PRISM_CHART_SCOPE_MISMATCH');
  const scopeDigest=await digest({
    columns:dataset.headers,rows:dataset.rows.map(row=>({
      id:row.id??null,values:dataset.headers.map(header=>row[header]??null),
    })),
  });
  return {...spec,scopeDigest,scope:'current-filtered-dataset',
    provenance:'chart-scoped SHA-256 of ordered filtered source observations; raw rows excluded from export'};
}
