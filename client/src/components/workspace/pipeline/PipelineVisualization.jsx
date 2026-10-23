import {lazy,Suspense,useState} from 'react';
const ChartStudio=lazy(()=>import('../charts/ChartStudio.jsx'));
export default function PipelineVisualization({dataset,plan}){
  const [open,setOpen]=useState(false);
  return <details className="prism-f18-pipeline" onToggle={event=>setOpen(event.currentTarget.open)}><summary> · Visualize fitted preprocessing</summary>
    {open&&<Suspense fallback={<p role="status">Loading frozen pipeline visualization…</p>}><ChartStudio dataset={dataset} sourceDataset={dataset} plan={plan} population="prepared_pipeline"/></Suspense>}
  </details>;
}
