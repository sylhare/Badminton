import React from 'react';

import type { TournamentStandingRow, TournamentType } from '../../types/tournament';
import Tournament from '../../utils/Tournament';

interface TournamentStandingsProps {
  standings: TournamentStandingRow[];
  currentRound: number;
  totalRounds: number;
  isFinal?: boolean;
  tournamentType?: TournamentType;
}

const RANK_EMOJI = ['🥇', '🥈', '🥉'];

function deBracketStatus(row: TournamentStandingRow, isFinal: boolean | undefined): string {
  if (isFinal && row.lost === 0) return '🏆';
  if (row.lost === 0) return 'WB';
  if (row.lost === 1) return 'LB';
  return 'Out';
}

const TournamentStandings: React.FC<TournamentStandingsProps> = ({
  standings,
  currentRound,
  totalRounds,
  isFinal,
  tournamentType,
}) => {
  const isDE = tournamentType === 'double-elimination';

  let subtitle: string;
  if (isDE) {
    subtitle = isFinal ? 'Tournament Complete' : 'Double Elimination';
  } else {
    subtitle = currentRound > 0 ? `After Round ${currentRound} / ${totalRounds}` : `Round 0 / ${totalRounds}`;
  }

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
            {isDE ? <th>Status</th> : <><th>Pts</th><th>Score Diff</th></>}
          </tr>
        </thead>
        <tbody>
          {standings.map((row, index) => (
            <tr
              key={row.team.id}
              className={index === 0 && standings.length > 1 ? 'top' : ''}
              data-testid={`standing-row-${index}`}
            >
              <td>{isFinal && !isDE && index < 3 ? RANK_EMOJI[index] : index + 1}</td>
              <td>{Tournament.formatTeamName(row.team)}</td>
              <td>{row.won}</td>
              <td>{row.lost}</td>
              {isDE ? (
                <td data-testid={`de-status-${index}`}>{deBracketStatus(row, isFinal)}</td>
              ) : (
                <>
                  <td>{row.points}</td>
                  <td data-testid={`score-diff-${index}`}>
                    {row.scoreDiff > 0 ? `+${row.scoreDiff}` : row.scoreDiff}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      </div>

    </div>
  );
};

export default TournamentStandings;
