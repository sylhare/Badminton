import React from 'react';

import type { TournamentMatch, TournamentTeam } from '../../../types/tournament';

import { CW, CN, MH, MG } from './types';
import { NodeCard } from './NodeCard';

interface LBBracketProps {
  lbMatches: TournamentMatch[];
  teams: TournamentTeam[];
  onTeamClick: (match: TournamentMatch, team: 1 | 2) => void;
}

export function LBBracket({ lbMatches, teams: _teams, onTeamClick }: LBBracketProps) {
  if (lbMatches.length === 0) {
    return <p className="bracket-pending">Awaiting Winners Bracket round 1...</p>;
  }

  const roundMap = new Map<number, TournamentMatch[]>();
  for (const m of lbMatches) {
    if (!roundMap.has(m.round)) roundMap.set(m.round, []);
    roundMap.get(m.round)!.push(m);
  }

  const rounds = Array.from(roundMap.entries()).sort(([a], [b]) => a - b);
  const numCols = rounds.length;
  const maxMatchesInRound = Math.max(...rounds.map(([, ms]) => ms.length));

  const totalW = numCols * CW + Math.max(numCols - 1, 0) * CN;
  const totalH = maxMatchesInRound * (MH + MG) + MG;

  return (
    <div className="bracket-section">
      <div className="bracket-section-scroll">
        <div style={{ position: 'relative', width: totalW, height: totalH }}>
          {rounds.map(([, roundMatches], colIdx) => {
            const colLeft = colIdx * (CW + CN);
            return roundMatches.map((match, rowIdx) => {
              const top = rowIdx * (MH + MG) + MG;
              const node = { type: 'match' as const, match, team1: match.team1, team2: match.team2 };
              return (
                <NodeCard
                  key={match.id}
                  node={node}
                  top={top}
                  left={colLeft}
                  onTeamClick={onTeamClick}
                />
              );
            });
          })}
        </div>
      </div>
    </div>
  );
}
