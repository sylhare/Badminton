import React from 'react';

import { Player } from '../App';

import TeamPlayerList from './TeamPlayerList';

interface TeamDisplayProps {
  teamNumber: number;
  players: Player[];
  showVsDivider?: boolean;
  isWinner?: boolean;
  onTeamClick?: (teamNumber: number) => void;
  isClickable?: boolean;
}

const TeamDisplay: React.FC<TeamDisplayProps> = ({
  teamNumber,
  players,
  showVsDivider = false,
  isWinner = false,
  onTeamClick,
  isClickable = false,
}) => {
  const handleClick = () => {
    if (isClickable && onTeamClick) {
      onTeamClick(teamNumber);
    }
  };

  return (
    <>
      <div 
        className={`team ${isClickable ? 'team-clickable' : ''} ${isWinner ? 'team-winner' : ''}`}
        onClick={handleClick}
      >
        <div className="team-label">
          Team {teamNumber}
          {isWinner && <span className="crown">👑</span>}
        </div>
        <div className="team-players">
          <TeamPlayerList players={players} />
        </div>
      </div>
      {showVsDivider && <div className="vs-divider">VS</div>}
    </>
  );
};

export default TeamDisplay;