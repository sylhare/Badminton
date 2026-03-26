import React from 'react';

import type { TournamentStandingRow } from '../../tournament/types';
import { formatTeamName } from '../../tournament/teamUtils';

interface TournamentStandingsProps {
  standings: TournamentStandingRow[];
  isComplete: boolean;
  subtitle: string;
  showPoints?: boolean;
}

const RANK_EMOJI = ['🥇', '🥈', '🥉'];

export const TournamentStandings: React.FC<TournamentStandingsProps> = ({
  standings,
  isComplete,
  subtitle,
  showPoints,
}) => {
  return (
    <div className="tournament-standings" data-testid="tournament-standings">
      <h2>Standings</h2>
      <p className="standings-subtitle" data-testid="standings-subtitle">{subtitle}</p>

      <div className="standings-table-wrapper">
        <table className="leaderboard-table standings-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Team</th>
              <th>W</th>
              <th>L</th>
              {showPoints && <th>Pts</th>}
              {showPoints && <th>Score Diff</th>}
            </tr>
          </thead>
          <tbody>
            {standings.map((row, index) => (
              <tr
                key={row.team.id}
                className={index === 0 && standings.length > 1 ? 'top' : ''}
                data-testid={`standing-row-${index}`}
              >
                <td>{isComplete && index < 3 ? RANK_EMOJI[index] : index + 1}</td>
                <td>{formatTeamName(row.team)}</td>
                <td>{row.won}</td>
                <td>{row.lost}</td>
                {showPoints && <td>{row.points}</td>}
                {showPoints && (
                  <td data-testid={`score-diff-${index}`}>
                    {row.scoreDiff > 0 ? `+${row.scoreDiff}` : row.scoreDiff}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

