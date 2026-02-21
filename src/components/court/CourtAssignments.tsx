import React, { useEffect, useState } from 'react';

import type { Court, ManualCourtSelection, Player, WinnerSelection } from '../../types';
import { useAnalytics } from '../../hooks/useAnalytics';
import ManualCourtModal from '../ManualCourtModal';

import { CourtCard } from './card';
import { TeamPlayerList } from './team';

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

export function formatTimeAgo(timestampMs: number): string {
  const diffMs = Date.now() - timestampMs;
  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 1) return 'just now';
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}min ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

interface CourtAssignmentsProps {
  players: Player[];
  assignments: Court[];
  benchedPlayers: Player[];
  numberOfCourts: number;
  onNumberOfCourtsChange: (courts: number) => void;
  onGenerateAssignments: () => void;
  onWinnerChange?: (courtNumber: number, winner: WinnerSelection) => void;
  hasManualCourtSelection?: boolean;
  onViewBenchCounts?: () => void;
  manualCourtSelection: ManualCourtSelection | null;
  onManualCourtSelectionChange: (selection: ManualCourtSelection | null) => void;
  lastGeneratedAt?: number;
}

const CourtAssignments: React.FC<CourtAssignmentsProps> = ({
  players,
  assignments,
  benchedPlayers,
  numberOfCourts,
  onNumberOfCourtsChange,
  onGenerateAssignments,
  onWinnerChange,
  hasManualCourtSelection = false,
  onViewBenchCounts,
  manualCourtSelection,
  onManualCourtSelectionChange,
  lastGeneratedAt,
}) => {
  const { trackCourtAction } = useAnalytics();
  const [isAnimating, setIsAnimating] = useState(false);
  const [isButtonShaking, setIsButtonShaking] = useState(false);
  const [, setTick] = useState(0);
  const [isManualCourtModalOpen, setIsManualCourtModalOpen] = useState(false);
  const [courtInputValue, setCourtInputValue] = useState(String(numberOfCourts));

  useEffect(() => {
    setCourtInputValue(String(numberOfCourts));
  }, [numberOfCourts]);

  useEffect(() => {
    if (!lastGeneratedAt) return;
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [lastGeneratedAt]);

  const hasPlayers = players.some(p => p.isPresent);
  const hasAssignments = assignments.length > 0;
  const isRecentAssignment = lastGeneratedAt !== undefined && (Date.now() - lastGeneratedAt) < TWO_DAYS_MS;
  const presentPlayerCount = players.filter(p => p.isPresent).length;
  const hasManualSelection = manualCourtSelection && manualCourtSelection.players.length > 0;

  const handleCourtsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setCourtInputValue(inputValue);

    const value = parseInt(inputValue, 10);
    if (!isNaN(value) && value > 0 && value <= 20) {
      onNumberOfCourtsChange(value);
    }
  };

  const handleCourtsBlur = () => {
    const value = parseInt(courtInputValue, 10);
    if (isNaN(value) || value < 1) {
      setCourtInputValue('1');
      onNumberOfCourtsChange(1);
    } else if (value > 20) {
      setCourtInputValue('20');
      onNumberOfCourtsChange(20);
    }
  };

  const handleGenerateAssignments = () => {
    setIsButtonShaking(true);
    setIsAnimating(true);
    trackCourtAction('generate_assignments', { courtCount: numberOfCourts });

    setTimeout(() => {
      setIsButtonShaking(false);
      onGenerateAssignments();

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
    <div className="court-assignments-container">
      <div className="court-settings-inline">
        <div className="court-input-group">
          <label htmlFor="courts">Courts:</label>
          <input
            id="courts"
            type="number"
            min="1"
            max="20"
            value={courtInputValue}
            onChange={handleCourtsChange}
            onBlur={handleCourtsBlur}
            className="court-input"
            data-testid="court-count-input"
          />
        </div>

        {presentPlayerCount >= 2 && (
          <button
            onClick={() => setIsManualCourtModalOpen(true)}
            className={`manual-court-button ${hasManualSelection ? 'has-selection' : ''}`}
            data-testid="manual-court-button"
          >
            ⚙️ Manual assignment{hasManualSelection ? ` (${manualCourtSelection!.players.length})` : ''}
          </button>
        )}
      </div>

      {hasAssignments && (
        <>
          {isRecentAssignment && (
            <div className="last-generated" data-testid="last-generated">
              Last generated {formatTimeAgo(lastGeneratedAt!)}
            </div>
          )}
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
              {onViewBenchCounts && (
                <button
                  onClick={onViewBenchCounts}
                  className="view-bench-counts-button"
                  data-testid="view-bench-counts-button"
                >
                  View bench counts &amp; manage
                </button>
              )}
            </div>
          )}

          {onWinnerChange && (
            <div className="winner-instructions">
              💡 <strong>Tip:</strong> Click on a team to mark them as the winner. A crown 👑 will appear next to the
              winning
              team. Click again to remove the winner.
            </div>
          )}

          <div className="regenerate-section">
            <button
              onClick={handleGenerateAssignments}
              disabled={!hasPlayers || isButtonShaking}
              className={`generate-button ${isButtonShaking ? 'button-shake' : ''}`}
              data-testid="generate-assignments-button"
            >
              🎲 Regenerate Assignments
            </button>
          </div>
        </>
      )}

      {!hasAssignments && hasPlayers && (
        <div className="no-assignments-hint">
          <p>
            <strong>How it works:</strong> Players will be randomly assigned to courts.
            Doubles (4 players) is preferred, but singles (2 players) will be used for odd numbers.
            Extra players will be benched.
          </p>
          <button
            onClick={handleGenerateAssignments}
            disabled={!hasPlayers || isButtonShaking}
            className={`generate-button ${isButtonShaking ? 'button-shake' : ''}`}
            data-testid="generate-assignments-button"
          >
            🎲 Generate Assignments
          </button>
        </div>
      )}

      {!hasPlayers && (
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
      )}

      <ManualCourtModal
        isOpen={isManualCourtModalOpen}
        onClose={() => setIsManualCourtModalOpen(false)}
        players={players}
        currentSelection={manualCourtSelection}
        onSelectionChange={onManualCourtSelectionChange}
      />
    </div>
  );
};

export default CourtAssignments;
