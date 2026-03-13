import React from 'react';

import type { Player } from '../../types';
import { engine } from '../../engines/engineSelector';

interface LeaderboardProps {
  players: Player[];
  winCounts: Map<string, number>;
  lossCounts?: Map<string, number>;
}

const medalForRank = (idx: number): string => {
  if (idx === 0) return '🥇 ';
  if (idx === 1) return '🥈 ';
  if (idx === 2) return '🥉 ';
  return '';
};

const Leaderboard: React.FC<LeaderboardProps> = ({ players, winCounts, lossCounts }) => {
  const allPlayersWithData = players.map(p => ({
    ...p,
    wins: winCounts.get(p.id) ?? 0,
    losses: lossCounts?.get(p.id) ?? 0,
  }));

  if (engine().supportsScoreTracking()) {
    const ranked = allPlayersWithData
      .filter(p => p.wins > 0 || p.losses > 0)
      .sort((a, b) => (b.level ?? 50) - (a.level ?? 50) || b.wins - a.wins || a.name.localeCompare(b.name));

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
              <th data-testid="leaderboard-level-header">Level</th>
              <th data-testid="leaderboard-avg-pts-header">Avg Pts</th>
              <th>Wins</th>
              <th data-testid="leaderboard-matches-header">Matches</th>
            </tr>
            </thead>
            <tbody>
            {ranked.map((p, idx) => {
              const trend = engine().getLevelTrend(p.id);
              return (
              <tr key={p.id} className={idx === 0 ? 'top' : undefined}>
                <td>{idx + 1}</td>
                <td>{medalForRank(idx)}{p.name}</td>
                <td>
                  {p.level?.toFixed(1) ?? '—'}
                  {trend === 'up' && <span className="trend-up">▲</span>}
                  {trend === 'down' && <span className="trend-down">▼</span>}
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
