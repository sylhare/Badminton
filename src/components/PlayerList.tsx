import React, { useState } from 'react';
import { ArrowClockwise, Pause, Play, Trash } from '@phosphor-icons/react';

import type { Player } from '../types';
import { useAnalytics } from '../hooks/useAnalytics';

import ConfirmModal from './ConfirmModal';
import PlayerEditModal from './PlayerEditModal';
import PlayerRemovalModal from './PlayerRemovalModal';

interface PlayerListProps {
  players: Player[];
  onPlayerToggle: (playerId: string) => void;
  onRemovePlayer: (playerId: string) => void;
  onClearAllPlayers: () => void;
  onResetAlgorithm: () => void;
  benchCounts?: Map<string, number>;
  forceBenchPlayerIds?: Set<string>;
  onToggleForceBench?: (playerId: string) => void;
  isSmartEngineEnabled?: boolean;
  onToggleSmartEngine?: () => void;
  onUpdatePlayer?: (id: string, sex: Player['sex'], level: number) => void;
}

const PlayerList: React.FC<PlayerListProps> = ({
  players,
  onPlayerToggle,
  onRemovePlayer,
  onClearAllPlayers,
  onResetAlgorithm,
  benchCounts,
  forceBenchPlayerIds,
  onToggleForceBench,
  isSmartEngineEnabled = false,
  onToggleSmartEngine,
  onUpdatePlayer,
}) => {
  const [showClearModal, setShowClearModal] = useState(false);
  const [showResetAlgorithmModal, setShowResetAlgorithmModal] = useState(false);
  const [playerToRemove, setPlayerToRemove] = useState<Player | null>(null);
  const [playerToEdit, setPlayerToEdit] = useState<Player | null>(null);
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

  const handleRemoveClick = (player: Player) => {
    setPlayerToRemove(player);
  };

  const handleConfirmRemove = () => {
    if (playerToRemove) {
      trackPlayerAction('remove_player');
      onRemovePlayer(playerToRemove.id);
      setPlayerToRemove(null);
    }
  };

  const handleMarkAbsent = () => {
    if (playerToRemove) {
      trackPlayerAction('toggle_player', { method: 'set-absent' });
      onPlayerToggle(playerToRemove.id);
      setPlayerToRemove(null);
    }
  };

  const handleCancelRemoval = () => {
    setPlayerToRemove(null);
  };

  const handlePlayerNameClick = (player: Player) => {
    setPlayerToEdit(player);
  };

  const handleSavePlayerEdit = (id: string, sex: Player['sex'], level: number) => {
    onUpdatePlayer?.(id, sex, level);
    setPlayerToEdit(null);
  };

  const formatBadge = (player: Player): string => {
    const parts: string[] = [];
    if (player.sex && player.sex !== 'Unknown') {
      parts.push(player.sex === 'F' ? '♀' : '♂');
    }
    if (player.level !== undefined) {
      parts.push(String(player.level));
    }
    return parts.join(' · ');
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
        {players.map(player => {
          const benchCount = benchCounts?.get(player.id) ?? 0;
          const isForceBenched = forceBenchPlayerIds?.has(player.id) ?? false;
          const badge = isSmartEngineEnabled ? formatBadge(player) : '';

          return (
            <div
              key={player.id}
              className={`player-item ${!player.isPresent ? 'absent' : ''} with-bench-info`}
            >
              <div className="player-main-row">
                <span
                  className={`player-name ${isSmartEngineEnabled ? 'player-name-clickable' : ''}`}
                  data-testid={`player-name-${player.id}`}
                  onClick={isSmartEngineEnabled ? () => handlePlayerNameClick(player) : undefined}
                  title={isSmartEngineEnabled ? 'Click to edit gender/level' : undefined}
                >
                  {player.name}
                  {badge && (
                    <span className="player-badge" data-testid={`player-badge-${player.id}`}>{badge}</span>
                  )}
                </span>
                <div className="player-action-buttons">
                  <button
                    onClick={() => handlePlayerToggle(player.id)}
                    className={`toggle-presence-button ${player.isPresent ? 'present' : 'absent'}`}
                    data-testid={`toggle-presence-${player.id}`}
                    title={player.isPresent ? 'Mark as absent' : 'Mark as present'}
                    aria-label={player.isPresent ? 'Mark as absent' : 'Mark as present'}
                  >
                    {player.isPresent ? <Pause size={14} weight="bold" /> : <Play size={14} weight="bold" />}
                  </button>
                  <button
                    onClick={() => handleRemoveClick(player)}
                    className="remove-button"
                    data-testid={`remove-player-${player.id}`}
                    title="Delete player permanently"
                  >
                    <Trash size={14} />
                  </button>
                </div>
              </div>
              {player.isPresent && (
                <div className="player-bench-row">
                  <span
                    className="bench-count-emoji"
                    title={`Bench count: ${benchCount}`}
                    data-testid={`bench-count-${player.id}`}
                  >
                    🪑 {benchCount}
                  </span>
                  <label className="bench-next-toggle">
                    <span>Bench next</span>
                    <input
                      type="checkbox"
                      checked={isForceBenched}
                      onChange={() => onToggleForceBench?.(player.id)}
                      data-testid={`force-bench-${player.id}`}
                    />
                    <span className={`toggle-switch ${isForceBenched ? 'active' : ''}`}></span>
                  </label>
                </div>
              )}
            </div>
          );
        })}
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

      <div className="smart-engine-toggle-row">
        <label className="bench-next-toggle" data-testid="smart-engine-toggle-label">
          <span>Smart Engine</span>
          <input
            type="checkbox"
            checked={isSmartEngineEnabled}
            onChange={() => onToggleSmartEngine?.()}
            data-testid="smart-engine-toggle"
          />
          <span className={`toggle-switch ${isSmartEngineEnabled ? 'active smart-engine-active' : ''}`}></span>
        </label>
      </div>

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

      <PlayerRemovalModal
        isOpen={playerToRemove !== null}
        playerName={playerToRemove?.name ?? ''}
        onRemove={handleConfirmRemove}
        onMarkAbsent={handleMarkAbsent}
        onCancel={handleCancelRemoval}
      />

      <PlayerEditModal
        player={playerToEdit}
        isOpen={playerToEdit !== null}
        onSave={handleSavePlayerEdit}
        onCancel={() => setPlayerToEdit(null)}
      />
    </div>
  );
};

export default PlayerList;
