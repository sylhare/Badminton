import React from 'react';

import type { Court } from '../../../types';
import { DoublesMatch, GenericCourtDisplay, NoTeamsDisplay, SinglesMatch } from '../display';
import { triggerConfetti } from '../../../utils/confetti.ts';

import CourtHeader from './CourtHeader';

interface CourtCardProps {
  court: Court;
  onWinnerChange?: (courtNumber: number, teamNumber: number) => void;
  isManualCourt?: boolean;
  isAnimating?: boolean;
}

const CourtCard: React.FC<CourtCardProps> = ({
  court,
  onWinnerChange,
  isManualCourt = false,
  isAnimating = false,
}) => {
  const handleTeamClick = (teamNumber: number) => {
    if (onWinnerChange) {
      onWinnerChange(court.courtNumber, teamNumber);
    }
  };

  const handleSinglesClick = async (event: React.MouseEvent<HTMLDivElement>, teamNumber: number) => {
    if (!onWinnerChange) return;

    const newWinner = court.winner === teamNumber ? undefined : (teamNumber as 1 | 2);

    if (court.winner !== teamNumber && newWinner !== undefined) {
      triggerConfetti(event.clientX, event.clientY, 30);
    }

    onWinnerChange(court.courtNumber, teamNumber);
  };

  const { teams } = court;

  if (!teams) {
    return (
      <div
        className={`court-card ${isAnimating ? 'animating-shake' : ''}`}
        data-testid={`court-${court.courtNumber}`}
      >
        <CourtHeader courtNumber={court.courtNumber} isManualCourt={isManualCourt} />
        <NoTeamsDisplay players={court.players} isAnimating={isAnimating} />
      </div>
    );
  }

  const isSingles = teams.team1.length === 1 && teams.team2.length === 1;
  const isDoubles = teams.team1.length === 2 && teams.team2.length === 2;

  if (isSingles) {
    return (
      <div
        className={`court-card ${isAnimating ? 'animating-shake' : ''}`}
        data-testid={`court-${court.courtNumber}`}
      >
        <CourtHeader
          courtNumber={court.courtNumber}
          matchType="Singles"
          isManualCourt={isManualCourt}
        />
        <SinglesMatch
          team1Player={teams.team1[0]}
          team2Player={teams.team2[0]}
          waitingPlayer={court.players[2]}
          winner={court.winner}
          isAnimating={isAnimating}
          onPlayerClick={handleSinglesClick}
          isClickable={!!onWinnerChange}
        />
      </div>
    );
  }

  if (isDoubles) {
    return (
      <div
        className={`court-card ${isAnimating ? 'animating-shake' : ''}`}
        data-testid={`court-${court.courtNumber}`}
      >
        <CourtHeader
          courtNumber={court.courtNumber}
          matchType="Doubles"
          isManualCourt={isManualCourt}
        />
        <DoublesMatch
          team1Players={teams.team1}
          team2Players={teams.team2}
          winner={court.winner}
          isAnimating={isAnimating}
          onTeamClick={handleTeamClick}
          isClickable={!!onWinnerChange}
        />
      </div>
    );
  }

  return (
    <div
      className={`court-card ${isAnimating ? 'animating-shake' : ''}`}
      data-testid={`court-${court.courtNumber}`}
    >
      <CourtHeader courtNumber={court.courtNumber} isManualCourt={isManualCourt} />
      <GenericCourtDisplay
        team1Players={teams.team1}
        team2Players={teams.team2}
        winner={court.winner}
        isAnimating={isAnimating}
        onTeamClick={handleTeamClick}
        isClickable={!!onWinnerChange}
      />
    </div>
  );
};

export default CourtCard;

