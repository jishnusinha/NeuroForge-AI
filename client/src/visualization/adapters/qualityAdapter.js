import { correlationEvidence } from '../../ml/edaStatistics.js';
import { missingnessEvidence } from '../../ml/edaMissingness.js';
import { isMissingValue } from '../../ml/edaFilters.js';
import { finite,evidence,col } from '../chartEvidence.js';

export function compute({dataset,config}){
  const {type,x,columns=dataset.headers,correlation='pearson'}=config;
  const rows=[],links=[],warnings=[],stats={denominator:dataset.rows.length};
  let kind='bar',observationLevel=false;
  if(type==='correlation'||type==='correlation_rank'){
    const result=correlationEvidence(dataset,columns,correlation);stats.method=correlation;stats.columns=result.columns;
    stats.unavailableCoefficients=result.matrix.flat().filter(c=>c.r===null).length;
    if(stats.unavailableCoefficients)warnings.push(stats.unavailableCoefficients+' correlation cells are unavailable and remain blank; Data lists their exact pairwise counts.');
    if(type==='correlation'){kind='heatmap';result.matrix.flat().forEach(c=>rows.push({x:c.x,y:c.y,value:c.r,count:c.count,excluded:dataset.rows.length-c.count}));}
    else result.matrix.flat().filter(c=>c.x===x&&c.x!==c.y).sort((a,b)=>Math.abs(b.r??-Infinity)-Math.abs(a.r??-Infinity)).forEach(c=>rows.push({x:c.y,y:c.r,count:c.count,series:x,excluded:dataset.rows.length-c.count}));
  }else if(type==='missingness'||type==='completeness'){
    const result=missingnessEvidence(dataset,columns,80);stats.complete=result.complete;stats.incomplete=result.incomplete;
    if(type==='missingness'){
      kind='heatmap';observationLevel=true;stats.displayedRows=result.displayedCount;
      result.displayRows.forEach(r=>r.missing.forEach((missing,i)=>{rows.push({x:columns[i],y:String(r.number),value:missing?1:0,count:1});links.push([r.id]);}));
    }else result.columns.sort((a,b)=>b.missing-a.missing).forEach(c=>{rows.push({series:'Missing %',x:c.column,y:dataset.rows.length?100*c.missing/dataset.rows.length:0,count:c.missing,observed:c.observed,denominator:dataset.rows.length});links.push(dataset.rows.filter(r=>isMissingValue(r[c.column])).map(r=>r.id));});
  }else if(type==='duplicates'){
    const seen=new Set();let duplicates=0;
    for(const row of dataset.rows){const key=JSON.stringify(dataset.headers.map(h=>row[h]??null));if(seen.has(key))duplicates++;else seen.add(key);}
    rows.push({x:'First occurrences',y:dataset.rows.length-duplicates,count:dataset.rows.length-duplicates,series:'Rows'},
      {x:'Repeated occurrences',y:duplicates,count:duplicates,series:'Rows'});
  }else{
    for(const column of columns){
      let numeric=0,text=0,missing=0;const unique=new Set();
      for(const row of dataset.rows){const v=row[column];if(isMissingValue(v))missing++;else{unique.add(typeof v+':'+String(v));if(finite(v))numeric++;else text++;}}
      if(type==='types')for(const [label,n] of [['Numeric',numeric],['Text',text],['Missing',missing]])rows.push({series:label,x:column,y:n,count:n,denominator:dataset.rows.length});
      else rows.push({series:'Missing',x:column,y:missing,count:missing,numeric,text,unique:unique.size,denominator:dataset.rows.length});
    }
  }
  return evidence({columns:[col('series','text'),col('x','text'),col('y',kind==='heatmap'?'text':'number'),col('value'),col('count'),col('excluded'),col('observed'),col('numeric'),col('text'),col('unique'),col('denominator')],
    rows,kind,stats,links,warnings,observationLevel,notes:['Pearson and tie-aware Spearman values and pairwise observation counts reuse the F10 correlation engine. Fewer than three pairs or zero variance is unavailable, never zero.',
      'Missingness counts use every scoped row. The matrix shows up to 80 systematically spaced source rows; displayed row numbers are positions in this population, not stable IDs.',
      'Completeness denominators include all scoped observations. Missing means null, undefined, blank or non-finite.',
      'Duplicates compare original column values, excluding generated row IDs; counts describe repeated occurrences after the first. No cleanup or source mutation occurs.'],
    plot:{correlation:type==='correlation',xLabel:type==='correlation'?'Variable':'Column / category',yLabel:type==='completeness'?'Missing (%)':kind==='heatmap'?'Variable / scoped observation':'Rows'}});
}
