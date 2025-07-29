import React, { useState } from 'react';

interface ManualPlayerEntryProps {
  onPlayersAdded: (players: string[]) => void
}

const ManualPlayerEntry: React.FC<ManualPlayerEntryProps> = ({ onPlayersAdded }) => {
  const [playerText, setPlayerText] = useState('');
  const [singlePlayerName, setSinglePlayerName] = useState('');

  const handleBulkAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerText.trim()) {
      const players = playerText
        .split(/[\n,]+/)
        .map(name => name.trim())
        .filter(name => name.length > 0);

      if (players.length > 0) {
        onPlayersAdded(players);
        setPlayerText('');
      }
    }
  };

  const handleSingleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (singlePlayerName.trim()) {
      onPlayersAdded([singlePlayerName.trim()]);
      setSinglePlayerName('');
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