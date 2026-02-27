import React, { useEffect, useState } from 'react';

import type { Court } from '../../../types';
import { DoublesMatch, GenericCourtDisplay, NoTeamsDisplay, SinglesMatch } from '../display';
import { triggerConfetti } from '../../../utils/confetti.ts';

import CourtHeader from './CourtHeader';

interface CourtCardProps {
  court: Court;
  onWinnerChange?: (courtNumber: number, teamNumber: number) => void;
  onScoreChange?: (courtNumber: number, team1Score: number, team2Score: number) => void;
  isManualCourt?: boolean;
  isAnimating?: boolean;
}

const CourtCard: React.FC<CourtCardProps> = ({
  court,
  onWinnerChange,
  onScoreChange,
  isManualCourt = false,
  isAnimating = false,
}) => {
  const [score1, setScore1] = useState<string>(court.score?.team1 !== undefined ? String(court.score.team1) : '');
  const [score2, setScore2] = useState<string>(court.score?.team2 !== undefined ? String(court.score.team2) : '');

  // Reset inputs when court number changes (new assignment generated)
  useEffect(() => {
    setScore1(court.score?.team1 !== undefined ? String(court.score.team1) : '');
    setScore2(court.score?.team2 !== undefined ? String(court.score.team2) : '');
  }, [court.courtNumber]);

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

  const handleScore1Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setScore1(val);
    const n1 = parseInt(val, 10);
    const n2 = parseInt(score2, 10);
    if (!isNaN(n1) && !isNaN(n2) && onScoreChange) {
      onScoreChange(court.courtNumber, n1, n2);
    }
  };

  const handleScore2Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setScore2(val);
    const n1 = parseInt(score1, 10);
    const n2 = parseInt(val, 10);
    if (!isNaN(n1) && !isNaN(n2) && onScoreChange) {
      onScoreChange(court.courtNumber, n1, n2);
    }
  };

  const { teams } = court;

  const scoreInputs = teams && onScoreChange ? (
    <div className="court-score-row">
      <input
        type="number"
        min="0"
        value={score1}
        onChange={handleScore1Change}
        className="court-score-input"
        placeholder="T1"
        aria-label="Team 1 score"
      />
      <span className="court-score-separator">—</span>
      <input
        type="number"
        min="0"
        value={score2}
        onChange={handleScore2Change}
        className="court-score-input"
        placeholder="T2"
        aria-label="Team 2 score"
      />
    </div>
  ) : null;

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
        {scoreInputs}
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
        {scoreInputs}
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
      {scoreInputs}
    </div>
  );
};

export default CourtCard;
