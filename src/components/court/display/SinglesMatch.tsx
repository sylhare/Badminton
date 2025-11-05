import React from 'react';

import type { Player } from '../../../types';

interface SinglesMatchProps {
  team1Player: Player;
  team2Player: Player;
  waitingPlayer?: Player;
  winner?: 1 | 2;
  isAnimating?: boolean;
  onPlayerClick?: (event: React.MouseEvent<HTMLDivElement>, teamNumber: number) => void;
  isClickable?: boolean;
}

const SinglesMatch: React.FC<SinglesMatchProps> = ({
  team1Player,
  team2Player,
  waitingPlayer,
  winner,
  isAnimating = false,
  onPlayerClick,
  isClickable = false,
}) => {
  return (
    <div className="singles-match">
      <div className={`singles-players ${isAnimating ? 'animating-blur' : ''}`}>
        <div
          className={`singles-player ${isClickable ? 'singles-player-clickable' : ''} ${winner === 1 ? 'singles-player-winner' : ''}`}
          onClick={(event) => onPlayerClick?.(event, 1)}
        >
          {team1Player.name}
          {winner === 1 && <span className="crown">👑</span>}
        </div>
        <div className="vs-divider">VS</div>
        <div
          className={`singles-player ${isClickable ? 'singles-player-clickable' : ''} ${winner === 2 ? 'singles-player-winner' : ''}`}
          onClick={(event) => onPlayerClick?.(event, 2)}
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

