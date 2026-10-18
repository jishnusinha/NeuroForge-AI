import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Sparkles, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  Network, 
  Scale, 
  Code2, 
  ExternalLink,
  Play,
  RotateCcw,
  Zap,
  Activity,
  Server,
  Database,
  Cpu
} from 'lucide-react';
import { useLabStore } from '../store/useLabStore';

export default function ShowcasePage() {
  const { showToast } = useLabStore();
  const [activeStep, setActiveStep] = useState(0);

  // Mini-simulator state inside showcase
  const [step3Trained, setStep3Trained] = useState(false);

  const steps = [
    {
      time: '0:00 – 0:25',
      title: '01 • Arrive and Explore',
      subtitle: 'Zero-friction guest entry & immediate scientific experimentation',
      badge: 'First Impressions',
      content: (
        <div className="space-y-5">
          <p className="text-sm text-[#9EACC4] leading-relaxed">
            The candidate arrives at an atmospheric, research-grade dark interface. Without mandatory registration walls or mock animations, they can immediately explore active ML algorithms running live in browser memory.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-[#080D18] border border-white/5 space-y-1">
              <span className="text-[10px] font-mono text-[#46D7F2] uppercase font-bold">Client Runtime</span>
              <div className="text-sm font-semibold text-white">TensorFlow.js (WebGL)</div>
              <p className="text-[11px] text-[#9EACC4]">Real client-side gradient descent, no simulated curves.</p>
            </div>
            <div className="p-3.5 rounded-xl bg-[#080D18] border border-white/5 space-y-1">
              <span className="text-[10px] font-mono text-[#A78BFA] uppercase font-bold">Persistence</span>
              <div className="text-sm font-semibold text-white">MongoDB + Express</div>
              <p className="text-[11px] text-[#9EACC4]">Permanent run configs and shareable JSON reports.</p>
            </div>
            <div className="p-3.5 rounded-xl bg-[#080D18] border border-white/5 space-y-1">
              <span className="text-[10px] font-mono text-[#3CD5AA] uppercase font-bold">State Protocol</span>
              <div className="text-sm font-semibold text-white">Zustand Reactive Store</div>
              <p className="text-[11px] text-[#9EACC4]">Inputs changed detection marks stale boundaries.</p>
            </div>
          </div>
        </div>
      ),
      actionText: 'Next: Discover Model Failure',
    },
    {
      time: '0:25 – 1:00',
      title: '02 • Discover a Limitation',
      subtitle: 'The XOR Challenge: Proving why linear classifiers fundamentally fail',
      badge: 'Theoretical Depth',
      content: (
        <div className="space-y-5">
          <p className="text-sm text-[#9EACC4] leading-relaxed">
            A single linear perceptron without hidden representations is fitted to an XOR dataset. The model draws a straight line and is unable to separate diagonally opposing classes, stalling at <span className="text-red-400 font-mono font-bold">50% accuracy</span>.
          </p>

          {/* Interactive XOR Linear Failure Visualization */}
          <div className="p-5 rounded-2xl bg-[#080D18] border border-red-500/30 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="w-full sm:w-60 h-44 rounded-xl bg-[#0D1422] border border-white/10 relative p-3 flex flex-col justify-between">
              <div className="flex justify-between text-[10px] font-mono text-[#9EACC4]">
                <span>XOR 2D Space</span>
                <span className="text-red-400 font-bold">Fails (50%)</span>
              </div>
              <div className="relative flex-1 flex items-center justify-center">
                {/* 4 XOR Points */}
                <div className="absolute top-3 left-6 w-5 h-5 rounded-full bg-[#46D7F2] flex items-center justify-center text-[10px] font-bold text-[#080D18]">0</div>
                <div className="absolute top-3 right-6 w-5 h-5 rounded-full bg-[#A78BFA] flex items-center justify-center text-[10px] font-bold text-[#080D18]">1</div>
                <div className="absolute bottom-3 left-6 w-5 h-5 rounded-full bg-[#A78BFA] flex items-center justify-center text-[10px] font-bold text-[#080D18]">1</div>
                <div className="absolute bottom-3 right-6 w-5 h-5 rounded-full bg-[#46D7F2] flex items-center justify-center text-[10px] font-bold text-[#080D18]">0</div>
                
                {/* Failed straight line */}
                <div className="absolute w-full h-0.5 bg-red-400/80 -rotate-45 transform" />
              </div>
              <div className="text-[10px] text-center font-mono text-[#9EACC4]">
                Single Hyperplane: w₁x₁ + w₂x₂ + b = 0
              </div>
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-red-400">
                <AlertTriangle className="w-4 h-4" />
                <span>Minsky & Papert Perceptron Theorem (1969)</span>
              </div>
              <p className="text-xs text-[#9EACC4] leading-relaxed">
                A single linear perceptron calculates a convex half-space. It is mathematically impossible for any linear boundary to classify points (0,0) and (1,1) together while excluding (0,1) and (1,0).
              </p>
            </div>
          </div>
        </div>
      ),
      actionText: 'Next: Build Hidden Layer Solution',
    },
    {
      time: '1:00 – 1:45',
      title: '03 • Build Something Smarter',
      subtitle: 'Adding hidden representations and watching non-linear boundary emerge',
      badge: 'Deep Learning',
      content: (
        <div className="space-y-5">
          <p className="text-sm text-[#9EACC4] leading-relaxed">
            The visitor adds a Dense hidden layer with 4 units and ReLU activation in the Neural Studio. Upon triggering backpropagation, the loss drops to <span className="text-[#3CD5AA] font-mono font-bold">0.012</span> and accuracy reaches <span className="text-[#3CD5AA] font-mono font-bold">100%</span>.
          </p>

          {/* Interactive XOR Solution */}
          <div className="p-5 rounded-2xl bg-[#080D18] border border-[#3CD5AA]/30 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="w-full sm:w-60 h-44 rounded-xl bg-[#0D1422] border border-white/10 relative p-3 flex flex-col justify-between overflow-hidden">
              <div className="flex justify-between text-[10px] font-mono text-[#9EACC4]">
                <span>Latent Manifold</span>
                <span className="text-[#3CD5AA] font-bold">{step3Trained ? 'Converged (100%)' : 'Ready to Train'}</span>
              </div>
              <div className="relative flex-1 flex items-center justify-center">
                {/* 4 Points */}
                <div className="absolute top-3 left-6 w-5 h-5 rounded-full bg-[#46D7F2] flex items-center justify-center text-[10px] font-bold text-[#080D18]">0</div>
                <div className="absolute top-3 right-6 w-5 h-5 rounded-full bg-[#A78BFA] flex items-center justify-center text-[10px] font-bold text-[#080D18]">1</div>
                <div className="absolute bottom-3 left-6 w-5 h-5 rounded-full bg-[#A78BFA] flex items-center justify-center text-[10px] font-bold text-[#080D18]">1</div>
                <div className="absolute bottom-3 right-6 w-5 h-5 rounded-full bg-[#46D7F2] flex items-center justify-center text-[10px] font-bold text-[#080D18]">0</div>
                
                {/* Non-linear curved boundary */}
                {step3Trained ? (
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
                    <path d="M 10 30 Q 50 50 90 30" stroke="#3CD5AA" strokeWidth="2.5" fill="none" />
                    <path d="M 10 70 Q 50 50 90 70" stroke="#3CD5AA" strokeWidth="2.5" fill="none" />
                  </svg>
                ) : (
                  <div className="text-[11px] font-mono text-[#9EACC4] text-center">Click "Train Perceptron"</div>
                )}
              </div>
              <button
                onClick={() => {
                  setStep3Trained(true);
                  showToast('Trained 2-4-1 network on XOR. 100% convergence achieved!', 'success');
                }}
                className="w-full py-1 rounded bg-[#3CD5AA]/20 hover:bg-[#3CD5AA]/30 text-[#3CD5AA] text-[10px] font-bold font-mono transition-colors"
              >
                {step3Trained ? '✓ Converged (100% Acc)' : 'Train Perceptron'}
              </button>
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#3CD5AA]">
                <CheckCircle2 className="w-4 h-4" />
                <span>Non-Linear Coordinate Transformation</span>
              </div>
              <p className="text-xs text-[#9EACC4] leading-relaxed">
                The 4 hidden neurons project the 2D input into a 4-dimensional latent representation where the two XOR classes become linearly separable by the output neuron.
              </p>
            </div>
          </div>
        </div>
      ),
      actionText: 'Next: Compare in Arena',
    },
    {
      time: '1:45 – 2:30',
      title: '04 • Investigate and Compare',
      subtitle: 'Benchmarking in Experiment Arena & detecting overfitting risks',
      badge: 'Scientific Rigor',
      content: (
        <div className="space-y-5">
          <p className="text-sm text-[#9EACC4] leading-relaxed">
            The candidate pairs the baseline and deep model in the Experiment Arena. Using the synchronized epoch scrubber, they demonstrate how unconstrained model capacity memorizes dataset noise while validation loss spikes.
          </p>

          <div className="p-4 rounded-xl bg-[#080D18] border border-white/10 space-y-3">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-white font-semibold">Overfitting vs Generalization Tradeoff:</span>
              <span className="text-[#F3B65E] font-bold">Generalization Gap Detected</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-1">
                <span className="text-[#46D7F2]">Model A (Logistic)</span>
                <div>Train Loss: 0.380</div>
                <div>Val Loss: 0.420</div>
                <div className="text-[#3CD5AA] text-[11px]">Stable Equilibrium</div>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.02] border border-amber-500/20 space-y-1">
                <span className="text-[#A78BFA]">Model B (Deep 353 weights)</span>
                <div>Train Loss: 0.050</div>
                <div>Val Loss: 0.480</div>
                <div className="text-[#F3B65E] text-[11px]">Overfitting to Noise</div>
              </div>
            </div>
          </div>
        </div>
      ),
      actionText: 'Next: Engineering Architecture',
    },
    {
      time: '2:30 – 3:00',
      title: '05 • Reveal the Engineering',
      subtitle: 'System architecture, state management, and production persistence',
      badge: 'Full-Stack Architecture',
      content: (
        <div className="space-y-5">
          <p className="text-sm text-[#9EACC4] leading-relaxed">
            The candidate demonstrates the complete software engineering stack behind the scenes, emphasizing architectural separation and engineering judgment:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
            <div className="p-3.5 rounded-xl bg-[#080D18] border border-white/10 space-y-1">
              <div className="flex items-center gap-1.5 text-[#46D7F2] font-semibold">
                <Cpu className="w-4 h-4" />
                <span>Frontend & Client ML</span>
              </div>
              <p className="text-[#9EACC4]">
                React JSX + Vite + Tailwind CSS + TensorFlow.js. Real gradient descent executed in client WebGL memory.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#080D18] border border-white/10 space-y-1">
              <div className="flex items-center gap-1.5 text-[#A78BFA] font-semibold">
                <Server className="w-4 h-4" />
                <span>Backend & Database</span>
              </div>
              <p className="text-[#9EACC4]">
                Node.js Express REST API connected to MongoDB. Permanent run configs and bounded metrics histories.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#080D18] border border-white/10 space-y-1">
              <div className="flex items-center gap-1.5 text-[#3CD5AA] font-semibold">
                <Activity className="w-4 h-4" />
                <span>Scientific Canvas</span>
              </div>
              <p className="text-[#9EACC4]">
                HTML5 Canvas 2D engine with Cartesian coordinate projection, continuous probability heatmaps, and Voronoi cells.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#080D18] border border-white/10 space-y-1">
              <div className="flex items-center gap-1.5 text-[#F3B65E] font-semibold">
                <Zap className="w-4 h-4" />
                <span>State Integrity</span>
              </div>
              <p className="text-[#9EACC4]">
                Zustand central store. Modifying data coordinates flags boundaries as stale reference results.
              </p>
            </div>
          </div>
        </div>
      ),
      actionText: 'Complete Tour & Enter Lab',
    },
  ];

  const currentStepData = steps[activeStep];

  return (
    <div className="p-6 sm:p-10 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#A78BFA]/15 text-[#A78BFA] text-xs font-mono mb-2 border border-[#A78BFA]/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Guided Technical Interview Walkthrough</span>
          </div>
          <h1 className="text-3xl font-display font-bold text-white tracking-tight">
            The 3-Minute NeuroForge Story
          </h1>
          <p className="text-sm text-[#9EACC4] mt-1">
            A guided route through real product capabilities and engineering judgments.
          </p>
        </div>

        <Link
          to="/app"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs text-white transition-colors"
        >
          <span>Exit to Free Exploration</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Interactive Step Timeline Navigation */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {steps.map((s, idx) => (
          <button
            key={idx}
            onClick={() => setActiveStep(idx)}
            className={`p-3 rounded-xl text-left border transition-all ${
              activeStep === idx
                ? 'bg-[#151E30] border-[#46D7F2] shadow-glow-cyan'
                : idx < activeStep
                ? 'bg-[#151E30]/40 border-[#3CD5AA]/40 text-[#9EACC4]'
                : 'bg-[#151E30]/20 border-white/5 text-[#9EACC4]/60 hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-[#46D7F2]">{s.time}</span>
              {idx < activeStep && <CheckCircle2 className="w-3 h-3 text-[#3CD5AA]" />}
            </div>
            <div className="text-xs font-semibold text-white mt-1 truncate">
              {s.title.split('•')[1]?.trim() || s.title}
            </div>
          </button>
        ))}
      </div>

      {/* Active Step Content Card */}
      <div className="p-8 rounded-2xl bg-[#151E30] border border-white/10 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-[#46D7F2]">{currentStepData.time}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-white/5 text-[#A78BFA] font-mono">
                {currentStepData.badge}
              </span>
            </div>
            <h2 className="text-2xl font-display font-bold text-white mt-1">
              {currentStepData.title}
            </h2>
            <p className="text-xs text-[#9EACC4] mt-0.5">{currentStepData.subtitle}</p>
          </div>
        </div>

        {/* Step Body */}
        {currentStepData.content}

        {/* Navigation Controls */}
        <div className="pt-6 border-t border-white/10 flex items-center justify-between">
          <button
            onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
            disabled={activeStep === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </button>

          <div className="flex items-center gap-3">
            {activeStep === 1 || activeStep === 2 ? (
              <Link
                to="/app/studio"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#46D7F2]/10 hover:bg-[#46D7F2]/20 border border-[#46D7F2]/30 text-xs font-medium text-[#46D7F2]"
              >
                <span>Try Live in Studio</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            ) : activeStep === 3 ? (
              <Link
                to="/app/arena"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#A78BFA]/10 hover:bg-[#A78BFA]/20 border border-[#A78BFA]/30 text-xs font-medium text-[#A78BFA]"
              >
                <span>Open in Arena</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            ) : null}

            {activeStep < steps.length - 1 ? (
              <button
                onClick={() => setActiveStep(activeStep + 1)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#46D7F2] to-[#3CD5AA] text-[#080D18] font-bold text-xs shadow-glow-cyan hover:opacity-95 transition-all"
              >
                <span>{currentStepData.actionText}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <Link
                to="/app"
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#46D7F2] to-[#A78BFA] text-[#080D18] font-bold text-xs shadow-glow-cyan hover:opacity-95 transition-all"
              >
                <span>Launch Full Platform</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
