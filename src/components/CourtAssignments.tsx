import React from 'react';

import { Court, Player } from '../App';
import { triggerConfetti } from '../utils/confetti';

import TeamDisplay from './TeamDisplay';
import TeamPlayerList from './TeamPlayerList';

interface CourtAssignmentsProps {
  assignments: Court[];
  benchedPlayers: Player[];
  onGenerateNewAssignments: () => void;
  onWinnerChange?: (courtNumber: number, winner: 1 | 2 | undefined) => void;
}

const CourtAssignments: React.FC<CourtAssignmentsProps> = ({
  assignments,
  benchedPlayers,
  onGenerateNewAssignments,
  onWinnerChange,
}) => {
  const handleTeamClick = (courtNumber: number, teamNumber: number) => {
    if (onWinnerChange) {
      const court = assignments.find(c => c.courtNumber === courtNumber);
      if (court) {
        const newWinner = court.winner === teamNumber ? undefined : (teamNumber as 1 | 2);
        onWinnerChange(courtNumber, newWinner);
      }
    }
  };

  const handleSinglesClick = (event: React.MouseEvent<HTMLDivElement>, courtNumber: number, teamNumber: number) => {
    if (onWinnerChange) {
      const court = assignments.find(c => c.courtNumber === courtNumber);
      if (court) {
        const newWinner = court.winner === teamNumber ? undefined : (teamNumber as 1 | 2);

        if (court.winner !== teamNumber && newWinner !== undefined) {
          const x = event.clientX;
          const y = event.clientY;
          triggerConfetti(x, y, 30);
        }

        onWinnerChange(courtNumber, newWinner);
      }
    }
  };

  const renderSinglesMatch = (court: Court) => {
    const { teams } = court;
    if (!teams) return null;

    return (
      <div className="singles-match">
        <div className="singles-players">
          <div
            className={`singles-player ${onWinnerChange ? 'singles-player-clickable' : ''} ${court.winner === 1 ? 'singles-player-winner' : ''}`}
            onClick={(event) => onWinnerChange && handleSinglesClick(event, court.courtNumber, 1)}
          >
            {teams.team1[0].name}
            {court.winner === 1 && <span className="crown">👑</span>}
          </div>
          <div className="vs-divider">VS</div>
          <div
            className={`singles-player ${onWinnerChange ? 'singles-player-clickable' : ''} ${court.winner === 2 ? 'singles-player-winner' : ''}`}
            onClick={(event) => onWinnerChange && handleSinglesClick(event, court.courtNumber, 2)}
          >
            {teams.team2[0].name}
            {court.winner === 2 && <span className="crown">👑</span>}
          </div>
        </div>
        {court.players.length === 3 && (
          <div style={{ marginTop: '15px', fontSize: '0.9rem', color: '#718096' }}>
            <div>Waiting: {court.players[2].name}</div>
          </div>
        )}
      </div>
    );
  };

  const renderDoublesMatch = (court: Court) => {
    const { teams } = court;
    if (!teams) return null;

    return (
      <div className="teams">
        <TeamDisplay
          teamNumber={1}
          players={teams.team1}
          showVsDivider
          isWinner={court.winner === 1}
          onTeamClick={(teamNumber) => handleTeamClick(court.courtNumber, teamNumber)}
          isClickable={!!onWinnerChange}
        />
        <TeamDisplay
          teamNumber={2}
          players={teams.team2}
          isWinner={court.winner === 2}
          onTeamClick={(teamNumber) => handleTeamClick(court.courtNumber, teamNumber)}
          isClickable={!!onWinnerChange}
        />
      </div>
    );
  };

  const renderGenericCourt = (court: Court) => {
    const { teams } = court;
    if (!teams) return null;

    return (
      <div className="teams">
        <TeamDisplay
          teamNumber={1}
          players={teams.team1}
          isWinner={court.winner === 1}
          onTeamClick={(teamNumber) => handleTeamClick(court.courtNumber, teamNumber)}
          isClickable={!!onWinnerChange}
        />
        {teams.team2.length > 0 && (
          <>
            <div className="vs-divider">VS</div>
            <TeamDisplay
              teamNumber={2}
              players={teams.team2}
              isWinner={court.winner === 2}
              onTeamClick={(teamNumber) => handleTeamClick(court.courtNumber, teamNumber)}
              isClickable={!!onWinnerChange}
            />
          </>
        )}
      </div>
    );
  };

  const renderCourt = (court: Court) => {
    const { teams } = court;

    if (!teams) {
      return (
        <div key={court.courtNumber} className="court-card" data-testid={`court-${court.courtNumber}`}>
          <div className="court-header">Court {court.courtNumber}</div>
          <div className="singles-match">
            <div>Players on court:</div>
            <TeamPlayerList players={court.players} />
          </div>
        </div>
      );
    }

    const isDoubles = teams.team1.length === 2 && teams.team2.length === 2;
    const isSingles = teams.team1.length === 1 && teams.team2.length === 1;

    if (isSingles) {
      return (
        <div key={court.courtNumber} className="court-card" data-testid={`court-${court.courtNumber}`}>
          <div className="court-header">Court {court.courtNumber} - Singles</div>
          {renderSinglesMatch(court)}
        </div>
      );
    }

    if (isDoubles) {
      return (
        <div key={court.courtNumber} className="court-card" data-testid={`court-${court.courtNumber}`}>
          <div className="court-header">Court {court.courtNumber} - Doubles</div>
          {renderDoublesMatch(court)}
        </div>
      );
    }

    return (
      <div key={court.courtNumber} className="court-card" data-testid={`court-${court.courtNumber}`}>
        <div className="court-header">Court {court.courtNumber}</div>
        {renderGenericCourt(court)}
      </div>
    );
  };

  return (
    <div>
      {onWinnerChange && (
        <div className="winner-instructions">
          💡 <strong>Tip:</strong> Click on a team to mark them as the winner. A crown 👑 will appear next to the winning
          team. Click again to remove the winner.
        </div>
      )}
      <div className="courts-grid">
        {assignments.map(renderCourt)}
      </div>

      {benchedPlayers.length > 0 && (
        <div className="bench-section">
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
          onClick={onGenerateNewAssignments}
          className="generate-button"
          data-testid="generate-new-assignments-button"
        >
          🎲 Generate New Assignments
        </button>
      </div>
    </div>
  );
};

export default CourtAssignments;