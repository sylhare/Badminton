import React, { useRef, useState } from 'react';

import type { Court } from '../../../types';
import { DoublesMatch, GenericCourtDisplay, NoTeamsDisplay, SinglesMatch } from '../display';
import { triggerConfetti } from '../../../utils/confetti.ts';
import ScoreInputModal from '../../ScoreInputModal';
import { engine } from '../../../engines/engineSelector';

import CourtHeader from './CourtHeader';

interface CourtCardProps {
  court: Court;
  onWinnerChange?: (courtNumber: number, teamNumber: number) => void;
  onScoreChange?: (courtNumber: number, score?: { team1: number; team2: number }) => void;
  onRotateTeams?: (courtNumber: number) => void;
  isManualCourt?: boolean;
  isAnimating?: boolean;
}

const CourtCard: React.FC<CourtCardProps> = ({
  court,
  onWinnerChange,
  onScoreChange,
  onRotateTeams,
  isManualCourt = false,
  isAnimating = false,
}) => {
  const [pendingWinner, setPendingWinner] = useState<1 | 2 | null>(null);
  const clickCoordsRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleTeamClick = (event: React.MouseEvent, teamNumber: 1 | 2) => {
    if (!onWinnerChange) return;

    if (court.winner === teamNumber) {
      onWinnerChange(court.courtNumber, teamNumber);
      onScoreChange?.(court.courtNumber, undefined);
    } else if (!engine().supportsScoreTracking()) {
      onWinnerChange(court.courtNumber, teamNumber);
      triggerConfetti(event.clientX, event.clientY, 30);
    } else {
      clickCoordsRef.current = { x: event.clientX, y: event.clientY };
      setPendingWinner(teamNumber);
    }
  };

  const handleRotateTeams = onRotateTeams ? () => onRotateTeams(court.courtNumber) : undefined;
  const handleModalConfirm = (score?: { team1: number; team2: number }) => {
    if (pendingWinner === null || !onWinnerChange) return;
    onWinnerChange(court.courtNumber, pendingWinner);
    onScoreChange?.(court.courtNumber, score);
    triggerConfetti(clickCoordsRef.current.x, clickCoordsRef.current.y, 30);
    setPendingWinner(null);
  };

  const handleModalCancel = () => {
    setPendingWinner(null);
  };

  const { teams } = court;

  const team1Players = teams?.team1 ?? [];
  const team2Players = teams?.team2 ?? [];

  const scoreModal = (
    <ScoreInputModal
      isOpen={pendingWinner !== null}
      winnerTeam={pendingWinner ?? 1}
      team1Players={team1Players}
      team2Players={team2Players}
      onConfirm={handleModalConfirm}
      onCancel={handleModalCancel}
    />
  );

  if (!teams) {
    return (
      <div
        className={`court-card ${isAnimating ? 'animating-shake' : ''}`}
        data-testid={`court-${court.courtNumber}`}
      >
        <CourtHeader courtNumber={court.courtNumber} isManualCourt={isManualCourt} />
        <NoTeamsDisplay players={court.players} isAnimating={isAnimating} />
        {scoreModal}
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
          onRotateTeams={handleRotateTeams}
        />
        <SinglesMatch
          team1Player={teams.team1[0]}
          team2Player={teams.team2[0]}
          waitingPlayer={court.players[2]}
          winner={court.winner}
          isAnimating={isAnimating}
          onPlayerClick={(event, teamNumber) => handleTeamClick(event, teamNumber as 1 | 2)}
          isClickable={!!onWinnerChange}
        />
        {scoreModal}
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
          onRotateTeams={handleRotateTeams}
        />
        <DoublesMatch
          team1Players={teams.team1}
          team2Players={teams.team2}
          winner={court.winner}
          isAnimating={isAnimating}
          onTeamClick={(event, teamNumber) => handleTeamClick(event, teamNumber as 1 | 2)}
          isClickable={!!onWinnerChange}
        />
        {scoreModal}
      </div>
    );
  }

  return (
    <div
      className={`court-card ${isAnimating ? 'animating-shake' : ''}`}
      data-testid={`court-${court.courtNumber}`}
    >
      <CourtHeader
        courtNumber={court.courtNumber}
        isManualCourt={isManualCourt}
        onRotateTeams={handleRotateTeams}
      />
      <GenericCourtDisplay
        team1Players={teams.team1}
        team2Players={teams.team2}
        winner={court.winner}
        isAnimating={isAnimating}
        onTeamClick={(event, teamNumber) => handleTeamClick(event, teamNumber as 1 | 2)}
        isClickable={!!onWinnerChange}
      />
      {scoreModal}
    </div>
  );
};

export default CourtCard;
