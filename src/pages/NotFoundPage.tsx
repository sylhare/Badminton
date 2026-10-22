import React from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';

import Footer from '../components/Footer';
import { useTranslation } from '../i18n';
import './NotFoundPage.css';

const KNOWN_ROUTES = ['/stats', '/tournament'];

const NotFoundPage: React.FC = () => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const match = KNOWN_ROUTES.find(r => pathname === r || pathname.startsWith(r + '/'));

  if (match) {
    return <Navigate to={match} replace />;
  }

  return (
    <div className="app" data-loaded="true">
      <div className="container main-container not-found-container">
        <h1>404</h1>
        <p className="not-found-message">{t('notFound.message')}</p>
        <Link to="/" className="primary-action-link" data-testid="go-home-link">
          {t('notFound.back')}
        </Link>
      </div>
      <Footer />
    </div>
  );
};

export default NotFoundPage;
