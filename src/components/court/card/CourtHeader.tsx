import React from 'react';
import { useTranslation } from 'react-i18next';

import { useAnalytics } from '../../../hooks/useAnalytics';

interface CourtHeaderProps {
  courtNumber: number;
  matchType?: string;
  onRotateTeams?: () => void;
}

const CourtHeader: React.FC<CourtHeaderProps> = ({
  courtNumber,
  matchType,
  onRotateTeams,
}) => {
  const { t } = useTranslation();
  const { trackCourtAction } = useAnalytics();

  const handleRotateTeams = onRotateTeams ? () => {
    trackCourtAction('rotate_teams');
    onRotateTeams();
  } : undefined;

  return (
    <div className="court-header">
      <h3>
        {matchType
          ? t('court.card.headerWithMatch', { number: courtNumber, matchType })
          : t('court.card.header', { number: courtNumber })}
      </h3>
      {handleRotateTeams && (
        <button
          className="rotate-teams-button"
          onClick={handleRotateTeams}
          title={t('court.card.rotateTeam')}
          aria-label={t('court.card.rotateTeam')}
          data-testid="rotate-teams-button"
        >
          ↻
        </button>
      )}
    </div>
  );
};

export default CourtHeader;
