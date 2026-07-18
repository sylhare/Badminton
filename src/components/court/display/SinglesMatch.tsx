import React from 'react';

import type { Player } from '../../../types';
import type { SlotBinding } from '../edit/slotBinding';

interface SinglesMatchProps {
  team1Player: Player;
  team2Player: Player;
  waitingPlayer?: Player;
  winner?: 1 | 2;
  isAnimating?: boolean;
  onPlayerClick?: (event: React.MouseEvent<HTMLDivElement>, teamNumber: number) => void;
  isClickable?: boolean;
  team1Binding?: SlotBinding;
  team2Binding?: SlotBinding;
}

const SinglesMatch: React.FC<SinglesMatchProps> = ({
  team1Player,
  team2Player,
  waitingPlayer,
  winner,
  isAnimating = false,
  onPlayerClick,
  isClickable = false,
  team1Binding,
  team2Binding,
}) => {
  const b1 = team1Binding?.getProps(0);
  const b2 = team2Binding?.getProps(0);
  const s1 = team1Binding?.stateClass(0) ?? '';
  const s2 = team2Binding?.stateClass(0) ?? '';
  return (
    <div className="singles-match">
      <div className={`singles-players ${isAnimating ? 'animating-blur' : ''}`}>
        <div
          className={`singles-player ${isClickable ? 'singles-player-clickable' : ''} ${winner === 1 ? 'singles-player-winner' : ''}${team1Binding ? ' player-slot-draggable' : ''}${s1 ? ` ${s1}` : ''}`}
          onClick={(event) => onPlayerClick?.(event, 1)}
          data-testid="singles-player-team1"
          {...b1}
        >
          {team1Player.name}
          {winner === 1 && <span className="crown">👑</span>}
        </div>
        <div className="vs-divider">VS</div>
        <div
          className={`singles-player ${isClickable ? 'singles-player-clickable' : ''} ${winner === 2 ? 'singles-player-winner' : ''}${team2Binding ? ' player-slot-draggable' : ''}${s2 ? ` ${s2}` : ''}`}
          onClick={(event) => onPlayerClick?.(event, 2)}
          data-testid="singles-player-team2"
          {...b2}
        >
          {team2Player.name}
          {winner === 2 && <span className="crown">👑</span>}
        </div>
      </div>
      {waitingPlayer && (
        <div style={{ marginTop: '15px', fontSize: '0.9rem', color: '#718096' }}>
          <div className={isAnimating ? 'animating-blur' : ''}>
            Waiting: {waitingPlayer.name}
          </div>
        </div>
      )}
    </div>
  );
};

export default SinglesMatch;

