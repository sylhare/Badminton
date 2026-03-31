import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';

import App from './App.tsx';
import { AppStateProvider } from './providers/AppStateProvider.tsx';
import './index.css';

const StatsPage        = React.lazy(() => import('./pages/StatsPage.tsx'));
const AlgorithmPage    = React.lazy(() => import('./pages/AlgorithmPage.tsx'));
const EnginePage       = React.lazy(() => import('./pages/EnginePage.tsx'));
const LevelTrackerPage = React.lazy(() => import('./pages/LevelTrackerPage.tsx'));
const TournamentPage   = React.lazy(() =>
  import('./pages/TournamentPage.tsx').then(m => ({ default: m.TournamentPage })),
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router basename={import.meta.env.BASE_URL || '/'}>
      <AppStateProvider>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/algorithm" element={<AlgorithmPage />} />
            <Route path="/engine" element={<EnginePage />} />
            <Route path="/level-tracker" element={<LevelTrackerPage />} />
            <Route path="/tournament" element={<TournamentPage />} />
          </Routes>
        </Suspense>
      </AppStateProvider>
    </Router>
  </React.StrictMode>,
);
