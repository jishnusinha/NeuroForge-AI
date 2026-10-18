import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import WorkspaceHeader from './WorkspaceHeader';
import CommandPalette from './CommandPalette';
import Toast from './Toast';
import { useLabStore } from '../store/useLabStore';

export default function AppShell() {
  const location = useLocation();
  const { sidebarExpanded } = useLabStore();
  const isLandingPage = location.pathname === '/';

  // Landing page has its own standalone public layout
  if (isLandingPage) {
    return (
      <div className="min-h-screen bg-[#080D18] text-[#F2F5FC]">
        <CommandPalette />
        <Toast />
        <Outlet />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080D18] text-[#F2F5FC] flex flex-col font-sans">
      <CommandPalette />
      <Toast />
      <Sidebar />
      
      {/* Main Workspace Frame */}
      <div 
        className={`flex-1 flex flex-col transition-all duration-300 ease-in-out ${
          sidebarExpanded ? 'pl-[232px]' : 'pl-[72px]'
        }`}
      >
        <WorkspaceHeader />
        
        {/* Workspace Canvas / Viewport */}
        <main className="flex-1 flex flex-col overflow-x-hidden bg-[#080D18]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
