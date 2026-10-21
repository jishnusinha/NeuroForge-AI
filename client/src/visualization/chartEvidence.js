import { isMissingValue } from '../ml/edaFilters.js';
import { quantile } from '../ml/datasetProfiling.js';
export const finite=v=>typeof v==='number'&&Number.isFinite(v);
export const numericValues=(rows,column)=>rows.map(r=>r[column]).filter(finite).sort((a,b)=>a-b);
export function summary(values){
  const sorted=values.filter(finite).sort((a,b)=>a-b),n=sorted.length;
  if(!n)return {count:0,min:null,max:null,mean:null,q1:null,median:null,q3:null,sd:null};
  const mean=sorted.reduce((a,b)=>a+b/n,0),sd=n>1?Math.sqrt(sorted.reduce((s,x)=>s+(x-mean)**2/(n-1),0)):null;
  return {count:n,min:sorted[0],max:sorted.at(-1),mean,q1:quantile(sorted,.25),median:quantile(sorted,.5),q3:quantile(sorted,.75),sd};
}
export function grouping(rows,column){
  if(!column)return [{label:'All observations',rows}];
  const map=new Map(),missingKey=Symbol('missing');
  for(const row of rows){const key=isMissingValue(row[column])?missingKey:String(row[column]);
    if(!map.has(key))map.set(key,{label:isMissingValue(row[column])?'Missing group':String(row[column]),rows:[]});map.get(key).rows.push(row);}
  if(map.has(missingKey)&&map.has('Missing group')){let name='Missing group (blank)';while(map.has(name))name+=' *';map.get(missingKey).label=name;}
  const groups=[...map.values()].sort((a,b)=>b.rows.length-a.rows.length||a.label.localeCompare(b.label));
  if(groups.length<=8)return groups;
  let other='Other groups (combined)';while(groups.some(g=>g.label===other))other+=' *';
  return [...groups.slice(0,7),{label:other,rows:groups.slice(7).flatMap(g=>g.rows)}];
}
export function density(values,{bandwidth=null,grid=96}={}){
  const stats=summary(values),n=stats.count;
  if(n<3||new Set(values).size<2||!finite(stats.sd)||stats.sd===0)
    return {rows:[],bandwidth:null,status:'unavailable',warning:'KDE requires at least three finite observations and two distinct values.'};
  const robust=(stats.q3-stats.q1)/1.34;
  const scale=robust>0?Math.min(stats.sd,robust):stats.sd;
  const h=bandwidth===null?.9*scale*n**(-.2):Number(bandwidth);
  if(!finite(h)||h<=0)throw new Error('F18_INVALID_BANDWIDTH');
  const low=stats.min-3*h,high=stats.max+3*h,normalizer=n*h*Math.sqrt(2*Math.PI);
  const rows=Array.from({length:grid},(_,i)=>{
    const x=low+(high-low)*i/(grid-1),y=values.reduce((s,v)=>s+Math.exp(-.5*((x-v)/h)**2),0)/normalizer;
    return {x,y};
  });
  if(rows.some(r=>!finite(r.x)||!finite(r.y)))return {rows:[],bandwidth:h,status:'unavailable',warning:'Density overflow: the numerical range is not representable.'};
  return {rows,bandwidth:h,status:'ok'};
}
export function evidence({columns,rows,kind='bar',stats={},notes=[],warnings=[],observationLevel=false,links=[],plot={}}){
  return {evidence:{columns,rows,stats,status:rows.length?'ok':'unavailable',warnings},
    plot:{kind,...plot},notes,observationLevel,links};
}
export const col=(key,type='number')=>({key,type});
