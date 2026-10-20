import React, { useEffect, useState } from 'react';
import { fetchExperiments } from '../services/api';
import { Link } from 'react-router-dom';
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
  const { setCommandPaletteOpen } = useLabStore();

  const stats = [
    { label: 'Available Algorithms', value: '5 Real Models', change: 'Classical + Deep Learning', color: 'text-[#46D7F2]' },
    { label: 'Standard Datasets', value: '6 Presets', change: 'Moons, XOR, Spiral, Blobs...', color: 'text-[#A78BFA]' },
    { label: 'Evaluation Protocol', value: 'Train / Test Split', change: 'Generalization validation', color: 'text-[#3CD5AA]' },
    { label: 'Engine Runtime', value: 'TensorFlow.js', change: 'Browser GPU/WebGL Accelerated', color: 'text-[#F3B65E]' },
  ];

  const [recentExperiments,setRecentExperiments] = useState([]);
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
      {/* Welcome Banner / Challenge Callout */}
      <div className="relative rounded-2xl border border-white/10 bg-gradient-to-r from-[#151E30] via-[#151E30] to-[#202B43] p-6 sm:p-8 overflow-hidden shadow-xl">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-[#46D7F2]/10 to-transparent pointer-events-none" />
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#46D7F2]/15 text-[#46D7F2] text-xs font-mono mb-3 border border-[#46D7F2]/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Featured Interview Challenge</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
            The 90-Second Neural Network Challenge
          </h2>
          <p className="mt-2 text-sm text-[#9EACC4] leading-relaxed">
            Can a single perceptron solve the XOR problem? Experience first-hand how adding hidden representations enables non-linear decision boundaries.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link
              to="/showcase"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#46D7F2] to-[#3CD5AA] text-[#080D18] font-semibold text-xs shadow-glow-cyan hover:opacity-95 transition-all"
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
          <div key={idx} className="p-5 rounded-2xl bg-[#151E30]/60 border border-white/10 shadow-sm">
            <span className="text-xs font-mono text-[#9EACC4] uppercase tracking-wider">{s.label}</span>
            <div className={`mt-2 text-2xl font-display font-bold ${s.color}`}>
              {s.value}
            </div>
            <p className="mt-1 text-xs text-[#9EACC4] flex items-center gap-1 font-mono">
              {s.change}
            </p>
          </div>
        ))}
      </div>

      {/* Flagship Workspaces Navigation Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-display font-bold text-white">Interactive Research Workspaces</h3>
          <span className="text-xs font-mono text-[#9EACC4]">Select a laboratory to enter</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            to="/app/playground"
            className="p-6 rounded-2xl bg-[#151E30] hover:bg-[#1a253d] border border-white/10 hover:border-[#46D7F2]/50 transition-all shadow-md group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-xl bg-[#46D7F2]/10 text-[#46D7F2] border border-[#46D7F2]/20 group-hover:scale-105 transition-transform">
                <Sliders className="w-6 h-6" />
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/5 text-[#46D7F2]">P0 Flagship</span>
            </div>
            <h4 className="text-lg font-display font-semibold text-white group-hover:text-[#46D7F2] transition-colors">
              ML Algorithm Playground
            </h4>
            <p className="mt-2 text-xs text-[#9EACC4] leading-relaxed">
              Explore 2D decision boundaries. Draw points, modify noise, train Linear/Logistic Regression, and iterate K-Means centroids.
            </p>
            <div className="mt-5 flex items-center gap-1 text-xs text-[#46D7F2] font-medium">
              <span>Open Canvas</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          <Link
            to="/app/studio"
            className="p-6 rounded-2xl bg-[#151E30] hover:bg-[#1a253d] border border-white/10 hover:border-[#A78BFA]/50 transition-all shadow-md group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-xl bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/20 group-hover:scale-105 transition-transform">
                <Network className="w-6 h-6" />
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/5 text-[#A78BFA]">P0 Flagship</span>
            </div>
            <h4 className="text-lg font-display font-semibold text-white group-hover:text-[#A78BFA] transition-colors">
              Neural Network Studio
            </h4>
            <p className="mt-2 text-xs text-[#9EACC4] leading-relaxed">
              Visual layer builder and neuron inspector. Construct multi-layer networks, run real backpropagation, and inspect neuron activations.
            </p>
            <div className="mt-5 flex items-center gap-1 text-xs text-[#A78BFA] font-medium">
              <span>Open Studio</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          <Link
            to="/app/arena"
            className="p-6 rounded-2xl bg-[#151E30] hover:bg-[#1a253d] border border-white/10 hover:border-[#3CD5AA]/50 transition-all shadow-md group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-xl bg-[#3CD5AA]/10 text-[#3CD5AA] border border-[#3CD5AA]/20 group-hover:scale-105 transition-transform">
                <Scale className="w-6 h-6" />
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/5 text-[#3CD5AA]">P0 Flagship</span>
            </div>
            <h4 className="text-lg font-display font-semibold text-white group-hover:text-[#3CD5AA] transition-colors">
              Experiment Arena
            </h4>
            <p className="mt-2 text-xs text-[#9EACC4] leading-relaxed">
              Benchmark models side-by-side. Compare training vs validation metrics, scrub synchronized epochs, and diagnose overfitting.
            </p>
            <div className="mt-5 flex items-center gap-1 text-xs text-[#3CD5AA] font-medium">
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
            <span className="text-xs px-2 py-0.5 rounded bg-[#3CD5AA]/15 text-[#3CD5AA] font-mono">Reproducible</span>
          </div>
          <Link to="/app/experiments" className="text-xs text-[#46D7F2] hover:underline flex items-center gap-1">
            <span>View all experiments</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#151E30] overflow-hidden divide-y divide-white/5 shadow-sm">
          {!recentExperiments.length && <p className="p-5 text-sm text-slate-400">Your saved runs will appear here. Start an experiment in a lab above.</p>}
          {recentExperiments.map((exp) => (
            <Link
              key={exp.id}
              to={exp.path}
              className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="p-2.5 rounded-xl bg-[#202B43] text-[#46D7F2] border border-white/5">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">{exp.title}</h4>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-[#9EACC4] font-mono">
                    <span>{exp.type}</span>
                    <span>•</span>
                    <span className="text-[#A78BFA]">{exp.dataset}</span>
                    <span>•</span>
                    <span className="text-[#3CD5AA]">{exp.metric}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-[#3CD5AA]/10 text-[#3CD5AA] border border-[#3CD5AA]/20">
                  {exp.status}
                </span>
                <span className="text-xs text-[#9EACC4]">{exp.time}</span>
                <ArrowRight className="w-4 h-4 text-[#9EACC4]" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
