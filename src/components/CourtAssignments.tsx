import React from 'react';

import { Court, Player } from '../App';

import TeamPlayerList from './TeamPlayerList';
import TeamDisplay from './TeamDisplay';

interface CourtAssignmentsProps {
  assignments: Court[];
  benchedPlayers: Player[];
  onGenerateNewAssignments: () => void;
}

const CourtAssignments: React.FC<CourtAssignmentsProps> = ({
  assignments,
  benchedPlayers,
  onGenerateNewAssignments,
}) => {
  const renderSinglesMatch = (court: Court) => {
    const { teams } = court;
    if (!teams) return null;

    return (
      <div className="singles-match">
        <div className="singles-players">
          <div className="singles-player">
            {teams.team1[0].name}
          </div>
          <div className="vs-divider">VS</div>
          <div className="singles-player">
            {teams.team2[0].name}
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
        <TeamDisplay teamNumber={1} players={teams.team1} showVsDivider />
        <TeamDisplay teamNumber={2} players={teams.team2} />
      </div>
    );
  };

  const renderGenericCourt = (court: Court) => {
    const { teams } = court;
    if (!teams) return null;

    return (
      <div className="teams">
        <TeamDisplay teamNumber={1} players={teams.team1} />
        {teams.team2.length > 0 && (
          <>
            <div className="vs-divider">VS</div>
            <TeamDisplay teamNumber={2} players={teams.team2} />
          </>
        )}
      </div>
    );
  };

  const renderCourt = (court: Court) => {
    const { teams } = court;

    if (!teams) {
      return (
        <div key={court.courtNumber} className="court-card">
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
        <div key={court.courtNumber} className="court-card">
          <div className="court-header">Court {court.courtNumber} - Singles</div>
          {renderSinglesMatch(court)}
        </div>
      );
    }

    if (isDoubles) {
      return (
        <div key={court.courtNumber} className="court-card">
          <div className="court-header">Court {court.courtNumber} - Doubles</div>
          {renderDoublesMatch(court)}
        </div>
      );
    }

    return (
      <div key={court.courtNumber} className="court-card">
        <div className="court-header">Court {court.courtNumber}</div>
        {renderGenericCourt(court)}
      </div>
    );
  };

  return (
    <div>
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
        >
          🎲 Generate New Assignments
        </button>
      </div>
    </div>
  );
};

export default CourtAssignments;