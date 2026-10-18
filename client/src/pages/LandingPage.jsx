import React, { useRef, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Sliders, 
  Network, 
  Scale, 
  Sparkles, 
  ArrowRight, 
  Layers, 
  BrainCircuit, 
  Cpu, 
  CheckCircle2, 
  Code2, 
  Terminal,
  Activity,
  Zap,
  Info
} from 'lucide-react';
import { useLabStore } from '../store/useLabStore';

export default function LandingPage() {
  const { setCommandPaletteOpen } = useLabStore();
  const canvasRef = useRef(null);
  const [activeNodeInfo, setActiveNodeInfo] = useState(null);

  // Ambient Interactive Neural Network Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    let width = (canvas.width = canvas.parentElement.clientWidth);
    let height = (canvas.height = canvas.parentElement.clientHeight || 460);

    const handleResize = () => {
      if (!canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight || 460;
    };
    window.addEventListener('resize', handleResize);

    // Nodes in layers
    const layers = [3, 5, 5, 2];
    const nodes = [];
    const layerSpacing = width / (layers.length + 1);

    layers.forEach((count, layerIdx) => {
      const x = (layerIdx + 1) * layerSpacing;
      const ySpacing = height / (count + 1);
      for (let i = 0; i < count; i++) {
        nodes.push({
          id: `${layerIdx}-${i}`,
          layer: layerIdx,
          index: i,
          x,
          y: (i + 1) * ySpacing,
          radius: 8,
          baseRadius: 8,
          activation: Math.random(),
          pulse: Math.random() * Math.PI,
          bias: (Math.random() * 2 - 1).toFixed(2),
          weight: (Math.random() * 2 - 1).toFixed(2),
        });
      }
    });

    let mouseX = -1000;
    let mouseY = -1000;

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
    };

    canvas.addEventListener('mousemove', handleMouseMove);

    // Render loop
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw Connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = 0; j < nodes.length; j++) {
          if (nodes[j].layer === nodes[i].layer + 1) {
            const dx = nodes[j].x - nodes[i].x;
            const dy = nodes[j].y - nodes[i].y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Check mouse proximity to line
            const midX = (nodes[i].x + nodes[j].x) / 2;
            const midY = (nodes[i].y + nodes[j].y) / 2;
            const mouseDist = Math.hypot(mouseX - midX, mouseY - midY);

            const isHovered = mouseDist < 60;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);

            if (isHovered) {
              ctx.strokeStyle = '#46D7F2';
              ctx.lineWidth = 2.5;
            } else {
              ctx.strokeStyle = 'rgba(167, 139, 250, 0.18)';
              ctx.lineWidth = 1;
            }
            ctx.stroke();
          }
        }
      }

      // Draw Nodes
      nodes.forEach((node) => {
        node.pulse += 0.03;
        const pulseEffect = Math.sin(node.pulse) * 1.5;

        const distToMouse = Math.hypot(mouseX - node.x, mouseY - node.y);
        const isHovered = distToMouse < 25;

        ctx.beginPath();
        ctx.arc(node.x, node.y, node.baseRadius + pulseEffect + (isHovered ? 4 : 0), 0, Math.PI * 2);

        if (isHovered) {
          ctx.fillStyle = '#46D7F2';
          ctx.shadowColor = '#46D7F2';
          ctx.shadowBlur = 15;
        } else if (node.layer === 0) {
          ctx.fillStyle = '#46D7F2';
          ctx.shadowColor = '#46D7F2';
          ctx.shadowBlur = 8;
        } else if (node.layer === layers.length - 1) {
          ctx.fillStyle = '#3CD5AA';
          ctx.shadowColor = '#3CD5AA';
          ctx.shadowBlur = 8;
        } else {
          ctx.fillStyle = '#A78BFA';
          ctx.shadowColor = '#A78BFA';
          ctx.shadowBlur = 8;
        }

        ctx.fill();
        ctx.shadowBlur = 0; // reset
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    const handleClick = () => {
      // Find closest node to mouse
      let closest = null;
      let minDist = 30;
      nodes.forEach((node) => {
        const d = Math.hypot(mouseX - node.x, mouseY - node.y);
        if (d < minDist) {
          minDist = d;
          closest = node;
        }
      });
      if (closest) {
        setActiveNodeInfo({
          layer: closest.layer === 0 ? 'Input' : closest.layer === 3 ? 'Output' : `Hidden L${closest.layer}`,
          neuron: `Neuron #${closest.index + 1}`,
          activation: closest.activation.toFixed(4),
          bias: closest.bias,
          weight: closest.weight,
        });
      }
    };

    canvas.addEventListener('click', handleClick);

    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleClick);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-[#080D18] text-[#F2F5FC] overflow-x-hidden">
      {/* Top Navigation */}
      <header className="h-16 border-b border-white/10 px-6 sm:px-12 flex items-center justify-between sticky top-0 z-40 bg-[#080D18]/80 backdrop-blur-md">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#46D7F2]/20 to-[#A78BFA]/30 border border-[#46D7F2]/40 flex items-center justify-center font-display font-bold text-lg text-[#46D7F2] shadow-glow-cyan">
            N
          </div>
          <span className="font-display font-bold tracking-tight text-lg text-white">
            NeuroForge <span className="text-[#46D7F2] font-mono text-xs">AI</span>
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs text-[#9EACC4] transition-colors"
          >
            <Terminal className="w-3.5 h-3.5 text-[#46D7F2]" />
            <span>Search or command</span>
            <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] text-white">Ctrl+K</kbd>
          </button>

          <Link
            to="/showcase"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#A78BFA]/10 hover:bg-[#A78BFA]/20 border border-[#A78BFA]/30 text-xs font-medium text-[#A78BFA] transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Showcase Tour</span>
          </Link>

          <Link
            to="/app"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#46D7F2] to-[#A78BFA] text-[#080D18] text-xs font-semibold hover:opacity-95 shadow-glow-cyan transition-all"
          >
            <span>Launch Lab</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative px-6 pt-16 pb-20 sm:pt-24 sm:pb-28 max-w-7xl mx-auto flex flex-col items-center text-center">
        {/* Glow ambient background */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-[#46D7F2]/10 rounded-full blur-[120px] pointer-events-none" />

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/10 text-xs font-mono text-[#46D7F2] mb-6">
          <Activity className="w-3.5 h-3.5 text-[#3CD5AA]" />
          <span>Interactive Machine Learning & Deep Learning Universe</span>
        </div>

        {/* Main Headline */}
        <h1 className="font-display font-extrabold text-4xl sm:text-6xl md:text-7xl tracking-tight max-w-4xl text-white">
          See how <span className="bg-gradient-to-r from-[#46D7F2] via-[#A78BFA] to-[#3CD5AA] bg-clip-text text-transparent">intelligence</span> learns.
        </h1>

        <p className="mt-6 text-base sm:text-lg md:text-xl text-[#9EACC4] max-w-2xl font-normal leading-relaxed">
          An interactive laboratory for exploring the mathematics, models, and mysteries of machine learning.
          Manipulate raw data, build neural architectures, watch real backpropagation, and evaluate empirical evidence.
        </p>

        {/* Action CTAs */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/app"
            className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#46D7F2] to-[#3CD5AA] text-[#080D18] font-semibold text-sm shadow-glow-cyan hover:scale-[1.02] transition-transform"
          >
            <Zap className="w-4 h-4 fill-current" />
            <span>Launch Interactive Lab</span>
          </Link>

          <Link
            to="/app/learn"
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-white font-medium text-sm transition-colors"
          >
            <span>Explore Learning Paths</span>
          </Link>
        </div>

        <p className="mt-3 text-xs text-[#9EACC4]/70 font-mono">
          ✓ Real browser-based ML computation • No login required for instant guest experimentation
        </p>

        {/* Interactive Neural Canvas Hero Frame */}
        <div className="mt-14 w-full max-w-5xl relative rounded-2xl border border-white/10 bg-[#0D1422]/90 shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#151E30]/70 text-xs font-mono text-[#9EACC4]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
              <span className="ml-2 text-white font-medium">live_network_visualization.tfjs</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[#3CD5AA] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3CD5AA] animate-pulse" />
                Forward-Pass Active
              </span>
              <span>Click any node to inspect math</span>
            </div>
          </div>

          <div className="relative h-[360px] sm:h-[420px] w-full">
            <canvas ref={canvasRef} className="w-full h-full cursor-crosshair" />

            {/* Floating Node Inspector Modal if clicked */}
            {activeNodeInfo && (
              <div className="absolute top-4 right-4 z-20 w-64 bg-[#151E30]/95 backdrop-blur-md border border-[#46D7F2]/40 rounded-xl p-4 shadow-xl text-left animate-in fade-in duration-150">
                <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
                  <span className="font-mono text-xs text-[#46D7F2] font-semibold">{activeNodeInfo.layer}</span>
                  <button 
                    onClick={() => setActiveNodeInfo(null)}
                    className="text-xs text-[#9EACC4] hover:text-white"
                  >
                    ✕
                  </button>
                </div>
                <div className="text-xs space-y-1.5 font-mono text-[#F2F5FC]">
                  <div><span className="text-[#9EACC4]">Identifier:</span> {activeNodeInfo.neuron}</div>
                  <div><span className="text-[#9EACC4]">Activation (a):</span> <span className="text-[#3CD5AA]">{activeNodeInfo.activation}</span></div>
                  <div><span className="text-[#9EACC4]">Learned Bias (b):</span> {activeNodeInfo.bias}</div>
                  <div><span className="text-[#9EACC4]">Weight (w_avg):</span> {activeNodeInfo.weight}</div>
                </div>
                <div className="mt-3 pt-2 border-t border-white/10 text-[11px] text-[#9EACC4]">
                  Formula: <code className="text-[#A78BFA]">a = ReLU(Σ w_i·x_i + b)</code>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Three Major Workspaces Overview */}
      <section className="px-6 py-20 max-w-7xl mx-auto border-t border-white/5">
        <div className="text-center mb-14">
          <span className="text-xs font-mono uppercase tracking-widest text-[#46D7F2]">Architecture & Modules</span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-display font-bold text-white">
            Three Core Laboratories. One Seamless Platform.
          </h2>
          <p className="mt-3 text-[#9EACC4] max-w-xl mx-auto text-sm">
            Move between classical algorithms, deep learning architecture, and empirical model arena without losing your dataset state.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Playground */}
          <Link
            to="/app/playground"
            className="group p-6 rounded-2xl bg-[#151E30]/60 hover:bg-[#151E30] border border-white/10 hover:border-[#46D7F2]/50 transition-all shadow-lg flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-[#46D7F2]/10 border border-[#46D7F2]/30 flex items-center justify-center text-[#46D7F2] mb-5 group-hover:scale-110 transition-transform">
                <Sliders className="w-6 h-6" />
              </div>
              <span className="text-xs font-mono text-[#46D7F2]">01 — Flagship</span>
              <h3 className="text-xl font-display font-semibold text-white mt-1 group-hover:text-[#46D7F2] transition-colors">
                ML Algorithm Playground
              </h3>
              <p className="mt-2 text-sm text-[#9EACC4] leading-relaxed">
                Draw custom 2D data points, add Gaussian noise, and test Linear/Logistic regression, K-Means clustering, and KNN in real time.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-1.5 text-xs font-medium text-[#46D7F2]">
              <span>Open Playground</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 2: Neural Studio */}
          <Link
            to="/app/studio"
            className="group p-6 rounded-2xl bg-[#151E30]/60 hover:bg-[#151E30] border border-white/10 hover:border-[#A78BFA]/50 transition-all shadow-lg flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-[#A78BFA]/10 border border-[#A78BFA]/30 flex items-center justify-center text-[#A78BFA] mb-5 group-hover:scale-110 transition-transform">
                <Network className="w-6 h-6" />
              </div>
              <span className="text-xs font-mono text-[#A78BFA]">02 — Flagship</span>
              <h3 className="text-xl font-display font-semibold text-white mt-1 group-hover:text-[#A78BFA] transition-colors">
                Neural Network Studio
              </h3>
              <p className="mt-2 text-sm text-[#9EACC4] leading-relaxed">
                Visually construct dense sequential networks. Switch between high-level layer topology and deep neuron-level forward/backward passes.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-1.5 text-xs font-medium text-[#A78BFA]">
              <span>Open Studio</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 3: Arena */}
          <Link
            to="/app/arena"
            className="group p-6 rounded-2xl bg-[#151E30]/60 hover:bg-[#151E30] border border-white/10 hover:border-[#3CD5AA]/50 transition-all shadow-lg flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-[#3CD5AA]/10 border border-[#3CD5AA]/30 flex items-center justify-center text-[#3CD5AA] mb-5 group-hover:scale-110 transition-transform">
                <Scale className="w-6 h-6" />
              </div>
              <span className="text-xs font-mono text-[#3CD5AA]">03 — Flagship</span>
              <h3 className="text-xl font-display font-semibold text-white mt-1 group-hover:text-[#3CD5AA] transition-colors">
                Experiment Arena
              </h3>
              <p className="mt-2 text-sm text-[#9EACC4] leading-relaxed">
                Benchmark candidate runs head-to-head. Synchronize epoch scrubber playback and discover why one model overfits while another generalizes.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-1.5 text-xs font-medium text-[#3CD5AA]">
              <span>Enter Arena</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>
      </section>

      {/* Signature XOR Highlight Section */}
      <section className="px-6 py-16 max-w-5xl mx-auto my-12 rounded-3xl border border-white/10 bg-gradient-to-b from-[#151E30] to-[#0D1422] p-8 sm:p-12">
        <div className="flex flex-col md:flex-row items-center gap-8 justify-between">
          <div className="max-w-md">
            <span className="text-xs font-mono uppercase tracking-widest text-[#F3B65E]">The Signature Experience</span>
            <h3 className="mt-2 text-2xl sm:text-3xl font-display font-bold text-white">
              Why does a neural network need hidden layers?
            </h3>
            <p className="mt-3 text-sm text-[#9EACC4] leading-relaxed">
              Start with an XOR dataset. Watch a standard linear model fail to classify diagonally opposite points.
              Add a single hidden layer, retrain, and see the decision boundary transform into a non-linear hyper-surface.
            </p>
            <div className="mt-6">
              <Link
                to="/showcase"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#F3B65E] to-[#A78BFA] text-[#080D18] text-xs font-bold hover:opacity-90 shadow-md transition-all"
              >
                <span>Launch 90-Second Walkthrough</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Graphical XOR Illustration */}
          <div className="w-full md:w-64 h-64 rounded-2xl bg-[#080D18] border border-white/10 relative p-4 flex flex-col justify-between">
            <div className="flex justify-between items-center text-[10px] font-mono text-[#9EACC4]">
              <span>XOR Decision Space</span>
              <span className="text-[#F3B65E]">Linear Separator: Fails</span>
            </div>
            <div className="relative w-full h-40">
              {/* Points */}
              <div className="absolute top-4 left-6 w-5 h-5 rounded-full bg-[#46D7F2] border-2 border-white/30 flex items-center justify-center text-[9px] font-bold text-[#080D18]">0</div>
              <div className="absolute top-4 right-6 w-5 h-5 rounded-full bg-[#A78BFA] border-2 border-white/30 flex items-center justify-center text-[9px] font-bold text-[#080D18]">1</div>
              <div className="absolute bottom-4 left-6 w-5 h-5 rounded-full bg-[#A78BFA] border-2 border-white/30 flex items-center justify-center text-[9px] font-bold text-[#080D18]">1</div>
              <div className="absolute bottom-4 right-6 w-5 h-5 rounded-full bg-[#46D7F2] border-2 border-white/30 flex items-center justify-center text-[9px] font-bold text-[#080D18]">0</div>
              
              {/* Failed straight line */}
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-400/80 -rotate-45 transform origin-center shadow-sm" />
            </div>
            <div className="text-[10px] text-center font-mono text-[#9EACC4]">
              Accuracy: 50% (Random guess)
            </div>
          </div>
        </div>
      </section>

      {/* Engineering Behind the Lab */}
      <section className="px-6 py-16 max-w-7xl mx-auto border-t border-white/5">
        <div className="max-w-2xl mb-12">
          <span className="text-xs font-mono uppercase tracking-widest text-[#46D7F2]">Technical Architecture</span>
          <h2 className="mt-2 text-2xl sm:text-3xl font-display font-bold text-white">
            Engineered for Deep Interview Technical Discussions
          </h2>
          <p className="mt-2 text-sm text-[#9EACC4]">
            Every screen demonstrates deliberate architectural choices rather than naive frontend mocks.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-5 rounded-xl bg-[#151E30]/40 border border-white/10">
            <Code2 className="w-5 h-5 text-[#46D7F2] mb-3" />
            <h4 className="text-sm font-semibold text-white">True Client-Side ML</h4>
            <p className="mt-1 text-xs text-[#9EACC4] leading-relaxed">
              TensorFlow.js executes real gradient descent in the browser with tensor lifecycle management and Web Workers.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-[#151E30]/40 border border-white/10">
            <BrainCircuit className="w-5 h-5 text-[#A78BFA] mb-3" />
            <h4 className="text-sm font-semibold text-white">Mathematical Transparency</h4>
            <p className="mt-1 text-xs text-[#9EACC4] leading-relaxed">
              Explicit neuron formulas for forward-propagation and real loss landscapes instead of canned animations.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-[#151E30]/40 border border-white/10">
            <CheckCircle2 className="w-5 h-5 text-[#3CD5AA] mb-3" />
            <h4 className="text-sm font-semibold text-white">Empirical Comparability</h4>
            <p className="mt-1 text-xs text-[#9EACC4] leading-relaxed">
              Fair comparison guards prevent misleading cross-dataset conclusions and clearly separates train vs. val loss.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-[#151E30]/40 border border-white/10">
            <Layers className="w-5 h-5 text-[#F3B65E] mb-3" />
            <h4 className="text-sm font-semibold text-white">Full-Stack Persistence</h4>
            <p className="mt-1 text-xs text-[#9EACC4] leading-relaxed">
              Express REST API and MongoDB schema store immutable experiment runs, hyperparameters, and bounded metrics.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 px-6 text-center text-xs text-[#9EACC4] font-mono">
        <p>NeuroForge AI • Interactive Intelligence Laboratory • Built with React, Tailwind, and TensorFlow.js</p>
      </footer>
    </div>
  );
}
