import React, { useState } from 'react';
import { CaretDown, CaretUp } from '@phosphor-icons/react';

import type { Player } from '../../types';
import { useAppState } from '../../providers/AppStateProvider';

interface LeaderboardProps {
  players: Player[];
  winCounts: Map<string, number>;
  lossCounts?: Map<string, number>;
}

type SortColumn = 'wins' | 'level' | 'avgScore';
type SortDir = 'asc' | 'desc';

const medalForRank = (idx: number): string => {
  if (idx === 0) return '🥇 ';
  if (idx === 1) return '🥈 ';
  if (idx === 2) return '🥉 ';
  return '';
};

const cryingForRank = (idx: number): string => {
  if (idx === 0) return '💩 ';
  if (idx === 1) return '😬 ';
  if (idx === 2) return '😐 ';
  return '';
};

const SortIcon: React.FC<{ col: SortColumn; sortCol: SortColumn; sortDir: SortDir }> = ({ col, sortCol, sortDir }) => {
  if (col !== sortCol) return <span className="sort-icon sort-icon--inactive">⇅</span>;
  return <span className="sort-icon sort-icon--active">
    {sortDir === 'desc' ? <CaretUp weight="fill" size={12} /> : <CaretDown weight="fill" size={12} />}
  </span>;
};

const Leaderboard: React.FC<LeaderboardProps> = ({ players, winCounts, lossCounts }) => {
  const { levelTrend, isSmartEngineEnabled } = useAppState();
  const [sortCol, setSortCol] = useState<SortColumn>('avgScore');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (col: SortColumn) => {
    if (col === sortCol) {
      setSortDir(d => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  };

  const allPlayersWithData = players.map(p => ({
    ...p,
    wins: winCounts.get(p.id) ?? 0,
    losses: lossCounts?.get(p.id) ?? 0,
  }));

  if (isSmartEngineEnabled) {
    const filtered = allPlayersWithData.filter(p => p.wins > 0 || p.losses > 0);

    const ranked = [...filtered].sort((a, b) => {
      let diff = 0;
      if (sortCol === 'wins') diff = a.wins - b.wins;
      else if (sortCol === 'level') diff = (a.level ?? 50) - (b.level ?? 50);
      else diff = (a.averageScore ?? 0) - (b.averageScore ?? 0);
      if (diff !== 0) return sortDir === 'desc' ? -diff : diff;
      return a.name.localeCompare(b.name);
    });

    if (ranked.length === 0) return null;

    const thProps = (col: SortColumn, testId?: string) => ({
      className: `sortable-th${col === sortCol ? ' sorted' : ''}`,
      onClick: () => handleSort(col),
      'data-testid': testId,
    });

    return (
      <div className="leaderboard step">
        <h2>🏆 Leaderboard</h2>
        <div className="leaderboard-scroll">
          <table className="leaderboard-table">
            <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th {...thProps('level', 'leaderboard-level-header')}>
                <span className="th-content">Level <SortIcon col="level" sortCol={sortCol} sortDir={sortDir} /></span>
              </th>
              <th {...thProps('avgScore', 'leaderboard-avg-pts-header')}>
                <span className="th-content">Avg Pts <SortIcon col="avgScore" sortCol={sortCol} sortDir={sortDir} /></span>
              </th>
              <th {...thProps('wins')}>
                <span className="th-content">Wins <SortIcon col="wins" sortCol={sortCol} sortDir={sortDir} /></span>
              </th>
              <th data-testid="leaderboard-matches-header">Matches</th>
            </tr>
            </thead>
            <tbody>
            {ranked.map((p, idx) => {
              const trend = levelTrend(p.id);
              return (
                <tr key={p.id} className={idx === 0 ? 'top' : undefined}>
                  <td>{idx + 1}</td>
                  <td>{sortDir === 'desc' ? medalForRank(idx) : cryingForRank(idx)}{p.name}</td>
                  <td>
                  <span className="level-cell">
                    {p.level?.toFixed(1) ?? '—'}
                    {trend === 'up' && <span className="trend-up">▲</span>}
                    {trend === 'down' && <span className="trend-down">▼</span>}
                  </span>
                  </td>
                  <td>{p.averageScore?.toFixed(1) ?? '—'}</td>
                  <td>{p.wins}</td>
                  <td>{p.wins + p.losses}</td>
                </tr>
              );
            })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const ranked = allPlayersWithData
    .filter(p => p.wins > 0)
    .sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name));

  if (ranked.length === 0) return null;

  return (
    <div className="leaderboard step">
      <h2>🏆 Leaderboard</h2>
      <div className="leaderboard-scroll">
        <table className="leaderboard-table">
          <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            <th>Wins</th>
          </tr>
          </thead>
          <tbody>
          {ranked.map((p, idx) => (
            <tr key={p.id} className={idx === 0 ? 'top' : undefined}>
              <td>{idx + 1}</td>
              <td>{medalForRank(idx)}{p.name}</td>
              <td>{p.wins}</td>
            </tr>
          ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Leaderboard;
