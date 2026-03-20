import React from 'react';

import type { TournamentMatch } from '../../../tournament/types.ts';
import type { BracketLayout } from '../../../tournament/BracketNodes.ts';
import { CONNECTOR_WIDTH, COLUMN_WIDTH } from '../../../tournament/types';

import { BracketConnectors } from './BracketConnectors';
import { NodeCard } from './NodeCard';

interface BracketSectionProps extends BracketLayout {
  onTeamClick: (match: TournamentMatch, team: 1 | 2) => void;
}

export const BracketSection: React.FC<BracketSectionProps> = ({
  nodes,
  tops,
  connectorTypes,
  totalH,
  totalW,
  onTeamClick,
}) => {
  if (nodes.length === 0) return null;

  return (
    <div className="bracket-section">
      <div className="bracket-section-scroll">
        <div style={{ position: 'relative', width: totalW, height: totalH }}>
          {nodes.map((colNodes, colIdx) => {
            const colLeft = colIdx * (COLUMN_WIDTH + CONNECTOR_WIDTH);
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
                    left={colLeft + COLUMN_WIDTH}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
