import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/AppShell';
import LandingPage from './pages/LandingPage';
import MissionControl from './pages/MissionControl';
import PlaygroundShell from './pages/PlaygroundShell';
import StudioShell from './pages/StudioShell';
import ArenaShell from './pages/ArenaShell';
import ShowcasePage from './pages/ShowcasePage';
import DatasetsPage from './pages/DatasetsPage';
import ExperimentsPage from './pages/ExperimentsPage';
import AcademyPage from './pages/AcademyPage';
import ReportPage from './pages/ReportPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Standalone Landing Page */}
        <Route path="/" element={<LandingPage />} />

        {/* Application Workspace Routes (wrapped in AppShell) */}
        <Route path="/app" element={<AppShell />}>
          <Route index element={<MissionControl />} />
          <Route path="playground" element={<PlaygroundShell />} />
          <Route path="studio" element={<StudioShell />} />
          <Route path="arena" element={<ArenaShell />} />
          <Route path="datasets" element={<DatasetsPage />} />
          <Route path="experiments" element={<ExperimentsPage />} />
          <Route path="experiments/:id" element={<ReportPage />} />
          <Route path="learn" element={<AcademyPage />} />
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
      </Routes>
    </BrowserRouter>
  );
}
