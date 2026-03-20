import React from 'react';

import type { TournamentMatch } from '../../../types/tournament';

import type { BracketLayout } from '../../../tournament/bracket/computeBracketNodes';
import { CN, CW } from '../../../tournament/bracket/types';
import { BracketConnectors } from './BracketConnectors';
import { NodeCard } from './NodeCard';

interface BracketSectionProps extends BracketLayout {
  onTeamClick: (match: TournamentMatch, team: 1 | 2) => void;
}

export function BracketSection({
  nodes,
  tops,
  connectorTypes,
  totalH,
  totalW,
  onTeamClick,
}: BracketSectionProps) {
  if (nodes.length === 0) return null;

  return (
    <div className="bracket-section">
      <div className="bracket-section-scroll">
        <div style={{ position: 'relative', width: totalW, height: totalH }}>
          {nodes.map((colNodes, colIdx) => {
            const colLeft = colIdx * (CW + CN);
            const isLast = colIdx === nodes.length - 1;
            return (
              <React.Fragment key={colIdx}>
                {colNodes.map((node, nodeIdx) => (
                  <NodeCard
                    key={node.match?.id ?? `tbd-${colIdx}-${nodeIdx}`}
                    node={node}
                    top={tops[colIdx][nodeIdx]}
                    left={colLeft}
                    onTeamClick={onTeamClick}
                  />
                ))}
                {!isLast && connectorTypes[colIdx] !== 'none' && (
                  <BracketConnectors
                    fromTops={tops[colIdx]}
                    toTops={tops[colIdx + 1]}
                    height={totalH}
                    left={colLeft + CW}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
