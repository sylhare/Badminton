import React from 'react';

interface CourtSettingsProps {
  numberOfCourts: number;
  onNumberOfCourtsChange: (courts: number) => void;
  onGenerateAssignments: () => void;
  hasPlayers: boolean;
}

const CourtSettings: React.FC<CourtSettingsProps> = ({
  numberOfCourts,
  onNumberOfCourtsChange,
  onGenerateAssignments,
  hasPlayers,
}) => {
  const handleCourtsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (value > 0 && value <= 20) {
      onNumberOfCourtsChange(value);
    }
  };

  return (
    <div className="court-settings">
      <div className="court-input-group">
        <label htmlFor="courts">Number of Courts:</label>
        <input
          id="courts"
          type="number"
          min="1"
          max="20"
          value={numberOfCourts}
          onChange={handleCourtsChange}
          className="court-input"
        />
      </div>

      <button
        onClick={onGenerateAssignments}
        disabled={!hasPlayers}
        className="generate-button"
        data-testid="generate-assignments-button"
      >
        🎲 Generate Random Assignments
      </button>

      <div style={{ fontSize: '0.9rem', color: '#718096', maxWidth: '400px' }}>
        <p>
          <strong>How it works:</strong> Players will be randomly assigned to courts.
          Doubles (4 players) is preferred, but singles (2 players) will be used for odd numbers.
          Extra players will be benched.
        </p>
      </div>
    </div>
  );
};

export default CourtSettings;