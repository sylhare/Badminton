import React from 'react';

import { Player } from '../App';

interface TeamPlayerListProps {
  players: Player[];
  className?: string;
}

const TeamPlayerList: React.FC<TeamPlayerListProps> = ({
  players,
  className = 'team-player',
}) => {
  return (
    <>
      {players.map(player => (
        <div key={player.id} className={className}>
          {player.name}
        </div>
      ))}
    </>
  );
};

export default TeamPlayerList;