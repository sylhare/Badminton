import React from 'react';

import type { TournamentMatch } from '../../../types/tournament';

import type { BracketNode } from './types';
import { CN, CW, MG, MH } from './types';
import { NodeCard } from './NodeCard';

interface LBBracketProps {
  nodes: BracketNode[][];
  onTeamClick: (match: TournamentMatch, team: 1 | 2) => void;
}

export function LBBracket({ nodes, onTeamClick }: LBBracketProps) {
  if (nodes.length === 0) return null;

  const numCols = nodes.length;
  const maxMatchesInRound = Math.max(...nodes.map(r => r.length));

  const totalW = numCols * CW + Math.max(numCols - 1, 0) * CN;
  const totalH = maxMatchesInRound * (MH + MG) + MG;

  return (
    <div className="bracket-section">
      <div className="bracket-section-scroll">
        <div style={{ position: 'relative', width: totalW, height: totalH }}>
          {nodes.map((roundNodes, colIdx) => {
            const colLeft = colIdx * (CW + CN);
            return roundNodes.map((node, rowIdx) => {
              const top = rowIdx * (MH + MG) + MG;
              return (
                <NodeCard
                  key={node.match?.id ?? `tbd-${colIdx}-${rowIdx}`}
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
