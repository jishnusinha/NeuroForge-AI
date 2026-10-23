import {useMemo} from 'react';

function summarize(spec,rows){
 const target=spec.target,x=spec.visual[0],positive=spec.id==='flower-species'?null:spec.id==='manufacturing-defects'?'defect':spec.id==='telecom-churn'?'churned':spec.id==='retail-purchase'?'purchased':spec.id==='loan-payment-risk'?'late_payment_flag':spec.id==='product-returns'?'returned':null;
 if(spec.task==='Regression'){
  const values=rows.map(row=>row[x]).filter(Number.isFinite),min=Math.min(...values),max=Math.max(...values),bins=Array.from({length:5},(_,i)=>({label:`${(min+(max-min)*i/5).toFixed(1)}–${(min+(max-min)*(i+1)/5).toFixed(1)}`,sum:0,count:0}));
  for(const row of rows){if(Number.isFinite(row[x])&&Number.isFinite(row[target])){const i=Math.min(4,Math.floor((row[x]-min)/Math.max(Number.EPSILON,max-min)*5));bins[i].sum+=row[target];bins[i].count++;}}
  return {title:`Observed ${target} by ${x} range`,measure:`Mean ${target}`,rows:bins.map(bin=>({label:bin.label,count:bin.count,value:bin.count?bin.sum/bin.count:null}))};
 }
 if(spec.id==='customer-segmentation'){
  const sorted=[...rows].sort((a,b)=>a[x]-b[x]),groups=Array.from({length:5},(_,i)=>sorted.slice(Math.floor(i*sorted.length/5),Math.floor((i+1)*sorted.length/5)));
  return {title:'Visits across spend quintiles',measure:'Mean monthly visits',rows:groups.map((group,i)=>({label:`Spend quintile ${i+1}`,count:group.length,value:group.length?group.reduce((s,row)=>s+row.monthly_visits,0)/group.length:null}))};
 }
 if(positive){
  const outcomeGroups=new Map();for(const row of rows){const label=String(row[target]);if(!outcomeGroups.has(label))outcomeGroups.set(label,[]);outcomeGroups.get(label).push(row);}
  if(['retail-purchase','loan-payment-risk','product-returns'].includes(spec.id)){
   const cohort=spec.id==='retail-purchase'?'discount_rate':spec.id==='loan-payment-risk'?'debt_to_income':'shipping_days',values=rows.map(row=>row[cohort]).filter(Number.isFinite),min=Math.min(...values),max=Math.max(...values),bins=Array.from({length:5},(_,i)=>({label:`${(min+(max-min)*i/5).toFixed(2)}–${(min+(max-min)*(i+1)/5).toFixed(2)}`,positive:0,count:0}));
   for(const row of rows){if(Number.isFinite(row[cohort])){const i=Math.min(4,Math.floor((row[cohort]-min)/Math.max(Number.EPSILON,max-min)*5));bins[i].count++;bins[i].positive+=Number(row[target]===1||row[target]===true);}}
   return {title:`${target} rate by ${cohort} band`,measure:`Observed ${target} rate`,rows:bins.map(bin=>({label:bin.label,count:bin.count,value:bin.count?bin.positive/bin.count:null}))};
  }
  return {title:`${target} class composition`,measure:'Rows',rows:[...outcomeGroups].map(([label,group])=>({label:label==='0'?'No':label==='1'?'Yes':label,count:group.length,value:group.length}))};
 }
 const groups=new Map();for(const row of rows){const label=String(row[target]);if(!groups.has(label))groups.set(label,[]);groups.get(label).push(row);}
 return {title:`${x} mean by ${target}`,measure:`Mean ${x}`,rows:[...groups].map(([label,group])=>({label,count:group.length,value:group.reduce((sum,row)=>sum+row[x],0)/group.length}))};
}

export default function CaseEvidence({spec,rows}){
 const evidence=useMemo(()=>summarize(spec,rows),[spec,rows]),maximum=Math.max(1,...evidence.rows.map(row=>row.value||0));
 return <figure className="rounded-2xl border border-white/10 bg-surface-dark p-4"><figcaption className="font-semibold">{evidence.title}</figcaption><p className="mt-1 text-xs text-text-muted">Descriptive measurements from all {rows.length.toLocaleString()} deterministic generated rows; no fitted model result is implied.</p><div className="mt-4 space-y-2" role="group" aria-label={`${evidence.measure} by group for ${spec.title}`}>
  {evidence.rows.map(row=><div key={row.label} className="grid grid-cols-[minmax(7rem,1fr)_3fr_auto] items-center gap-2 text-xs"><span className="truncate" title={row.label}>{row.label}</span><div className="h-5 overflow-hidden rounded bg-surface-inset"><div className="h-full rounded bg-[rgb(var(--nf-accent-rgb))]" style={{width:`${Math.max(0,Math.min(100,100*(row.value||0)/maximum))}%`}}/></div><span className="tabular-nums">{row.value==null?'Unavailable':Number(row.value.toFixed(3))} · n={row.count}</span></div>)}
 </div><div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs"><caption className="sr-only">Exact descriptive evidence for {spec.title}</caption><thead><tr><th scope="col" className="p-1">Group</th><th scope="col" className="p-1">{evidence.measure}</th><th scope="col" className="p-1">Rows</th></tr></thead><tbody>{evidence.rows.map(row=><tr key={row.label} className="border-t border-white/10"><th scope="row" className="p-1 font-normal">{row.label}</th><td className="p-1 tabular-nums">{row.value==null?'Unavailable':Number(row.value.toFixed(6))}</td><td className="p-1 tabular-nums">{row.count}</td></tr>)}</tbody></table></div></figure>;
}
