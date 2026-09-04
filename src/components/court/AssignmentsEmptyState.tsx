import React from 'react';

interface AssignmentsEmptyStateProps {
  hasAssignments: boolean;
  hasPlayers: boolean;
  isButtonShaking: boolean;
  onGenerate: () => void;
}

const AssignmentsEmptyState: React.FC<AssignmentsEmptyStateProps> = ({
  hasAssignments,
  hasPlayers,
  isButtonShaking,
  onGenerate,
}) => {
  if (hasPlayers) {
    if (hasAssignments) return null;
    return (
      <div className="no-assignments-hint">
        <p>
          <strong>How it works:</strong> Players will be randomly assigned to courts.
          Doubles (4 players) is preferred, but singles (2 players) will be used for odd numbers.
          Extra players will be benched.
        </p>
        <button
          onClick={onGenerate}
          className={`generate-button ${isButtonShaking ? 'button-shake' : ''}`}
          data-testid="generate-assignments-button"
        >
          🎲 Generate Assignments
        </button>
      </div>
    );
  }

  return (
    <div className="no-players-hint">
      <p>Add some players above to start generating court assignments.</p>
      <button
        disabled
        className="generate-button"
        data-testid="generate-assignments-button"
      >
        🎲 Generate Assignments
      </button>
    </div>
  );
};

export default AssignmentsEmptyState;
