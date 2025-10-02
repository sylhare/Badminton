import React, { useState } from 'react';
import type { Player, ManualCourtSelection } from '../App';

interface ManualCourtSelectionProps {
  players: Player[];
  onManualCourtChange: (manualCourt: ManualCourtSelection | null) => void;
  currentSelection: ManualCourtSelection | null;
}

const ManualCourtSelectionComponent: React.FC<ManualCourtSelectionProps> = ({
  players,
  onManualCourtChange,
  currentSelection
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const presentPlayers = players.filter(p => p.isPresent);
  const selectedPlayerIds = new Set(currentSelection?.players.map(p => p.id) || []);

  const handlePlayerToggle = (player: Player) => {
    const isSelected = selectedPlayerIds.has(player.id);
    let newSelectedPlayers: Player[];

    if (isSelected) {
      newSelectedPlayers = currentSelection?.players.filter(p => p.id !== player.id) || [];
    } else {
      if (selectedPlayerIds.size >= 4) {
        return; // Max 4 players
      }
      newSelectedPlayers = [...(currentSelection?.players || []), player];
    }

    if (newSelectedPlayers.length === 0) {
      onManualCourtChange(null);
    } else {
      onManualCourtChange({ players: newSelectedPlayers });
    }
  };

  const clearSelection = () => {
    onManualCourtChange(null);
  };

  if (presentPlayers.length < 2) {
    return null; // Need at least 2 players to form a manual court
  }

  return (
    <div className="manual-court-selection" data-testid="manual-court-selection">
      <div className="manual-court-header" onClick={() => setIsExpanded(!isExpanded)} data-testid="manual-court-header">
        <h3>⚙️ Manual Court Assignment (Optional)</h3>
        <div className="manual-court-toggle">
          {isExpanded ? '▼' : '▶'}
        </div>
      </div>
      
      {isExpanded && (
        <div className="manual-court-content">
          <p className="manual-court-description">
            Select 2-4 players to play together on Court 1. The rest will be assigned automatically.
          </p>
          
          {currentSelection && currentSelection.players.length > 0 && (
            <div className="manual-court-selected">
              <div className="selected-players">
                <strong>Selected for Court 1:</strong>
                <div className="selected-player-list">
                  {currentSelection.players.map(player => (
                    <span key={player.id} className="selected-player-tag">
                      {player.name}
                      <button
                        onClick={() => handlePlayerToggle(player)}
                        className="remove-selected-player"
                        title="Remove from manual court"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
              <button onClick={clearSelection} className="clear-manual-selection" data-testid="clear-manual-selection">
                Clear Selection
              </button>
            </div>
          )}

          <div className="player-selection-grid">
            {presentPlayers.map(player => {
              const isSelected = selectedPlayerIds.has(player.id);
              const isDisabled = !isSelected && selectedPlayerIds.size >= 4;
              
              return (
                <button
                  key={player.id}
                  onClick={() => handlePlayerToggle(player)}
                  disabled={isDisabled}
                  className={`player-selection-button ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                  data-testid={`manual-court-player-${player.id}`}
                >
                  <span className="player-selection-checkbox">
                    {isSelected ? '✓' : ''}
                  </span>
                  <span className="player-selection-name">{player.name}</span>
                </button>
              );
            })}
          </div>

          <div className="manual-court-info">
            <div className="selection-count">
              {selectedPlayerIds.size}/4 players selected
            </div>
            {selectedPlayerIds.size >= 2 && (
              <div className="match-preview">
                {selectedPlayerIds.size === 2 && "Will create: Singles match"}
                {selectedPlayerIds.size === 3 && "Will create: Singles match (1 waiting)"}
                {selectedPlayerIds.size === 4 && "Will create: Doubles match"}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ManualCourtSelectionComponent;
