import React from 'react';
import { Compass, SlidersHorizontal } from 'lucide-react';
import { useLabStore } from '../../store/useLabStore';

export default function ViewModeToggle() {
  const { viewMode, setViewMode } = useLabStore();

  return (
    <div 
      role="radiogroup" 
      aria-label="Workspace View Mode"
      className="inline-flex items-center p-0.5 rounded-lg bg-[#151E30] border border-white/10 text-xs font-mono"
    >
      <button
        type="button"
        role="radio"
        aria-checked={viewMode === 'guided'}
        onClick={() => setViewMode('guided')}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all font-medium ${
          viewMode === 'guided'
            ? 'bg-[#46D7F2] text-[#080D18] shadow-sm font-semibold'
            : 'text-[#9EACC4] hover:text-white hover:bg-white/5'
        }`}
        title="Guided View: curated controls, plain-English hints, and step-by-step guidance"
      >
        <Compass className="w-3.5 h-3.5" />
        <span>Guided</span>
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={viewMode === 'expert'}
        onClick={() => setViewMode('expert')}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all font-medium ${
          viewMode === 'expert'
            ? 'bg-[#A78BFA] text-[#080D18] shadow-sm font-semibold'
            : 'text-[#9EACC4] hover:text-white hover:bg-white/5'
        }`}
        title="Expert View: complete architecture, optimizer equations, raw metric series, and diagnostics"
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        <span>Expert</span>
      </button>
    </div>
  );
}
