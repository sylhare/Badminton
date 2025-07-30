import React, { useState } from 'react';

import { validatePlayerNames } from '../utils/playerUtils';

interface ManualPlayerEntryProps {
  onPlayersAdded: (players: string[]) => void;
}

const ManualPlayerEntry: React.FC<ManualPlayerEntryProps> = ({ onPlayersAdded }) => {
  const [playerText, setPlayerText] = useState('');
  const [singlePlayerName, setSinglePlayerName] = useState('');

  const handleSubmit = (playerNames: string[], resetState: () => void) => {
    const validNames = validatePlayerNames(playerNames);
    if (validNames.length > 0) {
      onPlayersAdded(validNames);
      resetState();
    }
  };

  const handleBulkAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerText.trim()) {
      const players = playerText.split(/[\n,]+/);
      handleSubmit(players, () => setPlayerText(''));
    }
  };

  const handleSingleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (singlePlayerName.trim()) {
      handleSubmit([singlePlayerName], () => setSinglePlayerName(''));
    }
  };

  return (
    <div className="manual-entry-container">
      <div className="manual-entry-section">
        <h3>✍️ Add Single Player</h3>
        <form onSubmit={handleSingleAdd} className="single-player-form">
          <input
            type="text"
            value={singlePlayerName}
            onChange={(e) => setSinglePlayerName(e.target.value)}
            placeholder="Enter player name..."
            className="single-player-input"
          />
          <button type="submit" className="add-single-button">
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
          />
          <button type="submit" className="add-bulk-button">
            Add All Players
          </button>
        </form>
      </div>
    </div>
  );
};

export default ManualPlayerEntry;