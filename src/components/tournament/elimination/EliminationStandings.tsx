import React from 'react';

import type { TournamentStandingRow } from '../../../tournament/types';

interface EliminationStandingsProps {
  standings: TournamentStandingRow[];
  isComplete: boolean;
}

function teamLabel(row: TournamentStandingRow): string {
  return row.team.players.map(p => p.name).join(' & ');
}

function medalForRank(rank: number, isComplete: boolean): string | null {
  if (!isComplete) return null;
  if (rank === 0) return '🥇';
  if (rank === 1) return '🥈';
  if (rank === 2) return '🥉';
  return null;
}

const EliminationStandings: React.FC<EliminationStandingsProps> = ({ standings, isComplete }) => {
  return (
    <div className="tournament-standings" data-testid="tournament-standings">
      <h2>Standings</h2>
      <p className="standings-subtitle" data-testid="standings-subtitle">
        {isComplete ? 'Final Results' : 'In Progress'}
      </p>

      <div className="standings-table-wrapper">
        <table className="leaderboard-table standings-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Team</th>
              <th>W</th>
              <th>L</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row, index) => {
              const medal = medalForRank(index, isComplete);
              return (
                <tr
                  key={row.team.id}
                  className={index === 0 && standings.length > 1 ? 'top' : ''}
                  data-testid={`standing-row-${index}`}
                >
                  <td>{medal ?? index + 1}</td>
                  <td>{teamLabel(row)}</td>
                  <td>{row.won}</td>
                  <td>{row.lost}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EliminationStandings;
