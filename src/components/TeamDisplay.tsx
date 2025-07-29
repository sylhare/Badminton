import React from 'react';

import { Player } from '../App';

import TeamPlayerList from './TeamPlayerList';

interface TeamDisplayProps {
  teamNumber: number;
  players: Player[];
  showVsDivider?: boolean;
}

const TeamDisplay: React.FC<TeamDisplayProps> = ({
  teamNumber,
  players,
  showVsDivider = false,
}) => {
  return (
    <>
      <div className="team">
        <div className="team-label">Team {teamNumber}</div>
        <div className="team-players">
          <TeamPlayerList players={players} />
        </div>
      </div>
      {showVsDivider && <div className="vs-divider">VS</div>}
    </>
  );
};

export default TeamDisplay;