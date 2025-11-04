import React from 'react';

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
  return (
    <div className="singles-match">
      <div className={isAnimating ? 'animating-blur' : ''}>Players on court:</div>
      <div className={isAnimating ? 'animating-blur' : ''}>
        <TeamPlayerList players={players} />
      </div>
    </div>
  );
};

export default NoTeamsDisplay;

