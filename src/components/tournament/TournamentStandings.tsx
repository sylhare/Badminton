import React from 'react';

import type { TournamentStandingRow } from '../../types/tournament';

interface TournamentStandingsProps {
  standings: TournamentStandingRow[];
  currentRound: number;
  totalRounds: number;
  isComplete: boolean;
  onReset?: () => void;
}

function teamLabel(row: TournamentStandingRow): string {
  return row.team.players.map(p => p.name).join(' & ');
}

const TournamentStandings: React.FC<TournamentStandingsProps> = ({
  standings,
  currentRound,
  totalRounds,
  isComplete,
  onReset,
}) => {
  const title = isComplete ? 'Final Results' : 'Standings';
  const subtitle = isComplete
    ? null
    : currentRound > 0
      ? `After Round ${currentRound} / ${totalRounds}`
      : `Round 0 / ${totalRounds}`;

  return (
    <div className="tournament-standings" data-testid="tournament-standings">
      <h2>{title}</h2>
      {subtitle && (
        <p className="standings-subtitle" data-testid="standings-subtitle">{subtitle}</p>
      )}

      <table className="leaderboard-table standings-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Team</th>
            <th>W</th>
            <th>L</th>
            <th>Pts</th>
            <th>Score Diff</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row, index) => (
            <tr
              key={row.team.id}
              className={index === 0 && standings.length > 1 ? 'top' : ''}
              data-testid={`standing-row-${index}`}
            >
              <td>{index + 1}</td>
              <td>{teamLabel(row)}</td>
              <td>{row.won}</td>
              <td>{row.lost}</td>
              <td>{row.points}</td>
              <td data-testid={`score-diff-${index}`}>
                {row.scoreDiff > 0 ? `+${row.scoreDiff}` : row.scoreDiff}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {isComplete && onReset && (
        <button
          className="button button-secondary"
          onClick={onReset}
          data-testid="reset-tournament-button"
        >
          Start New Tournament
        </button>
      )}
    </div>
  );
};

export default TournamentStandings;
