import React from 'react';

import { usePlayers } from '../../hooks/usePlayers';
import type { TournamentStandingRow, TournamentType } from '../../tournament/types.ts';
import Tournament from '../../tournament/Tournament';

interface TournamentStandingsProps {
  standings: TournamentStandingRow[];
  currentRound: number;
  totalRounds: number;
  isFinal?: boolean;
  tournamentType?: TournamentType;
}

const RANK_EMOJI = ['🥇', '🥈', '🥉'];

function seStatus(
  row: TournamentStandingRow,
  index: number,
  isFinal: boolean | undefined,
): string {
  if (isFinal) {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return 'Out';
  }
  if (row.lost >= 2) return 'Out';
  return 'In';
}

const TournamentStandings: React.FC<TournamentStandingsProps> = ({
  standings,
  currentRound,
  totalRounds,
  isFinal,
  tournamentType,
}) => {
  const { players } = usePlayers();
  const isSE = tournamentType === 'elimination';

  let subtitle: string;
  if (isSE) {
    subtitle = isFinal ? 'Tournament Complete' : 'Elimination';
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
            {isSE ? <th>Status</th> : <><th>Pts</th><th>Score Diff</th></>}
          </tr>
          </thead>
          <tbody>
          {standings.map((row, index) => (
            <tr
              key={row.team.id}
              className={index === 0 && standings.length > 1 ? 'top' : ''}
              data-testid={`standing-row-${index}`}
            >
              <td>{isFinal && !isSE && index < 3 ? RANK_EMOJI[index] : index + 1}</td>
              <td>{Tournament.formatTeamName(row.team, players)}</td>
              <td>{row.won}</td>
              <td>{row.lost}</td>
              {isSE ? (
                <td data-testid={`se-status-${index}`}>{seStatus(row, index, isFinal)}</td>
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
