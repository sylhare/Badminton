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
  const handleModalConfirm = (score: { team1: number; team2: number }) => {
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
  const isSingles = teams && teams.team1.length === 1 && teams.team2.length === 1;
  const isDoubles = teams && teams.team1.length === 2 && teams.team2.length === 2;

  const onTeamClick = (event: React.MouseEvent, teamNumber: number) =>
    handleTeamClick(event, teamNumber as 1 | 2);
  const isClickable = !!onWinnerChange;

  let matchType: string | undefined;
  let matchContent: React.ReactNode;

  if (!teams) {
    matchContent = <NoTeamsDisplay players={court.players} isAnimating={isAnimating} />;
  } else if (isSingles) {
    matchType = 'Singles';
    matchContent = (
      <SinglesMatch
        team1Player={teams.team1[0]}
        team2Player={teams.team2[0]}
        waitingPlayer={court.players[2]}
        winner={court.winner}
        isAnimating={isAnimating}
        onPlayerClick={onTeamClick}
        isClickable={isClickable}
      />
    );
  } else {
    const MatchComponent = isDoubles ? DoublesMatch : GenericCourtDisplay;
    matchType = isDoubles ? 'Doubles' : undefined;
    matchContent = (
      <MatchComponent
        team1Players={teams.team1}
        team2Players={teams.team2}
        winner={court.winner}
        isAnimating={isAnimating}
        onTeamClick={onTeamClick}
        isClickable={isClickable}
      />
    );
  }

  return (
    <div
      className={`court-card ${isAnimating ? 'animating-shake' : ''}`}
      data-testid={`court-${court.courtNumber}`}
    >
      <CourtHeader
        courtNumber={court.courtNumber}
        matchType={matchType}
        isManualCourt={isManualCourt}
        onRotateTeams={teams ? handleRotateTeams : undefined}
      />
      {matchContent}
      <ScoreInputModal
        isOpen={pendingWinner !== null}
        winnerTeam={pendingWinner ?? 1}
        team1Players={teams?.team1 ?? []}
        team2Players={teams?.team2 ?? []}
        onConfirm={handleModalConfirm}
        onCancel={handleModalCancel}
      />
    </div>
  );
};

export default CourtCard;
