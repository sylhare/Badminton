import React from 'react';

import type { Player } from '../../../types';
import type { SlotBinding } from '../edit/slotBinding';

interface TeamPlayerListProps {
  players: Player[];
  className?: string;
  /** When provided, each player chip becomes a draggable, addressable slot. */
  slotBinding?: SlotBinding;
}

const TeamPlayerList: React.FC<TeamPlayerListProps> = ({
  players,
  className = 'team-player',
  slotBinding,
}) => {
  return (
    <>
      {players.map((player, index) => {
        const extra = slotBinding?.getProps(index);
        const stateClass = slotBinding?.stateClass(index) ?? '';
        return (
          <div
            key={player.id}
            className={`${className}${slotBinding ? ' player-slot-draggable' : ''}${stateClass ? ` ${stateClass}` : ''}`}
            {...extra}
          >
            {player.name}
          </div>
        );
      })}
    </>
  );
};

export default TeamPlayerList;
