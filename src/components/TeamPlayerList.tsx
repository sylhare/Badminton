import React from 'react';

import type { Player } from '../types';

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