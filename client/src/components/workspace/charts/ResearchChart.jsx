import {useEffect,useState} from 'react';
import {createResearchChartSpec} from '../../../visualization/researchChartSpec.js';
import ScientificChart from './ScientificChart.jsx';
export default function ResearchChart({source,request,onLink}){
  const [state,setState]=useState(null);
  const key=JSON.stringify(request);
  useEffect(()=>{let current=true;
    createResearchChartSpec({...JSON.parse(key),source}).then(result=>{if(current)setState({result,source,key});}).catch(error=>{if(current)setState({error:error.message,source,key});});
    return ()=>{current=false;};
  },[source,key]);
  const current=state?.source===source&&state?.key===key?state:null;
  return current?.error?<p role="status">Research evidence unavailable: {current.error}</p>:current?.result?<ScientificChart key={current.result.spec.chartId} result={current.result} onLink={onLink}/>:<p role="status">Preparing recorded research evidence…</p>;
}
