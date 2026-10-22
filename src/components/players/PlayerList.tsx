import React, { useState } from 'react';
import { ArrowClockwise, Pause, Play, ShareNetwork, Trash } from '@phosphor-icons/react';

import type { Player } from '../../types';
import { useAnalytics } from '../../hooks/useAnalytics';
import { useTranslation } from '../../i18n';
import ConfirmModal from '../modals/ConfirmModal';
import PlayerEditModal from '../modals/PlayerEditModal';
import PlayerRemovalModal from '../modals/PlayerRemovalModal';
import { Tooltip } from '../Tooltip';

interface PlayerListProps {
  players: Player[];
  onPlayerToggle: (playerId: string) => void;
  onRemovePlayer: (playerId: string) => void;
  onClearAllPlayers: () => void;
  onResetAlgorithm: () => void;
  benchCounts?: Map<string, number>;
  forceBenchPlayerIds?: Set<string>;
  onToggleForceBench?: (playerId: string) => void;
  onToggleSmartEngine?: () => void;
  isSmartEngineEnabled?: boolean;
  onUpdatePlayer?: (id: string, gender: Player['gender'], level: number) => void;
  onShare?: () => void;
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
  onToggleSmartEngine,
  isSmartEngineEnabled = false,
  onUpdatePlayer,
  onShare,
}) => {
  const [showClearModal, setShowClearModal] = useState(false);
  const [showResetAlgorithmModal, setShowResetAlgorithmModal] = useState(false);
  const [playerToRemove, setPlayerToRemove] = useState<Player | null>(null);
  const [playerToEdit, setPlayerToEdit] = useState<Player | null>(null);
  const { trackPlayerAction, trackGameAction, trackUIAction } = useAnalytics();
  const { t } = useTranslation();

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

  const handleSavePlayerEdit = (id: string, gender: Player['gender'], level: number) => {
    onUpdatePlayer?.(id, gender, level);
    setPlayerToEdit(null);
  };

  const formatBadge = (player: Player): string => {
    const parts: string[] = [];
    if (player.gender && player.gender !== 'Unknown') {
      parts.push(player.gender === 'F' ? '💁‍♀️' : '🙋‍♂️');
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
          <div>{t('players.present')}</div>
        </div>
        <div className="stats-item" data-testid="stats-absent">
          <div className="stats-number" data-testid="stats-absent-count">{totalCount - presentCount}</div>
          <div>{t('players.absent')}</div>
        </div>
        <div className="stats-item" data-testid="stats-total">
          <div className="stats-number" data-testid="stats-total-count">{totalCount}</div>
          <div>{t('players.total')}</div>
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
                  title={isSmartEngineEnabled ? t('players.editPrompt') : undefined}
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
                    title={player.isPresent ? t('players.markAbsent') : t('players.markPresent')}
                    aria-label={player.isPresent ? t('players.markAbsent') : t('players.markPresent')}
                  >
                    {player.isPresent ? <Pause size={14} weight="bold" /> : <Play size={14} weight="bold" />}
                  </button>
                  <button
                    onClick={() => handleRemoveClick(player)}
                    className="remove-button"
                    data-testid={`remove-player-${player.id}`}
                    title={t('players.deletePermanently')}
                  >
                    <Trash size={14} />
                  </button>
                </div>
              </div>
              {player.isPresent && (
                <div className="player-bench-row">
                  <span
                    className="bench-count-emoji"
                    title={t('players.benchCount', { count: benchCount })}
                    data-testid={`bench-count-${player.id}`}
                  >
                    🪑 {benchCount}
                  </span>
                  <label className="bench-next-toggle">
                    <span>{t('players.benchNext')}</span>
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
            title={t('players.resetAlgorithmTooltip')}
          >
            <ArrowClockwise size={16} />
            {t('players.resetAlgorithm')}
          </button>
          <button
            onClick={() => setShowClearModal(true)}
            className="clear-all-button"
            data-testid="clear-all-button"
            title={t('players.clearAllTooltip')}
          >
            <Trash size={16} />
            {t('players.clearAll')}
          </button>
          <button
            onClick={onShare}
            className="share-button"
            data-testid="share-button"
            title={t('players.shareTooltip')}
          >
            <ShareNetwork size={16} />
            {t('players.share')}
          </button>
        </div>
      )}

      <div className="smart-engine-toggle-row">
        <label className="bench-next-toggle" data-testid="smart-engine-toggle-label">
          <span>{t('players.smartEngine')}</span>
          <input
            type="checkbox"
            checked={isSmartEngineEnabled}
            onChange={() => {
              trackUIAction('toggle_smart_engine', { section: isSmartEngineEnabled ? 'disable' : 'enable' });
              onToggleSmartEngine?.();
            }}
            data-testid="smart-engine-toggle"
          />
          <span className={`toggle-switch ${isSmartEngineEnabled ? 'active smart-engine-active' : ''}`}></span>
        </label>
        <Tooltip testId="smart-engine" text={t('players.smartEngineTooltip')} />
      </div>

      <ConfirmModal
        isOpen={showClearModal}
        title={t('players.clearTitle')}
        message={t('players.clearMessage')}
        confirmText={t('players.clearConfirm')}
        cancelText={t('common.cancel')}
        onConfirm={handleClearAll}
        onCancel={() => setShowClearModal(false)}
        isDestructive={true}
      />

      <ConfirmModal
        isOpen={showResetAlgorithmModal}
        title={t('players.resetTitle')}
        message={t('players.resetMessage')}
        confirmText={t('players.resetAlgorithm')}
        cancelText={t('common.cancel')}
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
