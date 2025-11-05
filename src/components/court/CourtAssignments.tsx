import React, { useState } from 'react';

import type { Court, Player, WinnerSelection } from '../../types';
import { useAnalytics } from '../../hooks/useAnalytics';

import { CourtCard } from './card';
import { TeamPlayerList } from './team';

interface CourtAssignmentsProps {
  assignments: Court[];
  benchedPlayers: Player[];
  onGenerateNewAssignments: () => void;
  onWinnerChange?: (courtNumber: number, winner: WinnerSelection) => void;
  hasManualCourtSelection?: boolean;
}

const CourtAssignments: React.FC<CourtAssignmentsProps> = ({
  assignments,
  benchedPlayers,
  onGenerateNewAssignments,
  onWinnerChange,
  hasManualCourtSelection = false,
}) => {
  const { trackCourtAction } = useAnalytics();
  const [isAnimating, setIsAnimating] = useState(false);
  const [isButtonShaking, setIsButtonShaking] = useState(false);

  const handleGenerateNewAssignments = () => {
    setIsButtonShaking(true);
    setIsAnimating(true);
    trackCourtAction('regenerate_assignments', { courtCount: assignments.length });

    setTimeout(() => {
      setIsButtonShaking(false);
      onGenerateNewAssignments();

      setTimeout(() => {
        setIsAnimating(false);
      }, 400);
    }, 200);
  };

  const handleWinnerChange = (courtNumber: number, teamNumber: number) => {
    if (onWinnerChange) {
      const court = assignments.find(c => c.courtNumber === courtNumber);
      if (court) {
        const newWinner = court.winner === teamNumber ? undefined : (teamNumber as 1 | 2);
        onWinnerChange(courtNumber, newWinner);
      }
    }
  };

  return (
    <div>
      <div className="courts-grid">
        {assignments.map((court) => {
          const isManualCourt = (court as any).wasManuallyAssigned || (hasManualCourtSelection && court.courtNumber === 1);
          return (
            <CourtCard
              key={court.courtNumber}
              court={court}
              onWinnerChange={handleWinnerChange}
              isManualCourt={isManualCourt}
              isAnimating={isAnimating}
            />
          );
        })}
      </div>

      {benchedPlayers.length > 0 && (
        <div className={`bench-section ${isAnimating ? 'animating-blur' : ''}`}>
          <div className="bench-header">
            🪑 Bench ({benchedPlayers.length} player{benchedPlayers.length !== 1 ? 's' : ''})
          </div>
          <div className="bench-players">
            <TeamPlayerList players={benchedPlayers} className="bench-player" />
          </div>
        </div>
      )}

      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <button
          onClick={handleGenerateNewAssignments}
          className={`generate-button ${isButtonShaking ? 'button-shake' : ''}`}
          data-testid="generate-new-assignments-button"
          disabled={isButtonShaking}
        >
          🎲 Generate New Assignments
        </button>
      </div>

      {onWinnerChange && (
        <div className="winner-instructions">
          💡 <strong>Tip:</strong> Click on a team to mark them as the winner. A crown 👑 will appear next to the winning
          team. Click again to remove the winner.
        </div>
      )}
    </div>
  );
};

export default CourtAssignments;