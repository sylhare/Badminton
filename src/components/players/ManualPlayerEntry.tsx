import React, { useState } from 'react';
import { Camera, UserPlus } from '@phosphor-icons/react';

import { parsePlayerInput } from '../../utils/playerUtils';
import { useAnalytics } from '../../hooks/useAnalytics';
import ImageUploadModal from '../modals/ImageUploadModal';

interface ManualPlayerEntryProps {
  onPlayersAdded: (players: string[]) => void;
}

const ManualPlayerEntry: React.FC<ManualPlayerEntryProps> = ({ onPlayersAdded }) => {
  const { trackPlayerAction } = useAnalytics();
  const [playerInput, setPlayerInput] = useState('');
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  const { names, separator } = parsePlayerInput(playerInput);
  const playerCount = names.length;
  const isMultiInput = separator !== null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (names.length === 0) return;

    const method = names.length > 1 ? 'manual-bulk' : 'manual-single';
    trackPlayerAction('add_players', { method, count: names.length });
    onPlayersAdded(names);
    setPlayerInput('');
  };

  const handleImagePlayersAdded = (players: string[]) => {
    onPlayersAdded(players);
  };

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
          💡 Detected {playerCount} players separated by {separator}
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
