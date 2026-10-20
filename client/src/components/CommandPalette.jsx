import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  ArrowRight, 
  Sliders, 
  Network, 
  Scale, 
  BookOpen, 
  Database, 
  Layers, 
  Play, 
  Sparkles,
  X 
} from 'lucide-react';
import { useLabStore } from '../store/useLabStore';
import { generateXOR, generateGaussianBlobs } from '../ml/datasets';

export default function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen } = useLabStore();
  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
      if (event.key === 'Escape') setCommandPaletteOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen, setCommandPaletteOpen]);
  return commandPaletteOpen ? <CommandDialog /> : null;
}

function CommandDialog() {
  const { setCommandPaletteOpen, loadRun, showToast } = useLabStore();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const commands = [
    {
      category: 'Workspaces',
      id: 'ws-playground',
      title: 'ML Algorithm Playground',
      desc: 'Interactive 2D classification, regression, and clustering',
      icon: Sliders,
      action: () => navigate('/app/playground'),
    },
    {
      category: 'Workspaces',
      id: 'ws-studio',
      title: 'Neural Network Studio',
      desc: 'Visual dense network builder, neuron inspection, and live training',
      icon: Network,
      action: () => navigate('/app/studio'),
    },
    {
      category: 'Workspaces',
      id: 'ws-arena',
      title: 'Experiment Arena',
      desc: 'Side-by-side model comparison, synchronized replay, and insights',
      icon: Scale,
      action: () => navigate('/app/arena'),
    },
    {
      category: 'Workspaces',
      id: 'ws-showcase',
      title: 'Interview Demo Walkthrough',
      desc: 'Guided 3-minute portfolio tour demonstrating real ML engineering',
      icon: Sparkles,
      action: () => navigate('/showcase'),
    },
    {
      category: 'Quick Experiments',
      id: 'exp-xor',
      title: 'Launch The XOR Challenge',
      desc: 'Demonstrate why neural networks require hidden layers',
      icon: Play,
      action: () => {
        loadRun({workspace:'studio',dataset:{name:'XOR Problem',points:generateXOR(180,.12,42),noise:.12,trainRatio:.8},hyperparameters:{layers:[{id:'in',type:'Input',units:2,activation:'Linear'},{id:'hidden',type:'Dense',units:4,activation:'ReLU'},{id:'out',type:'Output',units:1,activation:'Sigmoid'}]}});
        navigate('/app/studio');
        showToast('Loaded XOR Classification Benchmark', 'info');
      },
    },
    {
      category: 'Quick Experiments',
      id: 'exp-kmeans',
      title: 'Open K-Means Clustering',
      desc: 'Manipulate centroids, step iterations, and observe Voronoi cells',
      icon: Layers,
      action: () => {
        loadRun({workspace:'playground',algorithm:'K-Means Clustering',dataset:{name:'Gaussian Blobs',points:generateGaussianBlobs(210,.15,42),noise:.15,trainRatio:.8},hyperparameters:{k:3}});
        navigate('/app/playground');
        showToast('Switched to K-Means Clustering', 'info');
      },
    },
    {
      category: 'Resources',
      id: 'nav-datasets',
      title: 'Dataset Explorer',
      desc: 'Inspect feature distributions, noise, and train/test splits',
      icon: Database,
      action: () => navigate('/app/datasets'),
    },
    {
      category: 'Resources',
      id: 'nav-academy',
      title: 'NeuroForge Academy',
      desc: 'Predict-before-reveal micro-lessons on core ML concepts',
      icon: BookOpen,
      action: () => navigate('/app/learn'),
    },
  ];

  const filteredCommands = commands.filter(cmd => 
    cmd.title.toLowerCase().includes(query.toLowerCase()) ||
    cmd.desc.toLowerCase().includes(query.toLowerCase()) ||
    cmd.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const previous = document.activeElement;
    inputRef.current?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);

  const handleSelect = (cmd) => {
    setCommandPaletteOpen(false);
    cmd.action();
  };

  const handleKeyDownList = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filteredCommands.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % (filteredCommands.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        handleSelect(filteredCommands[selectedIndex]);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-[#080D18]/80 backdrop-blur-md">
      <div 
        role="dialog" aria-modal="true" aria-label="Quick commands"
        className="w-full max-w-2xl bg-[#151E30] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-white/10 gap-3">
          <Search className="w-5 h-5 text-[#46D7F2]" />
          <input
            aria-label="Search commands"
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDownList}
            placeholder="Type a command, experiment name, or destination..."
            className="flex-1 bg-transparent text-[#F2F5FC] placeholder-[#9EACC4]/60 text-sm focus:outline-none font-sans"
          />
          <button 
            aria-label="Close commands"
            onClick={() => setCommandPaletteOpen(false)}
            className="p-1 rounded-lg text-[#9EACC4] hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-[380px] overflow-y-auto p-2 divide-y divide-white/5">
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-sm text-[#9EACC4]">
              No results found for <span className="text-[#46D7F2]">"{query}"</span>
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const Icon = cmd.icon;
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={cmd.id}
                  onClick={() => handleSelect(cmd)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                    isSelected ? 'bg-white/10 text-white shadow-sm' : 'text-[#F2F5FC] hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isSelected ? 'bg-[#46D7F2]/20 text-[#46D7F2]' : 'bg-white/5 text-[#9EACC4]'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{cmd.title}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-[#9EACC4] uppercase tracking-wider font-mono">
                          {cmd.category}
                        </span>
                      </div>
                      <p className="text-xs text-[#9EACC4] mt-0.5">{cmd.desc}</p>
                    </div>
                  </div>
                  {isSelected && (
                    <ArrowRight className="w-4 h-4 text-[#46D7F2] animate-pulse" />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#0D1422] border-t border-white/5 text-[11px] text-[#9EACC4] font-mono">
          <div className="flex items-center gap-4">
            <span><kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white">↑↓</kbd> Navigate</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white">↵</kbd> Select</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white">ESC</kbd> Close</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#46D7F2]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Antigravity Quick Command</span>
          </div>
        </div>
      </div>
    </div>
  );
}
