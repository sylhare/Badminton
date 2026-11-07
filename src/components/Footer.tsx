import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import LanguageSelector from '../i18n/LanguageSelector';

interface FooterProps {
  showStatsLink?: boolean;
  showTournamentLink?: boolean;
}

const Footer: React.FC<FooterProps> = ({ showStatsLink = true, showTournamentLink = false }) => {
  const { t } = useTranslation();

  return (
    <footer className="app-footer" data-testid="app-footer">
      <p>
        {t('footer.feedback')}{' '}
        <a
          href="https://github.com/sylhare/Badminton/issues/new/choose"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('footer.githubLink')}
        </a>
      </p>
      {(showStatsLink || showTournamentLink) && (
        <div className="footer-links">
          {showStatsLink && (
            <Link
              to="/stats"
              className="analysis-link"
              data-testid="stats-link"
            >
              {t('footer.viewStats')}
            </Link>
          )}
          {showTournamentLink && (
            <Link
              to="/tournament"
              className="analysis-link"
              data-testid="tournament-link"
            >
              {t('footer.tryTournament')}
            </Link>
          )}
        </div>
      )}
      <div className="footer-language">
        <LanguageSelector />
      </div>
    </footer>
  );
};

export default Footer;
