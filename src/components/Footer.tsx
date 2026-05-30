import React from 'react';
import { Link } from 'react-router-dom';

interface FooterProps {
  showStatsLink?: boolean;
  showTournamentLink?: boolean;
}

const Footer: React.FC<FooterProps> = ({ showStatsLink = true, showTournamentLink = false }) => (
  <footer className="app-footer" data-testid="app-footer">
    <p>
      Have feedback? Found a bug or want to suggest a feature?
      {' '}
      <a
        href="https://github.com/sylhare/Badminton/issues/new/choose"
        target="_blank"
        rel="noopener noreferrer"
      >
        Let us know on GitHub
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
            View Statistics & Analysis
          </Link>
        )}
        {showTournamentLink && (
          <Link
            to="/tournament"
            className="analysis-link"
            data-testid="tournament-link"
          >
            Try Tournament Mode
          </Link>
        )}
      </div>
    )}
  </footer>
);

export default Footer;
