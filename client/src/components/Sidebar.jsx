import React from 'react';
import ThemePicker from './ThemePicker.jsx';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Sliders, 
  BookOpen, 
  Database, 
  FolderGit2, 
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useLabStore } from '../store/useLabStore';

export default function Sidebar() {
  const { sidebarExpanded, toggleSidebar } = useLabStore();

  const navItems = [
    { name: 'Home', path: '/app', icon: LayoutDashboard },
    { name: 'Learn', path: '/app/learn', icon: BookOpen },
    { name: 'Explore Data', path: '/app/datasets', icon: Database },
    { name: 'Build Models', path: '/app/playground', icon: Sliders },
    { name: 'Research', path: '/app/experiments', icon: FolderGit2 },
  ];

  return (
    <aside
      aria-label="Workspace sidebar"
      className={`mobile-lab-nav fixed inset-x-0 bottom-0 top-auto z-40 h-[72px] w-full bg-surface-dark border-t border-white/10 flex flex-col transition-all duration-300 ease-in-out lg:top-0 lg:right-auto lg:bottom-0 lg:h-auto lg:border-t-0 lg:border-r ${
        sidebarExpanded ? 'lg:w-[232px]' : 'lg:w-[72px]'
      }`}
    >
      {/* Brand Header */}
      <div className="hidden lg:flex h-16 items-center px-4 border-b border-white/10 justify-between">
        <NavLink to="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-plasma-cyan/20 to-neural-violet/30 border border-plasma-cyan/40 flex items-center justify-center font-display font-bold text-lg text-plasma-cyan shadow-glow-cyan transition-transform group-hover:scale-105">
            N
          </div>
          {sidebarExpanded && (
            <div className="hidden lg:flex flex-col">
              <span className="font-display font-bold tracking-tight text-base text-white flex items-center gap-1.5">
                NeuroForge
                <span className="text-[10px] uppercase font-mono px-1 py-0.2 rounded bg-plasma-cyan/20 text-plasma-cyan border border-plasma-cyan/30">
                  AI
                </span>
              </span>
              <span className="text-[10px] text-text-muted tracking-wider uppercase font-mono">Research Lab</span>
            </div>
          )}
        </NavLink>
        {sidebarExpanded && (
          <button 
            onClick={toggleSidebar}
            type="button"
            aria-label="Collapse sidebar"
            aria-expanded={sidebarExpanded}
            title="Collapse sidebar"
            className="hidden lg:block p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/5 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Main Navigation */}
      <nav aria-label="Primary navigation" className="flex-1 flex flex-row lg:flex-col gap-1 p-2 lg:py-4 lg:px-3 overflow-x-auto overflow-y-hidden lg:overflow-y-auto lg:overflow-x-hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              aria-label={item.name}
              end={item.path === '/app'}
              className={({ isActive }) =>
                `flex flex-col lg:flex-row items-center justify-center lg:justify-start gap-1 lg:gap-3 min-w-[68px] min-h-[54px] lg:min-w-0 lg:min-h-0 px-2 lg:px-3 py-1.5 lg:py-2.5 rounded-xl text-sm font-medium transition-all group relative ${item.mobileOnly ? 'lg:hidden' : ''} ${
                  isActive
                    ? 'bg-plasma-cyan/15 text-plasma-cyan border border-plasma-cyan/30 shadow-sm font-semibold'
                    : 'text-text-muted hover:text-white hover:bg-white/5'
                }`
              }
              title={!sidebarExpanded ? item.name : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="lg:hidden text-[10px] font-medium leading-tight text-center whitespace-nowrap">{item.name}</span>
              {sidebarExpanded && <span className="hidden lg:block min-w-0 flex-1 truncate">{item.name}</span>}
            </NavLink>
          );
        })}
      </nav>

      <ThemePicker />
      {/* Local session status */}
      <div className="hidden lg:block p-3 border-t border-white/10 space-y-2">
        <div className="flex items-center justify-between pt-1">
          {sidebarExpanded ? (
            <div className="hidden lg:flex items-center gap-2 px-1 text-[11px] text-text-muted font-mono">
              <span className="w-2 h-2 rounded-full bg-quantum-mint shadow-sm animate-pulse" />
              <span>Guest Mode (Local)</span>
            </div>
          ) : (
            <button 
              onClick={toggleSidebar}
              type="button"
              aria-label="Expand sidebar"
              aria-expanded={sidebarExpanded}
              title="Expand sidebar"
              className="w-full flex justify-center p-2 rounded-lg text-text-muted hover:text-white hover:bg-white/5 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
