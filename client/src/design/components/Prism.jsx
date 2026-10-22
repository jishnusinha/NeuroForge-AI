import {useId} from 'react';
import {DENSITIES,TONES,formatMetric} from '../uiContracts.js';
const classes=(...values)=>values.filter(Boolean).join(' ');
export function PrismButton({as:Tag='button',variant='secondary',className,children,...props}){return <Tag {...(Tag==='button'?{type:'button'}:{})} {...props} className={classes('prism-ui-button','prism-ui-button-'+variant,className)}>{children}</Tag>;}
export function PrismCard({as:Tag='section',density='comfortable',className,children,...props}){return <Tag {...props} data-density={DENSITIES.includes(density)?density:'comfortable'} className={classes('prism-ui-card',className)}>{children}</Tag>;}
export function PrismPanel({title,description,actions,children,...props}){return <PrismCard {...props}><header className="prism-ui-section-head"><div><h3>{title}</h3>{description&&<p>{description}</p>}</div>{actions}</header>{children}</PrismCard>;}
export function PrismMetric({label,value,formatted=false,note,...props}){return <div className="prism-ui-metric" {...props}><dt>{label}</dt><dd>{formatted?value:formatMetric(value)}</dd>{note&&<p>{note}</p>}</div>;}
export function PrismField({label,hint,error,id:provided,children,...props}){const generated=useId(),id=provided||generated;return <div className="prism-ui-field"><label htmlFor={id}>{label}</label>{typeof children==='function'?children({id,'aria-describedby':hint||error?id+'-help':undefined,'aria-invalid':error?true:undefined,...props}):children}{(hint||error)&&<p id={id+'-help'} className={error?'prism-ui-error':''}>{error||hint}</p>}</div>;}
export function PrismStatus({tone='neutral',children,announce=false,...props}){return <p {...props} role={announce?(tone==='error'?'alert':'status'):undefined} className={'prism-ui-status prism-ui-status-'+(TONES.includes(tone)?tone:'neutral')}>{children}</p>;}
export function PrismEmptyState({title,children,action}){return <div className="prism-ui-empty"><h3>{title}</h3><p>{children}</p>{action}</div>;}
export function PrismSkeleton({label='Loading workspace',rows=3}){return <div role="status" aria-label={label} className="prism-ui-skeleton"><span className="sr-only">{label}</span>{Array.from({length:Math.min(8,Math.max(1,rows))},(_,i)=><div key={i} aria-hidden="true"/>)}</div>;}
export function PrismDataTable({caption,columns,rows,density='compact',label=caption}){return <div role="region" aria-label={label} tabIndex={0} className="prism-ui-table-scroll" data-density={density}><table><caption>{caption}</caption><thead><tr>{columns.map(c=><th key={c.key} scope="col">{c.label}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={row.key??i}>{columns.map(c=><td key={c.key}>{row[c.key]??'Unavailable'}</td>)}</tr>)}</tbody></table></div>;}
export function PrismTabs({items,value,onChange,label,buttons=false,id:provided,panelId}){
  const generated=useId(),id=provided||generated,eligible=items.filter(item=>!item.disabled);
  const keyDown=(event,index)=>{
    let next;
    if(event.key==='ArrowRight')next=(index+1)%eligible.length;
    else if(event.key==='ArrowLeft')next=(index-1+eligible.length)%eligible.length;
    else if(event.key==='Home')next=0;
    else if(event.key==='End')next=eligible.length-1;
    else return;
    event.preventDefault();onChange(eligible[next].value);
    event.currentTarget.parentElement.querySelectorAll('button:not(:disabled)')[next]?.focus();
  };
  return <div className="prism-ui-tabs" role={buttons?'group':'tablist'} aria-label={label}>{items.map(item=><button key={item.value} type="button" role={buttons?undefined:'tab'} id={id+'-'+item.value} aria-controls={buttons?undefined:panelId} aria-selected={buttons?undefined:value===item.value} aria-pressed={buttons?value===item.value:undefined} tabIndex={buttons||value===item.value?0:-1} disabled={item.disabled} onClick={()=>onChange(item.value)} onKeyDown={e=>keyDown(e,eligible.findIndex(i=>i.value===item.value))}>{item.label??item.value}</button>)}</div>;
}
