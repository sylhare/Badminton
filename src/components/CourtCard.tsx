import React from 'react';

import type { Court } from '../types';

import TeamDisplay from './TeamDisplay';
import TeamPlayerList from './TeamPlayerList';

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

  const handleSinglesClick = (event: React.MouseEvent<HTMLDivElement>, teamNumber: number) => {
    if (onWinnerChange) {
      const triggerConfetti = async () => {
        const { triggerConfetti: confetti } = await import('../utils/confetti');
        const x = event.clientX;
        const y = event.clientY;
        confetti(x, y, 30);
      };

      const newWinner = court.winner === teamNumber ? undefined : (teamNumber as 1 | 2);
      if (court.winner !== teamNumber && newWinner !== undefined) {
        triggerConfetti();
      }

      onWinnerChange(court.courtNumber, teamNumber);
    }
  };

  const renderCourtHeader = (matchType?: string) => (
    <div className="court-header">
      <h3>
        Court {court.courtNumber}{matchType ? ` - ${matchType}` : ''}
        {isManualCourt && (
          <span className="manual-court-icon" title="Manually assigned court">
            ⚙️
          </span>
        )}
      </h3>
    </div>
  );

  const renderSinglesMatch = () => {
    const { teams } = court;
    if (!teams) return null;

    return (
      <div className="singles-match">
        <div className={`singles-players ${isAnimating ? 'animating-blur' : ''}`}>
          <div
            className={`singles-player ${onWinnerChange ? 'singles-player-clickable' : ''} ${court.winner === 1 ? 'singles-player-winner' : ''}`}
            onClick={(event) => onWinnerChange && handleSinglesClick(event, 1)}
          >
            {teams.team1[0].name}
            {court.winner === 1 && <span className="crown">👑</span>}
          </div>
          <div className="vs-divider">VS</div>
          <div
            className={`singles-player ${onWinnerChange ? 'singles-player-clickable' : ''} ${court.winner === 2 ? 'singles-player-winner' : ''}`}
            onClick={(event) => onWinnerChange && handleSinglesClick(event, 2)}
          >
            {teams.team2[0].name}
            {court.winner === 2 && <span className="crown">👑</span>}
          </div>
        </div>
        {court.players.length === 3 && (
          <div style={{ marginTop: '15px', fontSize: '0.9rem', color: '#718096' }}>
            <div className={isAnimating ? 'animating-blur' : ''}>Waiting: {court.players[2].name}</div>
          </div>
        )}
      </div>
    );
  };

  const renderDoublesMatch = () => {
    const { teams } = court;
    if (!teams) return null;

    return (
      <div className={`teams ${isAnimating ? 'animating-blur' : ''}`}>
        <TeamDisplay
          teamNumber={1}
          players={teams.team1}
          showVsDivider
          isWinner={court.winner === 1}
          onTeamClick={handleTeamClick}
          isClickable={!!onWinnerChange}
        />
        <TeamDisplay
          teamNumber={2}
          players={teams.team2}
          isWinner={court.winner === 2}
          onTeamClick={handleTeamClick}
          isClickable={!!onWinnerChange}
        />
      </div>
    );
  };

  const renderGenericCourt = () => {
    const { teams } = court;
    if (!teams) return null;

    return (
      <div className={`teams ${isAnimating ? 'animating-blur' : ''}`}>
        <TeamDisplay
          teamNumber={1}
          players={teams.team1}
          isWinner={court.winner === 1}
          onTeamClick={handleTeamClick}
          isClickable={!!onWinnerChange}
        />
        {teams.team2.length > 0 && (
          <>
            <div className="vs-divider">VS</div>
            <TeamDisplay
              teamNumber={2}
              players={teams.team2}
              isWinner={court.winner === 2}
              onTeamClick={handleTeamClick}
              isClickable={!!onWinnerChange}
            />
          </>
        )}
      </div>
    );
  };

  const { teams } = court;

  if (!teams) {
    return (
      <div
        key={court.courtNumber}
        className={`court-card ${isAnimating ? 'animating-shake' : ''}`}
        data-testid={`court-${court.courtNumber}`}
      >
        {renderCourtHeader()}
        <div className="singles-match">
          <div className={isAnimating ? 'animating-blur' : ''}>Players on court:</div>
          <div className={isAnimating ? 'animating-blur' : ''}>
            <TeamPlayerList players={court.players} />
          </div>
        </div>
      </div>
    );
  }

  const isDoubles = teams.team1.length === 2 && teams.team2.length === 2;
  const isSingles = teams.team1.length === 1 && teams.team2.length === 1;

  if (isSingles) {
    return (
      <div
        key={court.courtNumber}
        className={`court-card ${isAnimating ? 'animating-shake' : ''}`}
        data-testid={`court-${court.courtNumber}`}
      >
        {renderCourtHeader('Singles')}
        {renderSinglesMatch()}
      </div>
    );
  }

  if (isDoubles) {
    return (
      <div
        key={court.courtNumber}
        className={`court-card ${isAnimating ? 'animating-shake' : ''}`}
        data-testid={`court-${court.courtNumber}`}
      >
        {renderCourtHeader('Doubles')}
        {renderDoublesMatch()}
      </div>
    );
  }

  return (
    <div
      key={court.courtNumber}
      className={`court-card ${isAnimating ? 'animating-shake' : ''}`}
      data-testid={`court-${court.courtNumber}`}
    >
      {renderCourtHeader()}
      {renderGenericCourt()}
    </div>
  );
};

export default CourtCard;

