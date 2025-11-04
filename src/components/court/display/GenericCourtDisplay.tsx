import React from 'react';

import type { Player } from '../../../types';
import TeamDisplay from './TeamDisplay';

interface GenericCourtDisplayProps {
  team1Players: Player[];
  team2Players: Player[];
  winner?: 1 | 2;
  isAnimating?: boolean;
  onTeamClick?: (teamNumber: number) => void;
  isClickable?: boolean;
}

const GenericCourtDisplay: React.FC<GenericCourtDisplayProps> = ({
  team1Players,
  team2Players,
  winner,
  isAnimating = false,
  onTeamClick,
  isClickable = false,
}) => {
  return (
    <div className={`teams ${isAnimating ? 'animating-blur' : ''}`}>
      <TeamDisplay
        teamNumber={1}
        players={team1Players}
        isWinner={winner === 1}
        onTeamClick={onTeamClick}
        isClickable={isClickable}
      />
      {team2Players.length > 0 && (
        <>
          <div className="vs-divider">VS</div>
          <TeamDisplay
            teamNumber={2}
            players={team2Players}
            isWinner={winner === 2}
            onTeamClick={onTeamClick}
            isClickable={isClickable}
          />
        </>
      )}
    </div>
  );
};

export default GenericCourtDisplay;

