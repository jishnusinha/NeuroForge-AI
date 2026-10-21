import { createHistogramChartSpec } from '../chartSpec.js';
import { distributionEvidence } from '../../ml/edaStatistics.js';
import { numericValues,summary,grouping,density,evidence,col } from '../chartEvidence.js';

export function compute({dataset,config}){
  const {type,x,group,bins=8,normalization='count',binning='equal_width',bandwidth=null}=config;
  const groups=grouping(dataset.rows,group),rows=[],warnings=[],summaries=[];
  const links=[];
  let template=null;
  if(type==='histogram'){
    const values=numericValues(dataset.rows,x),stats=summary(values);let requested=bins;
    if(binning==='sturges')requested=Math.max(4,Math.min(16,Math.ceil(Math.log2(Math.max(1,values.length))+1)));
    if(binning==='freedman_diaconis'){
      const width=2*(stats.q3-stats.q1)/Math.cbrt(Math.max(1,values.length));
      requested=width>0?Math.max(4,Math.min(16,Math.ceil((stats.max-stats.min)/width))):4;
    }
    template=createHistogramChartSpec({dataset,column:x,binCount:requested});
  }
  for(const g of groups){
    const values=numericValues(g.rows,x),stats=summary(values);summaries.push({group:g.label,...stats,excluded:g.rows.length-values.length});
    if(type==='count'){
      const result=distributionEvidence(g.rows,x,'categorical');
      summaries[summaries.length-1]={group:g.label,count:result.observed,excluded:result.missing};
      result.categories.forEach((c,i)=>{
        let label=c.label;if(i===12){label='Other categories (combined)';while(result.categories.slice(0,12).some(v=>v.label===label))label+=' *';}
        rows.push({series:g.label,x:label,y:c.count,count:c.count,denominator:result.observed});
      });
    }else if(type==='histogram'){
      if(!values.length){warnings.push(g.label+': no finite numeric observations.');continue;}
      let measured=template.bins;
      if(groups.length>1&&measured.length){
        const from=measured[0].from,to=measured.at(-1).to,width=(to-from)/measured.length,counts=Array(measured.length).fill(0);
        for(const value of values)counts[width===0?0:Math.min(measured.length-1,Math.max(0,Math.floor((value-from)/width)))]++;
        measured=measured.map((bin,i)=>({...bin,count:counts[i]}));
      }
      measured.forEach(b=>{
        let y=b.count;
        if(normalization==='frequency')y=values.length?y/values.length:0;
        if(normalization==='density')y=b.to>b.from?y/(values.length*(b.to-b.from)):null;
        if(y===null){warnings.push('Density is undefined for a zero-width constant column; choose count or frequency.');return;}
        rows.push({series:g.label,x:b.index,y,from:b.from,to:b.to,count:b.count,denominator:values.length});
      });
    }else if(type==='ecdf'){
      for(let i=0;i<values.length;){let end=i+1;while(end<values.length&&values[end]===values[i])end++;
        rows.push({series:g.label,x:values[i],y:end/values.length,count:end,denominator:values.length});i=end;}
    }else if(type==='box'){
      if(!values.length)continue;
      const iqr=stats.q3-stats.q1,inside=values.filter(v=>v>=stats.q1-1.5*iqr&&v<=stats.q3+1.5*iqr);
      rows.push({series:g.label,x:g.label,y:stats.median,low:inside[0],q1:stats.q1,median:stats.median,q3:stats.q3,high:inside.at(-1),count:values.length,outliers:values.length-inside.length});
    }else{
      const kde=density(values,{bandwidth});
      if(kde.warning)warnings.push(g.label+': '+kde.warning);
      for(const point of kde.rows)rows.push({series:g.label,x:point.x,y:point.y,count:values.length,bandwidth:kde.bandwidth,q1:stats.q1,median:stats.median,q3:stats.q3});
    }
  }
  const columns=type==='box'?[col('series','text'),col('x','text'),...['y','low','q1','median','q3','high','count','outliers'].map(k=>col(k))]:
    [col('series','text'),col('x',type==='count'?'text':'number'),...['y','from','to','count','denominator','bandwidth','q1','median','q3'].map(k=>col(k))];
  return evidence({columns,rows,kind:type==='box'?'box':type==='violin'?'violin':['kde','ecdf'].includes(type)?'line':'bar',
    stats:{groups:summaries,rows:dataset.rows.length},warnings:[...new Set(warnings)],observationLevel:type==='ecdf',links,
    notes:['Numeric plots exclude non-finite and non-numeric cells; exclusions are counted separately per group.',
      'Quartiles use linear interpolation at (n−1)p. Box whiskers end at observed values within 1.5 IQR; outlier counts are reported without exposing individual outlier coordinates.',
      'Gaussian KDE: explicit bandwidth or Silverman robust rule 0.9 min(sample SD, IQR/1.34) n^(−1/5); 96 samples over observed range ±3 bandwidths. Violin widths share a common density scale.',
      'ECDF is right-continuous: P(X ≤ x), with ties combined. Up to eight groups; remaining groups are explicitly combined.',
      'Histograms reuse the F16/F10 numerical engine; grouped histograms share the full scoped population’s bin edges and the same floor/clamp assignment rule. The final upper edge is included. Adaptive bin counts are constrained to 4–16.'],
    plot:{histogram:type==='histogram',step:type==='ecdf',xLabel:['box','violin'].includes(type)?group||'Group':type==='histogram'?x+' · numbered bins':x,
      yLabel:['box','violin'].includes(type)?x:type==='kde'?'Estimated density':type==='ecdf'?'Cumulative fraction':normalization==='count'?'Observed rows':normalization,grouped:!!group}});
}
