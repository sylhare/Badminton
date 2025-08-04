import React from 'react';

import type { Player } from '../App';

interface LeaderboardProps {
  players: Player[];
  winCounts: Map<string, number>;
}

const medalForRank = (idx: number): string => {
  if (idx === 0) return '🥇 ';
  if (idx === 1) return '🥈 ';
  if (idx === 2) return '🥉 ';
  return '';
};

const Leaderboard: React.FC<LeaderboardProps> = ({ players, winCounts }) => {
  const ranked = [...players]
    .filter(p => p.isPresent)
    .map(p => ({ ...p, wins: winCounts.get(p.id) ?? 0 }))
    .sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name));

  const hasWins = ranked.some(p => p.wins > 0);
  if (!hasWins) return null;

  return (
    <div className="leaderboard step">
      <h2>🏆 Leaderboard</h2>
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
  );
};

export default Leaderboard;