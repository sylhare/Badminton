import React, { useState } from 'react';
import { Trash, ArrowClockwise, SignIn, SignOut } from '@phosphor-icons/react';

import type { Player } from '../types';
import { useAnalytics } from '../hooks/useAnalytics';

import ConfirmModal from './ConfirmModal';

interface PlayerListProps {
  players: Player[];
  onPlayerToggle: (playerId: string) => void;
  onRemovePlayer: (playerId: string) => void;
  onClearAllPlayers: () => void;
  onResetAlgorithm: () => void;
}

const PlayerList: React.FC<PlayerListProps> = ({
  players,
  onPlayerToggle,
  onRemovePlayer,
  onClearAllPlayers,
  onResetAlgorithm,
}) => {
  const [showClearModal, setShowClearModal] = useState(false);
  const [showResetAlgorithmModal, setShowResetAlgorithmModal] = useState(false);
  const { trackPlayerAction, trackGameAction } = useAnalytics();

  const presentCount = players.filter(p => p.isPresent).length;
  const totalCount = players.length;

  const handleClearAll = () => {
    trackPlayerAction('clear_all_players', { count: players.length });
    onClearAllPlayers();
    setShowClearModal(false);
  };

  const handleResetAlgorithm = () => {
    trackGameAction('reset_algorithm');
    onResetAlgorithm();
    setShowResetAlgorithmModal(false);
  };

  const handlePlayerToggle = (playerId: string) => {
    const player = players.find(p => p.id === playerId);
    if (player) {
      trackPlayerAction('toggle_player', { method: player.isPresent ? 'set-absent' : 'set-present' });
    }
    onPlayerToggle(playerId);
  };

  const handleRemovePlayer = (playerId: string) => {
    trackPlayerAction('remove_player');
    onRemovePlayer(playerId);
  };

  return (
    <div>
      <div className="player-stats" data-testid="player-stats">
        <div className="stats-item" data-testid="stats-present">
          <div className="stats-number" data-testid="stats-present-count">{presentCount}</div>
          <div>Present</div>
        </div>
        <div className="stats-item" data-testid="stats-absent">
          <div className="stats-number" data-testid="stats-absent-count">{totalCount - presentCount}</div>
          <div>Absent</div>
        </div>
        <div className="stats-item" data-testid="stats-total">
          <div className="stats-number" data-testid="stats-total-count">{totalCount}</div>
          <div>Total</div>
        </div>
      </div>

      <div className="player-list">
        {players.map(player => (
          <div
            key={player.id}
            className={`player-item ${!player.isPresent ? 'absent' : ''}`}
          >
            <span className="player-name" data-testid={`player-name-${player.id}`}>{player.name}</span>
            <div className="player-action-buttons">
              <button
                onClick={() => handlePlayerToggle(player.id)}
                className={`toggle-presence-button ${player.isPresent ? 'present' : 'absent'}`}
                data-testid={`toggle-presence-${player.id}`}
                title={player.isPresent ? 'Mark as absent' : 'Mark as present'}
                aria-label={player.isPresent ? 'Mark as absent' : 'Mark as present'}
              >
                {player.isPresent ? <SignOut size={14} weight="bold" /> : <SignIn size={14} weight="bold" />}
              </button>
              <button
                onClick={() => handleRemovePlayer(player.id)}
                className="remove-button"
                data-testid={`remove-player-${player.id}`}
                title="Delete player permanently"
              >
                <Trash size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {totalCount > 0 && (
        <div className="player-actions">
          <button
            onClick={() => setShowResetAlgorithmModal(true)}
            className="reset-algorithm-button"
            data-testid="reset-algorithm-button"
            title="Reset who played with who history (keeps all players)"
          >
            <ArrowClockwise size={16} />
            Reset Algorithm
          </button>
          <button
            onClick={() => setShowClearModal(true)}
            className="clear-all-button"
            data-testid="clear-all-button"
            title="Remove all players and reset scores"
          >
            <Trash size={16} />
            Clear All Players
          </button>
        </div>
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

      <ConfirmModal
        isOpen={showResetAlgorithmModal}
        title="Reset Algorithm"
        message="Are you sure you want to reset the algorithm's memory? This will clear all records of who played with who, bench counts, and win/loss history. Players will remain but pairing preferences will be reset."
        confirmText="Reset Algorithm"
        cancelText="Cancel"
        onConfirm={handleResetAlgorithm}
        onCancel={() => setShowResetAlgorithmModal(false)}
        isDestructive={false}
      />
    </div>
  );
};

export default PlayerList;