import React, { useState } from 'react';
import { Camera, UserPlus } from '@phosphor-icons/react';

import { validatePlayerNames } from '../utils/playerUtils';
import { useAnalytics } from '../hooks/useAnalytics';

import ImageUploadModal from './ImageUploadModal';

interface ManualPlayerEntryProps {
  onPlayersAdded: (players: string[]) => void;
}

const ManualPlayerEntry: React.FC<ManualPlayerEntryProps> = ({ onPlayersAdded }) => {
  const { trackPlayerAction } = useAnalytics();
  const [playerInput, setPlayerInput] = useState('');
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!playerInput.trim()) return;

    // Detect backticks for multi-player add
    const hasBackticks = playerInput.includes('`');
    let playerNames: string[];

    if (hasBackticks) {
      // Split by backticks and filter empty entries
      playerNames = playerInput
        .split('`')
        .map(name => name.trim())
        .filter(name => name.length > 0);
    } else {
      // Check if input contains commas or newlines for bulk add
      const hasSeparators = /[,\n]/.test(playerInput);
      if (hasSeparators) {
        playerNames = playerInput.split(/[,\n]+/);
      } else {
        playerNames = [playerInput];
      }
    }

    const validNames = validatePlayerNames(playerNames);
    if (validNames.length > 0) {
      const method = validNames.length > 1 ? 'manual-bulk' : 'manual-single';
      trackPlayerAction('add_players', { method, count: validNames.length });
      onPlayersAdded(validNames);
      setPlayerInput('');
    }
  };

  const handleImagePlayersAdded = (players: string[]) => {
    onPlayersAdded(players);
  };

  // Check if input suggests multiple players
  const isMultiInput = playerInput.includes('`') || /[,\n]/.test(playerInput);
  const playerCount = isMultiInput
    ? playerInput.split(/[`\n,]+/).filter(s => s.trim()).length
    : playerInput.trim() ? 1 : 0;

  return (
    <div className="player-entry-container">
      <form onSubmit={handleSubmit} className="player-entry-form">
        <div className="player-input-wrapper">
          <input
            type="text"
            value={playerInput}
            onChange={(e) => setPlayerInput(e.target.value)}
            placeholder="Enter player name (use ` or , to add multiple)"
            className="player-entry-input"
            data-testid="player-entry-input"
            autoComplete="off"
            autoCapitalize="words"
            autoCorrect="off"
            spellCheck="false"
          />
        </div>
        <div className="player-entry-actions">
          <button
            type="button"
            className="camera-button"
            onClick={() => setIsImageModalOpen(true)}
            title="Import players from image"
            data-testid="open-image-modal-button"
          >
            <Camera size={20} weight="bold" />
          </button>
          <button
            type="submit"
            className="add-player-button"
            disabled={!playerInput.trim()}
            data-testid="add-player-button"
          >
            <UserPlus size={18} weight="bold" />
            {isMultiInput && playerCount > 1 ? `Add ${playerCount} Players` : 'Add Player'}
          </button>
        </div>
      </form>

      {isMultiInput && playerCount > 1 && (
        <p className="multi-input-hint">
          💡 Detected {playerCount} players separated by {playerInput.includes('`') ? 'backticks' : 'commas/newlines'}
        </p>
      )}

      <ImageUploadModal
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        onPlayersAdded={handleImagePlayersAdded}
      />
    </div>
  );
};

export default ManualPlayerEntry;
