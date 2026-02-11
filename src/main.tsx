import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import App from './App.tsx';
import StatsPage from './pages/StatsPage.tsx';
import AlgorithmPage from './pages/AlgorithmPage.tsx';
import AnalysisPage from './pages/AnalysisPage.tsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <Router basename={import.meta.env.BASE_URL || '/'}>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/algorithm" element={<AlgorithmPage />} />
          <Route path="/analysis" element={<AnalysisPage />} />
        </Routes>
      </Router>
    </React.StrictMode>,
);
