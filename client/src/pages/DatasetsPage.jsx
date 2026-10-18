import React from 'react';
import { Link } from 'react-router-dom';
import { Database, Sliders, ArrowRight, Layers, Sparkles, Filter } from 'lucide-react';

export default function DatasetsPage() {
  const datasets = [
    {
      id: 'moons',
      name: 'Two Interleaving Moons',
      task: 'Binary Classification',
      samples: 250,
      features: 2,
      noise: '0.15 - 0.35',
      desc: 'Classic non-linear benchmark. Great for contrasting linear separators against RBF kernels and multi-layer perceptrons.',
      path: '/app/playground',
      color: 'text-[#46D7F2]',
    },
    {
      id: 'xor',
      name: 'XOR Parity Problem',
      task: 'Binary Classification',
      samples: 200,
      features: 2,
      noise: '0.05 - 0.20',
      desc: 'The defining non-linearly separable benchmark that revealed single-layer perceptron limitations in 1969.',
      path: '/app/studio',
      color: 'text-[#A78BFA]',
    },
    {
      id: 'blobs',
      name: 'Gaussian Clustering Blobs',
      task: 'Clustering / Density',
      samples: 300,
      features: 2,
      noise: 'Standard Deviation 1.0',
      desc: 'Ideal for K-Means iteration steps, Voronoi cell partitioning, and centroid inertia convergence.',
      path: '/app/playground',
      color: 'text-[#3CD5AA]',
    },
    {
      id: 'spiral',
      name: 'Two-Arm Archimedean Spiral',
      task: 'Complex Non-linear',
      samples: 400,
      features: 2,
      noise: '0.10',
      desc: 'A rigorous test for deep architectures requiring multiple hidden layers or polynomial feature expansions.',
      path: '/app/studio',
      color: 'text-[#F3B65E]',
    },
    {
      id: 'linear-trend',
      name: 'Noisy Linear Trend',
      task: 'Ordinary Least Squares',
      samples: 100,
      features: 1,
      noise: 'Gaussian Residuals',
      desc: 'Inspect gradient descent convergence, mean squared error minimization, and residual distribution plots.',
      path: '/app/playground',
      color: 'text-[#46D7F2]',
    },
  ];

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-[#46D7F2]">Data Foundation</span>
          <h2 className="text-2xl font-display font-bold text-white mt-1">Dataset Explorer & Microscope</h2>
          <p className="text-xs text-[#9EACC4] mt-0.5">Explore standard 2D feature distributions, noise dynamics, and class balances.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {datasets.map((d) => (
          <div key={d.id} className="p-5 rounded-2xl bg-[#151E30] border border-white/10 flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex justify-between items-start">
                <span className={`text-xs font-mono font-bold ${d.color}`}>{d.task}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-[#9EACC4]">N={d.samples}</span>
              </div>
              <h3 className="text-base font-semibold text-white mt-2">{d.name}</h3>
              <p className="mt-2 text-xs text-[#9EACC4] leading-relaxed">{d.desc}</p>
            </div>

            <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
              <span className="text-[11px] font-mono text-[#9EACC4]">Noise: {d.noise}</span>
              <Link
                to={d.path}
                className="flex items-center gap-1.5 text-xs font-medium text-[#46D7F2] hover:underline"
              >
                <span>Load in Lab</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
