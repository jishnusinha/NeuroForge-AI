import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Sliders, 
  Network, 
  Scale, 
  BookOpen, 
  Database, 
  FolderGit2, 
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useLabStore } from '../store/useLabStore';

export default function Sidebar() {
  const { sidebarExpanded, toggleSidebar } = useLabStore();

  const navItems = [
    { name: 'Mission Control', path: '/app', icon: LayoutDashboard },
    { name: 'ML Playground', path: '/app/playground', icon: Sliders, badge: 'Flagship' },
    { name: 'Neural Studio', path: '/app/studio', icon: Network, badge: 'Flagship' },
    { name: 'Experiment Arena', path: '/app/arena', icon: Scale, badge: 'Flagship' },
    { name: 'Academy', path: '/app/learn', icon: BookOpen },
    { name: 'Dataset Explorer', path: '/app/datasets', icon: Database },
    { name: 'My Experiments', path: '/app/experiments', icon: FolderGit2 },
  ];

  return (
    <aside 
      className={`fixed top-0 left-0 bottom-0 z-40 bg-[#0D1422] border-r border-white/10 flex flex-col transition-all duration-300 ease-in-out ${
        sidebarExpanded ? 'lg:w-[232px] w-[72px]' : 'w-[72px]'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center px-4 border-b border-white/10 justify-between">
        <NavLink to="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#46D7F2]/20 to-[#A78BFA]/30 border border-[#46D7F2]/40 flex items-center justify-center font-display font-bold text-lg text-[#46D7F2] shadow-glow-cyan transition-transform group-hover:scale-105">
            N
          </div>
          {sidebarExpanded && (
            <div className="hidden lg:flex flex-col">
              <span className="font-display font-bold tracking-tight text-base text-white flex items-center gap-1.5">
                NeuroForge
                <span className="text-[10px] uppercase font-mono px-1 py-0.2 rounded bg-[#46D7F2]/20 text-[#46D7F2] border border-[#46D7F2]/30">
                  AI
                </span>
              </span>
              <span className="text-[10px] text-[#9EACC4] tracking-wider uppercase font-mono">Research Lab</span>
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
            className="hidden lg:block p-1.5 rounded-lg text-[#9EACC4] hover:text-white hover:bg-white/5 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Main Navigation */}
      <div className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto overflow-x-hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              aria-label={item.name}
              end={item.path === '/app'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group relative ${
                  isActive
                    ? 'bg-[#46D7F2]/15 text-[#46D7F2] border border-[#46D7F2]/30 shadow-sm font-semibold'
                    : 'text-[#9EACC4] hover:text-white hover:bg-white/5'
                }`
              }
              title={!sidebarExpanded ? item.name : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {sidebarExpanded && (
                <div className="hidden lg:flex items-center justify-between flex-1 overflow-hidden">
                  <span className="truncate">{item.name}</span>
                  {item.badge && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-[#A78BFA] border border-[#A78BFA]/20 uppercase font-mono">
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </NavLink>
          );
        })}
      </div>

      {/* Showcase Feature Highlight */}
      <div className="p-3 border-t border-white/10 space-y-2">
        <NavLink
          to="/showcase"
          className={({ isActive }) =>
            `flex items-center gap-2.5 p-2.5 rounded-xl text-xs font-medium border transition-all ${
              isActive 
                ? 'bg-gradient-to-r from-[#A78BFA]/20 to-[#46D7F2]/20 border-[#46D7F2]/50 text-white shadow-glow-cyan'
                : 'bg-gradient-to-r from-white/[0.03] to-white/[0.06] border-white/10 text-[#F2F5FC] hover:border-[#46D7F2]/40'
            }`
          }
          title={!sidebarExpanded ? '3-Min Interview Showcase' : undefined}
        >
          <div className="p-1 rounded-lg bg-[#A78BFA]/20 text-[#A78BFA]">
            <Sparkles className="w-4 h-4 flex-shrink-0 animate-pulse" />
          </div>
          {sidebarExpanded && (
            <div className="hidden lg:block overflow-hidden">
              <div className="font-semibold text-white flex items-center gap-1">
                Interview Showcase
              </div>
              <p className="text-[10px] text-[#9EACC4] truncate">3-min guided tour</p>
            </div>
          )}
        </NavLink>

        {/* Guest Status & Collapse Button for Mini-bar */}
        <div className="flex items-center justify-between pt-1">
          {sidebarExpanded ? (
            <div className="hidden lg:flex items-center gap-2 px-1 text-[11px] text-[#9EACC4] font-mono">
              <span className="w-2 h-2 rounded-full bg-[#3CD5AA] shadow-sm animate-pulse" />
              <span>Guest Mode (Local)</span>
            </div>
          ) : (
            <button 
              onClick={toggleSidebar}
              type="button"
              aria-label="Expand sidebar"
              aria-expanded={sidebarExpanded}
              title="Expand sidebar"
              className="w-full flex justify-center p-2 rounded-lg text-[#9EACC4] hover:text-white hover:bg-white/5 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
