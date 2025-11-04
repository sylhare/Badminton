import React, { useState } from 'react';

import { validatePlayerNames } from '../utils/playerUtils';
import { useAnalytics } from '../hooks/useAnalytics';

import ImageUpload from './ImageUpload';

interface ManualPlayerEntryProps {
  onPlayersAdded: (players: string[]) => void;
  onPlayersExtracted: (players: string[]) => void;
}

const ManualPlayerEntry: React.FC<ManualPlayerEntryProps> = ({ onPlayersAdded, onPlayersExtracted }) => {
  const { trackPlayerAction } = useAnalytics();
  const [playerText, setPlayerText] = useState('');
  const [singlePlayerName, setSinglePlayerName] = useState('');
  const [isImageUploadExpanded, setIsImageUploadExpanded] = useState(false);

  const handleSubmit = (playerNames: string[], resetState: () => void) => {
    const validNames = validatePlayerNames(playerNames);
    if (validNames.length > 0) {
      onPlayersAdded(validNames);
      resetState();
    }
  };

  const handleBulkAdd = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (playerText.trim()) {
      const players = playerText.split(/[\n,]+/);
      const validNames = validatePlayerNames(players);
      trackPlayerAction('add_players', { method: 'manual-bulk', count: validNames.length });
      handleSubmit(players, () => setPlayerText(''));
    }
  };

  const handleSingleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (singlePlayerName.trim()) {
      trackPlayerAction('add_player', { method: 'manual-single', count: 1 });
      handleSubmit([singlePlayerName], () => setSinglePlayerName(''));
    }
  };

  return (
    <div className="manual-entry-container">
      <div className="image-upload-collapsible">
        <div
          className="collapsible-header"
          onClick={() => setIsImageUploadExpanded(!isImageUploadExpanded)}
          data-testid="image-upload-toggle"
        >
          <span>📸 Add users with a picture</span>
          <span className="toggle-icon">{isImageUploadExpanded ? '−' : '+'}</span>
        </div>
        {isImageUploadExpanded && (
          <div className="collapsible-content">
            <ImageUpload onPlayersExtracted={onPlayersExtracted} />
          </div>
        )}
      </div>

      <div className="manual-entry-section">
        <h3>✍️ Add Single Player</h3>
        <form onSubmit={handleSingleAdd} className="single-player-form">
          <input
            type="text"
            value={singlePlayerName}
            onChange={(e) => setSinglePlayerName(e.target.value)}
            placeholder="Enter player name..."
            className="single-player-input"
            data-testid="single-player-input"
            autoComplete="off"
            autoCapitalize="words"
            autoCorrect="off"
            spellCheck="false"
          />
          <button type="submit" className="add-single-button" data-testid="add-single-button">
            Add Player
          </button>
        </form>
      </div>

      <div className="manual-entry-section">
        <h3>📝 Add Multiple Players</h3>
        <p className="instruction-text">
          Enter multiple names separated by commas or new lines:
        </p>
        <form onSubmit={handleBulkAdd} className="bulk-add-form">
          <textarea
            value={playerText}
            onChange={(e) => setPlayerText(e.target.value)}
            placeholder="John Doe, Jane Smith, Mike Johnson&#10;Or one name per line:&#10;Alice Brown&#10;Bob Wilson&#10;Sarah Davis"
            className="bulk-input"
            rows={6}
            data-testid="bulk-input"
            autoComplete="off"
            autoCapitalize="words"
            autoCorrect="off"
            spellCheck="false"
          />
          <button type="submit" className="add-bulk-button" data-testid="add-bulk-button">
            Add All Players
          </button>
        </form>
      </div>
    </div>
  );
};

export default ManualPlayerEntry;