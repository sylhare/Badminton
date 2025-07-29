import React from 'react';

import { Player } from '../App';

interface PlayerListProps {
  players: Player[]
  onPlayerToggle: (playerId: string) => void
  onRemovePlayer: (playerId: string) => void
}

const PlayerList: React.FC<PlayerListProps> = ({
  players,
  onPlayerToggle,
  onRemovePlayer,
}) => {

  const presentCount = players.filter(p => p.isPresent).length;
  const totalCount = players.length;

  return (
    <div>
      <div className="player-stats">
        <div className="stats-item">
          <div className="stats-number">{presentCount}</div>
          <div>Present</div>
        </div>
        <div className="stats-item">
          <div className="stats-number">{totalCount - presentCount}</div>
          <div>Absent</div>
        </div>
        <div className="stats-item">
          <div className="stats-number">{totalCount}</div>
          <div>Total</div>
        </div>
      </div>

      <div className="player-list">
        {players.map(player => (
          <div
            key={player.id}
            className={`player-item ${!player.isPresent ? 'absent' : ''}`}
          >
            <input
              type="checkbox"
              checked={player.isPresent}
              onChange={() => onPlayerToggle(player.id)}
              className="player-checkbox"
            />
            <span className="player-name">{player.name}</span>
            <button
              onClick={() => onRemovePlayer(player.id)}
              className="remove-button"
              title="Remove player"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlayerList;