import React, { Suspense, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

import App from './App.tsx';
import { AppStateProvider } from './providers/AppStateProvider.tsx';
import './index.css';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

const StatsPage        = React.lazy(() => import('./pages/StatsPage.tsx'));
const AlgorithmPage    = React.lazy(() => import('./pages/AlgorithmPage.tsx'));
const EnginePage       = React.lazy(() => import('./pages/EnginePage.tsx'));
const LevelTrackerPage = React.lazy(() => import('./pages/LevelTrackerPage.tsx'));
const TournamentPage   = React.lazy(() => import('./pages/TournamentPage.tsx'));
const NotFoundPage     = React.lazy(() => import('./pages/NotFoundPage.tsx'));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router basename={import.meta.env.BASE_URL || '/'}>
      <ScrollToTop />
      <AppStateProvider>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/algorithm" element={<AlgorithmPage />} />
            <Route path="/engine" element={<EnginePage />} />
            <Route path="/level-tracker" element={<LevelTrackerPage />} />
            <Route path="/tournament" element={<TournamentPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </AppStateProvider>
    </Router>
  </React.StrictMode>,
);
