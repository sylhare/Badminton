import React from 'react';

import type { TournamentStandingRow } from '../../../tournament/types';
import { formatTeamName } from '../../../tournament/types';

interface StandingsTableProps {
  rows: TournamentStandingRow[];
  /** Header label for the rank column ('Rank' vs '#'). */
  rankHeader: string;
  /** Rank cell content (a medal emoji, a plain number, …). */
  rankCell: (rank: number) => React.ReactNode;
  rowClass: (rank: number) => string;
  testIdFor: (rank: number) => string;
  showPoints: boolean;
  showScoreDiff: boolean;
  /** Extra class on the <table> (e.g. 'group-standings'). */
  extraClassName?: string;
}

/** The standings table shared by the combined view and the per-group tables. */
export const StandingsTable: React.FC<StandingsTableProps> = ({
  rows,
  rankHeader,
  rankCell,
  rowClass,
  testIdFor,
  showPoints,
  showScoreDiff,
  extraClassName,
}) => (
  <div className="standings-table-wrapper">
    <table className={`leaderboard-table standings-table${extraClassName ? ` ${extraClassName}` : ''}`}>
      <thead>
        <tr>
          <th>{rankHeader}</th>
          <th>Team</th>
          <th>W</th>
          <th>L</th>
          {showPoints && <th>Pts</th>}
          {showScoreDiff && <th>Score Diff</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rank) => (
          <tr key={row.team.id} className={rowClass(rank)} data-testid={testIdFor(rank)}>
            <td>{rankCell(rank)}</td>
            <td>{formatTeamName(row.team)}</td>
            <td>{row.won}</td>
            <td>{row.lost}</td>
            {showPoints && <td>{row.points}</td>}
            {showScoreDiff && (
              <td data-testid={`score-diff-${rank}`}>
                {row.scoreDiff > 0 ? `+${row.scoreDiff}` : row.scoreDiff}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
