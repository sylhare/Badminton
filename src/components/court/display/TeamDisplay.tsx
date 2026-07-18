import React from 'react';

import type { Player } from '../../../types';
import TeamPlayerList from '../team/TeamPlayerList';
import type { SlotBinding } from '../edit/slotBinding';

interface TeamDisplayProps {
  teamNumber: number;
  players: Player[];
  showVsDivider?: boolean;
  isWinner?: boolean;
  onTeamClick?: (event: React.MouseEvent, teamNumber: number) => void;
  isClickable?: boolean;
  slotBinding?: SlotBinding;
}

const TeamDisplay: React.FC<TeamDisplayProps> = ({
  teamNumber,
  players,
  showVsDivider = false,
  isWinner = false,
  onTeamClick,
  isClickable = false,
  slotBinding,
}) => {
  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isClickable && onTeamClick) {
      onTeamClick(event, teamNumber);
    }
  };

  return (
    <>
      <div
        className={`team ${isClickable ? 'team-clickable' : ''} ${isWinner ? 'team-winner' : ''}`}
        onClick={handleClick}
        data-testid={`team-${teamNumber}`}
      >
        <div className="team-label">
          Team {teamNumber}
          {isWinner && <span className="crown">👑</span>}
        </div>
        <div className="team-players">
          <TeamPlayerList players={players} slotBinding={slotBinding} />
        </div>
      </div>
      {showVsDivider && <div className="vs-divider">VS</div>}
    </>
  );
};

export default TeamDisplay;