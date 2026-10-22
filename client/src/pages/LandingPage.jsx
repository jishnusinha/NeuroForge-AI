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
  CheckCircle2, 
  Code2, 
  Terminal,
  Activity,
  Zap,
} from 'lucide-react';
import { useLabStore } from '../store/useLabStore';
import CommandPalette from '../components/CommandPalette';
import Toast from '../components/Toast';

export default function LandingPage() {
  const { setCommandPaletteOpen } = useLabStore();
  const canvasRef = useRef(null);
  const exampleButtonRef = useRef(null);
  const [activeNodeInfo, setActiveNodeInfo] = useState(null);

  // Ambient Interactive Neural Network Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let inViewport=true;
    const visible=()=>inViewport&&!document.hidden;
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');

    let width = (canvas.width = canvas.parentElement.clientWidth);
    let height = (canvas.height = canvas.parentElement.clientHeight || 460);

    const handleResize = () => {
      if (!canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight || 460;
      nodes.forEach(node => {
        node.x = (node.layer + 1) * width / (layers.length + 1);
        node.y = (node.index + 1) * height / (layers[node.layer] + 1);
      });
      if (motionPreference.matches) render();
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
        const example = salt => (((layerIdx + 1) * 11 + (i + 1) * 7 + salt) % 31) / 30;
        nodes.push({
          id: `${layerIdx}-${i}`,
          layer: layerIdx,
          index: i,
          x,
          y: (i + 1) * ySpacing,
          radius: 8,
          baseRadius: 8,
          activation: example(0),
          pulse: example(5) * Math.PI,
          bias: (example(9) * 2 - 1).toFixed(2),
          weight: (example(13) * 2 - 1).toFixed(2),
        });
      }
    });

    let mouseX = -1000;
    let mouseY = -1000;

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
      if (motionPreference.matches) render();
    };

    canvas.addEventListener('mousemove', handleMouseMove);

    // Render loop
    const render = () => {
      if(!visible())return;
      ctx.clearRect(0, 0, width, height);

      // Draw Connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = 0; j < nodes.length; j++) {
          if (nodes[j].layer === nodes[i].layer + 1) {

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
        if (!motionPreference.matches) node.pulse += 0.03;
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

      if (!motionPreference.matches) animationFrameId = requestAnimationFrame(render);
    };

    render();
    const handleMotionChange = () => { cancelAnimationFrame(animationFrameId); render(); };
    motionPreference.addEventListener('change', handleMotionChange);
    const visibilityChange=()=>{cancelAnimationFrame(animationFrameId);render();};
    document.addEventListener('visibilitychange',visibilityChange);
    const observer=new IntersectionObserver(entries=>{inViewport=entries[0].isIntersecting;visibilityChange();});observer.observe(canvas);

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
      motionPreference.removeEventListener('change', handleMotionChange);
      observer.disconnect();document.removeEventListener('visibilitychange',visibilityChange);
    };
  }, []);

  return (
    <div className="prism-public relative min-h-screen bg-deep-space text-text-primary overflow-x-hidden">
      <CommandPalette />
      <Toast />
      {/* Top Navigation */}
      <header className="h-16 border-b border-white/10 px-6 sm:px-12 flex items-center justify-between sticky top-0 z-40 bg-deep-space/80 backdrop-blur-md">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-plasma-cyan/20 to-neural-violet/30 border border-plasma-cyan/40 flex items-center justify-center font-display font-bold text-lg text-plasma-cyan shadow-glow-cyan">
            N
          </div>
          <span className="font-display font-bold tracking-tight text-lg text-white">
            NeuroForge <span className="text-plasma-cyan font-mono text-xs">AI</span>
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs text-text-muted transition-colors"
          >
            <Terminal className="w-3.5 h-3.5 text-plasma-cyan" />
            <span>Search or command</span>
            <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] text-white">Ctrl+K</kbd>
          </button>

          <Link
            to="/showcase"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-neural-violet/10 hover:bg-neural-violet/20 border border-neural-violet/30 text-xs font-medium text-neural-violet transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Showcase Tour</span>
          </Link>

          <Link
            to="/app"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-plasma-cyan to-neural-violet text-ink-on-accent text-xs font-semibold hover:opacity-95 shadow-glow-cyan transition-all"
          >
            <span>Launch Lab</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative px-6 pt-16 pb-20 sm:pt-24 sm:pb-28 max-w-7xl mx-auto flex flex-col items-center text-center">
        {/* Glow ambient background */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-plasma-cyan/10 rounded-full blur-[120px] pointer-events-none" />

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/10 text-xs font-mono text-plasma-cyan mb-6">
          <Activity className="w-3.5 h-3.5 text-quantum-mint" />
          <span>PRISM · Scientific learning and research</span>
        </div>

        {/* Main Headline */}
        <h1 className="font-display font-extrabold text-4xl sm:text-6xl md:text-7xl tracking-tight max-w-4xl text-white">
          See how <span className="text-plasma-cyan">intelligence</span> learns.
        </h1>

        <p className="mt-6 text-base sm:text-lg md:text-xl text-text-muted max-w-2xl font-normal leading-relaxed">
          An interactive laboratory for exploring the mathematics, models, and mysteries of machine learning.
          Manipulate raw data, build neural architectures, watch real backpropagation, and evaluate empirical evidence.
        </p>

        {/* Action CTAs */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/app"
            className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-plasma-cyan to-quantum-mint text-ink-on-accent font-semibold text-sm shadow-glow-cyan hover:scale-[1.02] transition-transform"
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

        <p className="mt-3 text-xs text-text-muted/70 font-mono">
          ✓ Real browser-based ML computation • No login required for instant guest experimentation
        </p>
        <div className="prism-public-proof" aria-label="Product capabilities"><span>Explore & prepare data</span><span>Inspect fitted models</span><span>Compare recorded evidence</span><span>Export plots, data & code</span></div>

        {/* Interactive Neural Canvas Hero Frame */}
        <div className="mt-14 w-full max-w-5xl relative rounded-2xl border border-white/10 bg-surface-dark/90 shadow-2xl overflow-hidden">
          <div className="flex flex-wrap gap-3 items-center justify-between px-4 py-3 border-b border-white/10 bg-obsidian/70 text-xs font-mono text-text-muted">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
              <span className="ml-2 text-white font-medium">network_concept.preview</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-quantum-mint flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-quantum-mint animate-pulse" />
                Illustrative network
              </span>
              <button ref={exampleButtonRef} type="button" className="underline p-2" onClick={()=>setActiveNodeInfo({layer:'Example hidden layer',neuron:'Illustration node',activation:'0.5000',bias:'0.10',weight:'0.20'})}>Inspect example values</button>
            </div>
          </div>

          <div className="relative h-[360px] sm:h-[420px] w-full">
            <canvas ref={canvasRef} aria-hidden="true" className="w-full h-full cursor-crosshair" />

            {/* Floating Node Inspector Modal if clicked */}
            {activeNodeInfo && (
              <div className="absolute top-4 right-4 z-20 w-64 bg-obsidian/95 backdrop-blur-md border border-plasma-cyan/40 rounded-xl p-4 shadow-xl text-left animate-in fade-in duration-150">
                <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
                  <span className="font-mono text-xs text-plasma-cyan font-semibold">{activeNodeInfo.layer}</span>
                  <button 
                    aria-label="Close example inspector"
                    onClick={() => {setActiveNodeInfo(null);exampleButtonRef.current?.focus();}}
                    className="text-xs text-text-muted hover:text-white"
                  >
                    ✕
                  </button>
                </div>
                <div className="text-xs space-y-1.5 font-mono text-text-primary">
                  <div><span className="text-text-muted">Identifier:</span> {activeNodeInfo.neuron}</div>
                  <div><span className="text-text-muted">Example activation:</span> <span className="text-quantum-mint">{activeNodeInfo.activation}</span></div>
                  <div><span className="text-text-muted">Example bias:</span> {activeNodeInfo.bias}</div>
                  <div><span className="text-text-muted">Example weight:</span> {activeNodeInfo.weight}</div>
                </div>
                <div className="mt-3 pt-2 border-t border-white/10 text-[11px] text-text-muted">
                  Illustrative parameters, not fitted measurements. Formula: <code className="text-neural-violet">a = ReLU(Σ w_i·x_i + b)</code>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Three Major Workspaces Overview */}
      <section className="px-6 py-20 max-w-7xl mx-auto border-t border-white/5">
        <div className="text-center mb-14">
          <span className="text-xs font-mono uppercase tracking-widest text-plasma-cyan">Architecture & Modules</span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-display font-bold text-white">
            Three Core Laboratories. One Seamless Platform.
          </h2>
          <p className="mt-3 text-text-muted max-w-xl mx-auto text-sm">
            Move between classical algorithms, deep learning architecture, and empirical model arena without losing your dataset state.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Playground */}
          <Link
            to="/app/playground"
            className="group p-6 rounded-2xl bg-obsidian/60 hover:bg-obsidian border border-white/10 hover:border-plasma-cyan/50 transition-all shadow-lg flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-plasma-cyan/10 border border-plasma-cyan/30 flex items-center justify-center text-plasma-cyan mb-5 group-hover:scale-110 transition-transform">
                <Sliders className="w-6 h-6" />
              </div>
              <span className="text-xs font-mono text-plasma-cyan">01 — Flagship</span>
              <h3 className="text-xl font-display font-semibold text-white mt-1 group-hover:text-plasma-cyan transition-colors">
                ML Algorithm Playground
              </h3>
              <p className="mt-2 text-sm text-text-muted leading-relaxed">
                Draw custom 2D data points, add Gaussian noise, and test Linear/Logistic regression, K-Means clustering, and KNN in real time.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-1.5 text-xs font-medium text-plasma-cyan">
              <span>Open Playground</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 2: Neural Studio */}
          <Link
            to="/app/studio"
            className="group p-6 rounded-2xl bg-obsidian/60 hover:bg-obsidian border border-white/10 hover:border-neural-violet/50 transition-all shadow-lg flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-neural-violet/10 border border-neural-violet/30 flex items-center justify-center text-neural-violet mb-5 group-hover:scale-110 transition-transform">
                <Network className="w-6 h-6" />
              </div>
              <span className="text-xs font-mono text-neural-violet">02 — Flagship</span>
              <h3 className="text-xl font-display font-semibold text-white mt-1 group-hover:text-neural-violet transition-colors">
                Neural Network Studio
              </h3>
              <p className="mt-2 text-sm text-text-muted leading-relaxed">
                Visually construct dense sequential networks. Switch between high-level layer topology and deep neuron-level forward/backward passes.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-1.5 text-xs font-medium text-neural-violet">
              <span>Open Studio</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 3: Arena */}
          <Link
            to="/app/arena"
            className="group p-6 rounded-2xl bg-obsidian/60 hover:bg-obsidian border border-white/10 hover:border-quantum-mint/50 transition-all shadow-lg flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-quantum-mint/10 border border-quantum-mint/30 flex items-center justify-center text-quantum-mint mb-5 group-hover:scale-110 transition-transform">
                <Scale className="w-6 h-6" />
              </div>
              <span className="text-xs font-mono text-quantum-mint">03 — Flagship</span>
              <h3 className="text-xl font-display font-semibold text-white mt-1 group-hover:text-quantum-mint transition-colors">
                Experiment Arena
              </h3>
              <p className="mt-2 text-sm text-text-muted leading-relaxed">
                Benchmark candidate runs head-to-head. Synchronize epoch scrubber playback and discover why one model overfits while another generalizes.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-1.5 text-xs font-medium text-quantum-mint">
              <span>Enter Arena</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>
      </section>

      {/* Signature XOR Highlight Section */}
      <section className="px-6 py-16 max-w-5xl mx-auto my-12 rounded-3xl border border-white/10 bg-gradient-to-b from-obsidian to-surface-dark p-8 sm:p-12">
        <div className="flex flex-col md:flex-row items-center gap-8 justify-between">
          <div className="max-w-md">
            <span className="text-xs font-mono uppercase tracking-widest text-signal-amber">The Signature Experience</span>
            <h3 className="mt-2 text-2xl sm:text-3xl font-display font-bold text-white">
              Why does a neural network need hidden layers?
            </h3>
            <p className="mt-3 text-sm text-text-muted leading-relaxed">
              Start with an XOR dataset. Watch a standard linear model fail to classify diagonally opposite points.
              Add a single hidden layer, retrain, and see the decision boundary transform into a non-linear hyper-surface.
            </p>
            <div className="mt-6">
              <Link
                to="/showcase"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-signal-amber to-neural-violet text-ink-on-accent text-xs font-bold hover:opacity-90 shadow-md transition-all"
              >
                <span>Launch 90-Second Walkthrough</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Graphical XOR Illustration */}
          <div className="w-full md:w-64 h-64 rounded-2xl bg-deep-space border border-white/10 relative p-4 flex flex-col justify-between">
            <div className="flex justify-between items-center text-[10px] font-mono text-text-muted">
              <span>XOR Decision Space</span>
              <span className="text-signal-amber">Linear Separator: Fails</span>
            </div>
            <div className="relative w-full h-40">
              {/* Points */}
              <div className="absolute top-4 left-6 w-5 h-5 rounded-full bg-plasma-cyan border-2 border-white/30 flex items-center justify-center text-[9px] font-bold text-ink-on-accent">0</div>
              <div className="absolute top-4 right-6 w-5 h-5 rounded-full bg-neural-violet border-2 border-white/30 flex items-center justify-center text-[9px] font-bold text-ink-on-accent">1</div>
              <div className="absolute bottom-4 left-6 w-5 h-5 rounded-full bg-neural-violet border-2 border-white/30 flex items-center justify-center text-[9px] font-bold text-ink-on-accent">1</div>
              <div className="absolute bottom-4 right-6 w-5 h-5 rounded-full bg-plasma-cyan border-2 border-white/30 flex items-center justify-center text-[9px] font-bold text-ink-on-accent">0</div>
              
              {/* Failed straight line */}
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-400/80 -rotate-45 transform origin-center shadow-sm" />
            </div>
            <div className="text-[10px] text-center font-mono text-text-muted">
              Concept sketch: a straight line cannot separate XOR.
            </div>
          </div>
        </div>
      </section>

      {/* Engineering Behind the Lab */}
      <section className="px-6 py-16 max-w-7xl mx-auto border-t border-white/5">
        <div className="max-w-2xl mb-12">
          <span className="text-xs font-mono uppercase tracking-widest text-plasma-cyan">Technical Architecture</span>
          <h2 className="mt-2 text-2xl sm:text-3xl font-display font-bold text-white">
            Scientific methods you can inspect
          </h2>
          <p className="mt-2 text-sm text-text-muted">
            Inspect preprocessing fits, measured evaluation and reproducible plots alongside their methods and source provenance.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-5 rounded-xl bg-obsidian/40 border border-white/10">
            <Code2 className="w-5 h-5 text-plasma-cyan mb-3" />
            <h4 className="text-sm font-semibold text-white">True Client-Side ML</h4>
            <p className="mt-1 text-xs text-text-muted leading-relaxed">
              TensorFlow.js executes real gradient descent in the browser with tensor lifecycle management and Web Workers.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-obsidian/40 border border-white/10">
            <BrainCircuit className="w-5 h-5 text-neural-violet mb-3" />
            <h4 className="text-sm font-semibold text-white">Mathematical Transparency</h4>
            <p className="mt-1 text-xs text-text-muted leading-relaxed">
              Explicit neuron formulas for forward-propagation and real loss landscapes instead of canned animations.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-obsidian/40 border border-white/10">
            <CheckCircle2 className="w-5 h-5 text-quantum-mint mb-3" />
            <h4 className="text-sm font-semibold text-white">Empirical Comparability</h4>
            <p className="mt-1 text-xs text-text-muted leading-relaxed">
              Fair comparison guards prevent misleading cross-dataset conclusions and clearly separates train vs. val loss.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-obsidian/40 border border-white/10">
            <Layers className="w-5 h-5 text-signal-amber mb-3" />
            <h4 className="text-sm font-semibold text-white">Full-Stack Persistence</h4>
            <p className="mt-1 text-xs text-text-muted leading-relaxed">
              Express REST API and MongoDB schema store immutable experiment runs, hyperparameters, and bounded metrics.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 px-6 text-center text-xs text-text-muted font-mono">
        <p>NeuroForge AI • Interactive Intelligence Laboratory • Built with React, Tailwind, and TensorFlow.js</p>
      </footer>
    </div>
  );
}
