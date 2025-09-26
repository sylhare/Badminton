import React, { useState } from 'react';

import { Player } from '../App';

import ConfirmModal from './ConfirmModal';

interface PlayerListProps {
  players: Player[];
  onPlayerToggle: (playerId: string) => void;
  onRemovePlayer: (playerId: string) => void;
  onClearAllPlayers: () => void;
}

const PlayerList: React.FC<PlayerListProps> = ({
  players,
  onPlayerToggle,
  onRemovePlayer,
  onClearAllPlayers,
}) => {
  const [showClearModal, setShowClearModal] = useState(false);

  const presentCount = players.filter(p => p.isPresent).length;
  const totalCount = players.length;

  const handleClearAll = () => {
    onClearAllPlayers();
    setShowClearModal(false);
  };

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
            <div className="player-toggle-section">
              <input
                type="checkbox"
                checked={player.isPresent}
                onChange={() => onPlayerToggle(player.id)}
                className="player-checkbox"
                title={player.isPresent ? 'Uncheck to exclude from games' : 'Check to include in games'}
              />
              <span className="player-name">{player.name}</span>
            </div>
            <button
              onClick={() => onRemovePlayer(player.id)}
              className="remove-button"
              title="Delete player permanently"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 4V2C7 1.45 7.45 1 8 1H16C16.55 1 17 1.45 17 2V4H20C20.55 4 21 4.45 21 5S20.55 6 20 6H19V19C19 20.1 18.1 21 17 21H7C5.9 21 5 20.1 5 19V6H4C3.45 6 3 5.55 3 5S3.45 4 4 4H7ZM9 3V4H15V3H9ZM7 6V19H17V6H7Z" />
                <path d="M9 8V17H11V8H9ZM13 8V17H15V8H13Z" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {totalCount > 0 && (
        <button
          onClick={() => setShowClearModal(true)}
          className="clear-all-button"
          title="Remove all players and reset scores"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 4V2C7 1.45 7.45 1 8 1H16C16.55 1 17 1.45 17 2V4H20C20.55 4 21 4.45 21 5S20.55 6 20 6H19V19C19 20.1 18.1 21 17 21H7C5.9 21 5 20.1 5 19V6H4C3.45 6 3 5.55 3 5S3.45 4 4 4H7ZM9 3V4H15V3H9ZM7 6V19H17V6H7Z" />
            <path d="M9 8V17H11V8H9ZM13 8V17H15V8H13Z" />
          </svg>
          Clear All Players
        </button>
      )}

      <ConfirmModal
        isOpen={showClearModal}
        title="Clear All Players"
        message="Are you sure you want to remove all players? This will also reset all scores and game history. This action cannot be undone."
        confirmText="Clear All"
        cancelText="Cancel"
        onConfirm={handleClearAll}
        onCancel={() => setShowClearModal(false)}
        isDestructive={true}
      />
    </div>
  );
};

export default PlayerList;