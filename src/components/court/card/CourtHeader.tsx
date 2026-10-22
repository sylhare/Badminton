import React from 'react';

import { useAnalytics } from '../../../hooks/useAnalytics';
import { useTranslation } from '../../../i18n';

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
        {t('court.court', { number: courtNumber })}{matchType ? ` - ${matchType}` : ''}
      </h3>
      {handleRotateTeams && (
        <button
          className="rotate-teams-button"
          onClick={handleRotateTeams}
          title={t('court.rotateTooltip')}
          aria-label={t('court.rotateTooltip')}
          data-testid="rotate-teams-button"
        >
          ↻
        </button>
      )}
    </div>
  );
};

export default CourtHeader;

