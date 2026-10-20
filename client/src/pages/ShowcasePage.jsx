import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { generateXOR } from '../ml/datasets';
import { useLabStore } from '../store/useLabStore';
export default function ShowcasePage() {
  const [step,setStep] = useState(0);
  const navigate = useNavigate();
  const {loadRun,setExperimentName} = useLabStore();
  const launch = hidden => {
    const layers = [{id:'input',type:'Input',units:2,activation:'Linear'},...(hidden?[{id:'hidden',type:'Dense',units:4,activation:'ReLU'}]:[]),{id:'output',type:'Output',units:1,activation:'Sigmoid'}];
    loadRun({workspace:'studio',dataset:{name:'XOR Problem',points:generateXOR(180,.12,42),noise:.12,trainRatio:.8,seed:42},hyperparameters:{layers,learningRate:.04,epochs:60,batchSize:16,optimizer:'adam'}});
    setExperimentName(hidden?'XOR hidden-layer variant':'XOR linear baseline'); navigate('/app/studio');
  };
  const steps = [
    {title:'Arrive and explore',time:'0:00–0:25',text:'Enter the lab as a guest. Choose a generated dataset, edit points, and run a real algorithm. No account is needed.',action:<Link to="/app/playground" className="text-cyan-300 underline">Open Playground</Link>},
    {title:'Discover a limitation',time:'0:25–1:00',text:'Train the linear XOR baseline and save its measured results. A single straight boundary cannot perfectly separate XOR; its measured accuracy is not mathematically fixed at 50%.',action:<button onClick={()=>launch(false)} className="text-cyan-300 underline">Open linear baseline</button>},
    {title:'Build a nonlinear model',time:'1:00–1:45',text:'Train the same dataset and split with a hidden layer. Inspect the learned weights and validation metrics, then save this second run. Convergence depends on the architecture and training settings.',action:<button onClick={()=>launch(true)} className="text-cyan-300 underline">Open hidden-layer variant</button>},
    {title:'Compare the evidence',time:'1:45–2:30',text:'Select both saved runs in Arena. Compare their recorded curves using the shared timeline. Matching dataset and split fingerprints make the evaluation comparable; absent measurements remain unavailable.',action:<Link to="/app/arena" className="text-cyan-300 underline">Open Experiment Arena</Link>},
    {title:'Inspect the engineering',time:'2:30–3:00',text:'Small models execute in the browser with TensorFlow.js. Express stores run metadata, actual dataset points and metric history in MongoDB. Without a database the server uses temporary memory; offline saves stay in this browser. Reopen a report to export its configuration or fork a new run.',action:<Link to="/app/experiments" className="text-cyan-300 underline">Inspect saved reports</Link>},
  ];
  return <div className="max-w-5xl mx-auto p-6 sm:p-10 space-y-6 w-full">
    <p className="text-violet-300 text-xs uppercase tracking-widest">Guided interview showcase</p><h2 className="text-3xl font-bold">Explore → Build → Train → Compare</h2>
    <p className="text-slate-400">A suggested three-minute route through real experiments. Save each run before opening the next workspace.</p>
    <nav aria-label="Showcase steps" className="flex flex-wrap gap-2">{steps.map((s,i)=><button key={s.title} aria-current={step===i?'step':undefined} onClick={()=>setStep(i)} className={`p-3 rounded-xl border ${step===i?'border-cyan-300 bg-cyan-300/10':'border-white/10'}`}>{i+1}. {s.title}</button>)}</nav>
    <article className="p-6 rounded-2xl bg-[#151E30] border border-white/10 space-y-5"><p className="text-xs text-violet-300">{steps[step].time}</p><h3 className="text-xl font-bold">{steps[step].title}</h3><p className="text-slate-300 leading-relaxed">{steps[step].text}</p>{steps[step].action}</article>
    <div className="flex justify-between"><button disabled={step===0} onClick={()=>setStep(s=>s-1)} className="p-3 rounded bg-white/10 disabled:opacity-30">Previous</button><button disabled={step===steps.length-1} onClick={()=>setStep(s=>s+1)} className="p-3 rounded bg-violet-400/20 disabled:opacity-30">Next</button></div>
  </div>;
}
