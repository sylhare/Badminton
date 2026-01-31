import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App.tsx';
import StatsPage from './pages/StatsPage.tsx';
import AlgorithmPage from './pages/AlgorithmPage.tsx';
import AnalysisPage from './pages/AnalysisPage.tsx';
import './index.css';

function Router(): React.ReactElement {
  const path = window.location.pathname;
  const basePath = import.meta.env.BASE_URL || '/';

  const normalizedPath = path.replace(basePath, '/').replace(/\/+$/, '') || '/';

  switch (normalizedPath) {
    case '/stats':
      return <StatsPage />;
    case '/algorithm':
      return <AlgorithmPage />;
    case '/analysis':
      return <AnalysisPage />;
    default:
      return <App />;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>,
);
