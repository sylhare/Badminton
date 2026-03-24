import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';

import App from './App.tsx';
import StatsPage from './pages/StatsPage.tsx';
import AlgorithmPage from './pages/AlgorithmPage.tsx';
import EnginePage from './pages/EnginePage.tsx';
import LevelTrackerPage from './pages/LevelTrackerPage.tsx';
import TournamentPage from './pages/TournamentPage.tsx';
import { AppStateProvider } from './providers/AppStateProvider.tsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router basename={import.meta.env.BASE_URL || '/'}>
      <AppStateProvider>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/algorithm" element={<AlgorithmPage />} />
          <Route path="/engine" element={<EnginePage />} />
          <Route path="/level-tracker" element={<LevelTrackerPage />} />
          <Route path="/tournament" element={<TournamentPage />} />
        </Routes>
      </AppStateProvider>
    </Router>
  </React.StrictMode>,
);
