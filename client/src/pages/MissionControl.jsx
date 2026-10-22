import React, { lazy,Suspense,useEffect, useState } from 'react';
import ResearchPageHeader from '../design/patterns/ResearchPageHeader.jsx';
import ResearchJourneys from '../design/patterns/ResearchJourneys.jsx';
import {PrismCard,PrismStatus} from '../design/components/Prism.jsx';
import {listF14Runs} from '../services/modelRegistryRepository.js';
const DesignGallery=lazy(()=>import('../design/components/DesignGallery.jsx'));
import { fetchExperiments } from '../services/api';
import { Link,useLocation } from 'react-router-dom';
import { 
  Sliders, 
  Network, 
  Scale, 
  Play, 
  Sparkles, 
  ArrowRight,
  Activity
} from 'lucide-react';
import { useLabStore } from '../store/useLabStore';

export default function MissionControl() {
  const location=useLocation();
  const { setCommandPaletteOpen } = useLabStore();

  const stats = [
    { label: 'Scientific Workflows', value: 'Data · Models · Research', change: 'Explore, evaluate and compare', color: 'text-plasma-cyan' },
    { label: 'Standard Datasets', value: '6 Presets', change: 'Moons, XOR, Spiral, Blobs...', color: 'text-neural-violet' },
    { label: 'Evaluation Protocol', value: 'Protected Splits', change: 'Training, validation and final test stay distinct', color: 'text-quantum-mint' },
    { label: 'Engine Runtime', value: 'Browser computation', change: 'CPU / WebGL where available', color: 'text-signal-amber' },
  ];

  const [recentExperiments,setRecentExperiments] = useState([]);
  const [localRuns,setLocalRuns]=useState([]),[localError,setLocalError]=useState('');
  useEffect(()=>{let alive=true;const load=()=>listF14Runs().then(runs=>{if(alive){setLocalRuns(runs.slice(0,3));setLocalError('');}}).catch(()=>{if(alive){setLocalRuns([]);setLocalError('Local research archive is unavailable. Open My Experiments to inspect storage recovery.');}});void load();window.addEventListener('focus',load);window.addEventListener('f14-archive-change',load);return ()=>{alive=false;window.removeEventListener('focus',load);window.removeEventListener('f14-archive-change',load);};},[]);
  useEffect(() => {
    let alive = true;
    fetchExperiments().then(runs => { if (alive) setRecentExperiments(runs.slice(0,3).map(run => ({
      id:run._id,title:run.name,type:run.algorithm,dataset:run.dataset?.name,
      metric:Number.isFinite(run.metrics?.valAccuracy)?`Validation: ${(run.metrics.valAccuracy*100).toFixed(1)}%`:Number.isFinite(run.metrics?.mse)?`MSE: ${run.metrics.mse}`:Number.isFinite(run.metrics?.inertia)?`Inertia: ${run.metrics.inertia}`:'Metrics in report',
      status:run.status,time:new Date(run.createdAt).toLocaleDateString(),path:`/app/experiments/${run.shareId || run._id}`,
    }))); });
    return () => { alive = false; };
  },[]);

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-200">
      <ResearchPageHeader eyebrow="NeuroForge / PRISM" title="Your scientific workspace" description="Start with data, understand a fitted model, or continue a recorded investigation. Every conclusion should lead back to measured evidence."/>
      <ResearchJourneys/>
      <PrismCard aria-label="Recent local research"><h3 className="font-semibold mb-3">Recent local research</h3>{localError?<PrismStatus tone="warning">{localError}</PrismStatus>:localRuns.length?<ul className="space-y-3">{localRuns.map(run=><li key={run.runId}><Link className="underline underline-offset-4" to={'/app/experiments?view=research&run='+encodeURIComponent(run.runId)}>{run.title}</Link><p className="text-xs text-text-muted">{run.model.algorithm} · {run.validation.count} validation observations · Local receipt revision {run.revision}</p></li>)}</ul>:<p className="text-sm text-text-muted">No local research receipts yet. Prepare a dataset, evaluate a model and save its research run to continue here.</p>}</PrismCard>
      {/* Welcome Banner / Challenge Callout */}
      <div className="relative rounded-2xl border border-white/10 bg-gradient-to-r from-obsidian via-obsidian to-surface-elevated p-6 sm:p-8 overflow-hidden shadow-xl">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-plasma-cyan/10 to-transparent pointer-events-none" />
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-plasma-cyan/15 text-plasma-cyan text-xs font-mono mb-3 border border-plasma-cyan/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Featured Interview Challenge</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
            The 90-Second Neural Network Challenge
          </h2>
          <p className="mt-2 text-sm text-text-muted leading-relaxed">
            Can a single perceptron solve the XOR problem? Experience first-hand how adding hidden representations enables non-linear decision boundaries.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link
              to="/showcase"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-plasma-cyan to-quantum-mint text-ink-on-accent font-semibold text-xs shadow-glow-cyan hover:opacity-95 transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Launch 3-Minute Showcase Tour</span>
            </Link>
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-white text-xs font-medium transition-colors"
            >
              <span>Command Palette (Ctrl+K)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, idx) => (
          <div key={idx} className="p-5 rounded-2xl bg-obsidian/60 border border-white/10 shadow-sm">
            <span className="text-xs font-mono text-text-muted uppercase tracking-wider">{s.label}</span>
            <div className={`mt-2 text-2xl font-display font-bold ${s.color}`}>
              {s.value}
            </div>
            <p className="mt-1 text-xs text-text-muted flex items-center gap-1 font-mono">
              {s.change}
            </p>
          </div>
        ))}
      </div>

      {/* Flagship Workspaces Navigation Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-display font-bold text-white">Interactive Research Workspaces</h3>
          <span className="text-xs font-mono text-text-muted">Select a laboratory to enter</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            to="/app/playground"
            className="p-6 rounded-2xl bg-obsidian hover:bg-surface-inset border border-white/10 hover:border-plasma-cyan/50 transition-all shadow-md group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-xl bg-plasma-cyan/10 text-plasma-cyan border border-plasma-cyan/20 group-hover:scale-105 transition-transform">
                <Sliders className="w-6 h-6" />
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/5 text-plasma-cyan">P0 Flagship</span>
            </div>
            <h4 className="text-lg font-display font-semibold text-white group-hover:text-plasma-cyan transition-colors">
              ML Algorithm Playground
            </h4>
            <p className="mt-2 text-xs text-text-muted leading-relaxed">
              Explore 2D decision boundaries. Draw points, modify noise, train Linear/Logistic Regression, and iterate K-Means centroids.
            </p>
            <div className="mt-5 flex items-center gap-1 text-xs text-plasma-cyan font-medium">
              <span>Open Canvas</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          <Link
            to="/app/studio"
            className="p-6 rounded-2xl bg-obsidian hover:bg-surface-inset border border-white/10 hover:border-neural-violet/50 transition-all shadow-md group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-xl bg-neural-violet/10 text-neural-violet border border-neural-violet/20 group-hover:scale-105 transition-transform">
                <Network className="w-6 h-6" />
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/5 text-neural-violet">P0 Flagship</span>
            </div>
            <h4 className="text-lg font-display font-semibold text-white group-hover:text-neural-violet transition-colors">
              Neural Network Studio
            </h4>
            <p className="mt-2 text-xs text-text-muted leading-relaxed">
              Visual layer builder and neuron inspector. Construct multi-layer networks, run real backpropagation, and inspect neuron activations.
            </p>
            <div className="mt-5 flex items-center gap-1 text-xs text-neural-violet font-medium">
              <span>Open Studio</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          <Link
            to="/app/arena"
            className="p-6 rounded-2xl bg-obsidian hover:bg-surface-inset border border-white/10 hover:border-quantum-mint/50 transition-all shadow-md group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-xl bg-quantum-mint/10 text-quantum-mint border border-quantum-mint/20 group-hover:scale-105 transition-transform">
                <Scale className="w-6 h-6" />
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/5 text-quantum-mint">P0 Flagship</span>
            </div>
            <h4 className="text-lg font-display font-semibold text-white group-hover:text-quantum-mint transition-colors">
              Experiment Arena
            </h4>
            <p className="mt-2 text-xs text-text-muted leading-relaxed">
              Benchmark models side-by-side. Compare training vs validation metrics, scrub synchronized epochs, and diagnose overfitting.
            </p>
            <div className="mt-5 flex items-center gap-1 text-xs text-quantum-mint font-medium">
              <span>Open Arena</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>
      </div>

      {/* Recent Experiments & Verified Runs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-display font-bold text-white">Recent Saved Experiments</h3>
            <span className="text-xs px-2 py-0.5 rounded bg-quantum-mint/15 text-quantum-mint font-mono">Reproducible</span>
          </div>
          <Link to="/app/experiments" className="text-xs text-plasma-cyan hover:underline flex items-center gap-1">
            <span>View all experiments</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="rounded-2xl border border-white/10 bg-obsidian overflow-hidden divide-y divide-white/5 shadow-sm">
          {!recentExperiments.length && <p className="p-5 text-sm text-slate-400">Your saved runs will appear here. Start an experiment in a lab above.</p>}
          {recentExperiments.map((exp) => (
            <Link
              key={exp.id}
              to={exp.path}
              className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="p-2.5 rounded-xl bg-surface-elevated text-plasma-cyan border border-white/5">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">{exp.title}</h4>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-text-muted font-mono">
                    <span>{exp.type}</span>
                    <span>•</span>
                    <span className="text-neural-violet">{exp.dataset}</span>
                    <span>•</span>
                    <span className="text-quantum-mint">{exp.metric}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-quantum-mint/10 text-quantum-mint border border-quantum-mint/20">
                  {exp.status}
                </span>
                <span className="text-xs text-text-muted">{exp.time}</span>
                <ArrowRight className="w-4 h-4 text-text-muted" />
              </div>
            </Link>
          ))}
        </div>
      </div>
      {new URLSearchParams(location.search).get('design')==='gallery'&&<Suspense fallback={<p role="status">Loading design reference…</p>}><DesignGallery/></Suspense>}
    </div>
  );
}
