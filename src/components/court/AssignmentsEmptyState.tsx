import React from 'react';

import { cx } from '../common/cx';

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
  if (hasAssignments) return null;

  return (
    <div className={hasPlayers ? 'no-assignments-hint' : 'no-players-hint'}>
      <p>
        {hasPlayers ? (
          <>
            <strong>How it works:</strong> Players will be randomly assigned to courts.
            Doubles (4 players) is preferred, but singles (2 players) will be used for odd numbers.
            Extra players will be benched.
          </>
        ) : (
          'Add some players above to start generating court assignments.'
        )}
      </p>
      <button
        onClick={hasPlayers ? onGenerate : undefined}
        disabled={!hasPlayers}
        className={cx('generate-button', isButtonShaking && 'button-shake')}
        data-testid="generate-assignments-button"
      >
        🎲 Generate Assignments
      </button>
    </div>
  );
};

export default React.memo(AssignmentsEmptyState);
