import React from 'react';
import { useTranslation } from 'react-i18next';

import type { TournamentStandingRow } from '../../../tournament/types';
import { formatTeamName } from '../../../tournament/types';
import { cx } from '../../common/cx';

interface StandingsTableProps {
  rows: TournamentStandingRow[];
  /** Header label for the rank column ('Rank' vs '#'). */
  rankHeader?: string;
  /** Rank cell content (a medal emoji, a plain number, …). */
  rankCell: (rank: number) => React.ReactNode;
  rowClass: (rank: number) => string;
  testIdFor: (rank: number) => string;
  /** Show the Pts / Sets / Score Diff metric columns (they always appear together). */
  showMetrics: boolean;
  /** Extra class on the <table> (e.g. 'group-standings'). */
  extraClassName?: string;
}

/** Render a differential as a signed value ('+3', '0', '-2'). */
const signed = (value: number): string => (value > 0 ? `+${value}` : String(value));

/** The standings table shared by the combined view and the per-group tables. */
export const StandingsTable: React.FC<StandingsTableProps> = ({
  rows,
  rankHeader,
  rankCell,
  rowClass,
  testIdFor,
  showMetrics,
  extraClassName,
}) => {
  const { t } = useTranslation();
  return (
    <div className="standings-table-wrapper">
      <table className={cx('leaderboard-table', 'standings-table', extraClassName)}>
        <thead>
          <tr>
            <th>{rankHeader ?? t('tournament.standings.table.rank')}</th>
            <th>{t('tournament.standings.table.team')}</th>
            <th>{t('tournament.standings.table.won')}</th>
            <th>{t('tournament.standings.table.lost')}</th>
            {showMetrics && <th>{t('tournament.standings.table.points')}</th>}
            {showMetrics && <th>{t('tournament.standings.table.sets')}</th>}
            {showMetrics && <th>{t('tournament.standings.table.scoreDiff')}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rank) => (
            <tr key={row.team.id} className={rowClass(rank)} data-testid={testIdFor(rank)}>
              <td>{rankCell(rank)}</td>
              <td>{formatTeamName(row.team)}</td>
              <td>{row.won}</td>
              <td>{row.lost}</td>
              {showMetrics && <td>{row.points}</td>}
              {showMetrics && (
                <td data-testid={`set-diff-${rank}`}>{signed(row.setDiff)}</td>
              )}
              {showMetrics && (
                <td data-testid={`score-diff-${rank}`}>{signed(row.scoreDiff)}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
