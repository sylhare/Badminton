import React from 'react';
import { useTranslation } from 'react-i18next';

import type { Player } from '../../../types';
import TeamPlayerList from '../team/TeamPlayerList';

interface NoTeamsDisplayProps {
  players: Player[];
  isAnimating?: boolean;
}

const NoTeamsDisplay: React.FC<NoTeamsDisplayProps> = ({
  players,
  isAnimating = false,
}) => {
  const { t } = useTranslation();

  return (
    <div className="singles-match">
      <div className={isAnimating ? 'animating-blur' : ''}>{t('court.display.playersOnCourt')}</div>
      <div className={isAnimating ? 'animating-blur' : ''}>
        <TeamPlayerList players={players} />
      </div>
    </div>
  );
};

export default NoTeamsDisplay;
