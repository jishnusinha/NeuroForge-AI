import React from 'react';
import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';
import { useLabStore } from '../../store/useLabStore';

export default function WorkspacePanel({
  id = 'left', // 'left' | 'right' | 'bottom'
  title,
  children,
  widthKey,
  collapsedKey,
  minWidth = 240,
  maxWidth = 480,
  defaultWidth = 320,
  className = '',
}) {
  const { panelLayouts, setPanelLayout } = useLabStore();
  const width = panelLayouts[widthKey] || defaultWidth;
  const isCollapsed = Boolean(panelLayouts[collapsedKey]);

  const toggleCollapse = () => {
    setPanelLayout(collapsedKey, !isCollapsed);
  };

  const handleStepResize = (delta) => {
    const next = Math.max(minWidth, Math.min(maxWidth, width + delta));
    setPanelLayout(widthKey, next);
  };

  if (isCollapsed) {
    return (
      <aside 
        className="bg-surface-dark border-r border-white/10 flex flex-col items-center py-3 px-1 transition-all flex-shrink-0 select-none"
        style={{ width: '40px' }}
        aria-label={`${title} (Collapsed)`}
      >
        <button
          type="button"
          onClick={toggleCollapse}
          className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/10 transition-colors"
          title={`Expand ${title}`}
          aria-label={`Expand ${title}`}
        >
          {id === 'left' ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
        <span className="text-[11px] font-mono text-text-muted rotate-90 whitespace-nowrap mt-8 origin-left translate-x-2">
          {title}
        </span>
      </aside>
    );
  }

  return (
    <aside
      className={`bg-surface-dark border-r border-white/10 flex flex-col flex-shrink-0 overflow-hidden transition-all duration-150 ${className}`}
      style={{ width: `${width}px` }}
      aria-label={title}
    >
      {/* Accessible Panel Header with Resize Controls */}
      <div className="p-3 border-b border-white/10 bg-obsidian/70 flex items-center justify-between select-none">
        <span className="text-xs font-mono font-semibold text-white tracking-wide">{title}</span>
        
        <div className="flex items-center gap-1">
          {/* Keyboard Step Resizing */}
          <button
            type="button"
            onClick={() => handleStepResize(-24)}
            disabled={width <= minWidth}
            className="p-1 rounded text-text-muted hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Decrease panel width (-24px)"
            aria-label="Decrease panel width"
          >
            <Minus className="w-3 h-3" />
          </button>
          <span className="text-[10px] font-mono text-text-muted/70 px-1">{width}px</span>
          <button
            type="button"
            onClick={() => handleStepResize(24)}
            disabled={width >= maxWidth}
            className="p-1 rounded text-text-muted hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Increase panel width (+24px)"
            aria-label="Increase panel width"
          >
            <Plus className="w-3 h-3" />
          </button>

          {/* Collapse Button */}
          <button
            type="button"
            onClick={toggleCollapse}
            className="p-1 ml-1 rounded text-text-muted hover:text-white hover:bg-white/10 transition-colors"
            title={`Collapse ${title}`}
            aria-label={`Collapse ${title}`}
          >
            {id === 'left' ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </aside>
  );
}
