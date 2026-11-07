import React, { Suspense, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

import App from './App.tsx';
import { AppStateProvider } from './providers/AppStateProvider.tsx';
import { detectLocale, initI18n, loadLocale, type SupportedLocale } from './i18n';
import './index.css';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

const StatsPage      = React.lazy(() => import('./pages/StatsPage.tsx'));
const TournamentPage = React.lazy(() => import('./pages/TournamentPage.tsx'));
const NotFoundPage   = React.lazy(() => import('./pages/NotFoundPage.tsx'));

const basePath = import.meta.env.BASE_URL || '/';

function renderApp() {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <Router basename={basePath}>
        <ScrollToTop />
        <AppStateProvider>
          <Suspense fallback={null}>
            <Routes>
              <Route path="/" element={<App />} />
              <Route path="/stats" element={<StatsPage />} />
              <Route path="/tournament" element={<TournamentPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </AppStateProvider>
      </Router>
    </React.StrictMode>,
  );
}

async function resolveLocale(locale: SupportedLocale, timeoutMs = 1500): Promise<SupportedLocale> {
  if (locale === 'en') return 'en';

  try {
    const timeout = new Promise<'timeout'>(resolve => setTimeout(() => resolve('timeout'), timeoutMs));
    const result = await Promise.race([loadLocale(locale).then(() => 'loaded' as const), timeout]);
    if (result === 'loaded') return locale;

    console.warn(`[i18n] Loading locale "${locale}" timed out after ${timeoutMs}ms; falling back to English.`);
  } catch (error) {
    console.warn(`[i18n] Failed to load locale "${locale}"; falling back to English.`, error);
  }

  return 'en';
}

async function start(): Promise<void> {
  const locale = await resolveLocale(detectLocale());
  await initI18n(locale);
  renderApp();
}

void start();
