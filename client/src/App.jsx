import { isFeatureEnabled } from './services/productionConfig.js';
import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/AppShell';
import LandingPage from './pages/LandingPage';
const AccountPage = lazy(() => import('./pages/AccountPage'));
const MissionControl = lazy(() => import('./pages/MissionControl'));
const PlaygroundShell = lazy(() => import('./pages/PlaygroundShell'));
const StudioShell = lazy(() => import('./pages/StudioShell'));
const ArenaShell = lazy(() => import('./pages/ArenaShell'));
const ShowcasePage = lazy(() => import('./pages/ShowcasePage'));
const DatasetsPage = lazy(() => import('./pages/DatasetsPage'));
const ExperimentsPage = lazy(() => import('./pages/ExperimentsPage'));
const AcademyPage = lazy(() => import('./pages/AcademyPage'));
const ReportPage = lazy(() => import('./pages/ReportPage'));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<p role="status" className="p-8 text-slate-300">Loading workspace...</p>}><Routes>
        {/* Standalone Landing Page */}
        <Route path="/" element={<LandingPage />} />

        {/* Application Workspace Routes (wrapped in AppShell) */}
        <Route path="/app" element={<AppShell />}>
          <Route index element={<MissionControl />} />
          <Route path="account" element={isFeatureEnabled('accounts_and_sync') ? <AccountPage /> : <p role="status" className="p-6">Account features are disabled for this rollout.</p>} />
          <Route path="playground" element={<PlaygroundShell />} />
          <Route path="studio" element={<StudioShell />} />
          <Route path="arena" element={<ArenaShell />} />
          <Route path="datasets" element={<DatasetsPage />} />
          <Route path="experiments" element={<ExperimentsPage />} />
          <Route path="experiments/:id" element={<ReportPage />} />
          <Route path="learn" element={<AcademyPage />} />
          <Route path="learn/:slug" element={<AcademyPage />} />
        </Route>

        {/* Public Read-Only Shareable Report Route */}
        <Route path="/report/:id" element={<AppShell />}>
          <Route index element={<ReportPage />} />
        </Route>

        {/* Showcase / Interview Walkthrough Route (in AppShell) */}
        <Route path="/showcase" element={<AppShell />}>
          <Route index element={<ShowcasePage />} />
        </Route>

        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes></Suspense>
    </BrowserRouter>
  );
}
