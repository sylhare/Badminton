import React from 'react';

import type { BracketNode } from '../../../tournament/bracketTree';
import type { TournamentMatch } from '../../../tournament/types';

import { BracketColumn, COLUMN_GAP, COLUMN_WIDTH, HEADER_HEIGHT } from './BracketColumn';
import { BracketConnectors } from './BracketConnectors';

interface BracketTreeDesktopProps {
  tree: BracketNode[][];
  height: number;
  roundLabel: (round: number, totalRounds: number) => string;
  onTeamClick: (match: TournamentMatch, teamNumber: 1 | 2) => void;
}

/**
 * Classic horizontally-scrollable bracket tree: absolutely-positioned round
 * columns with doubling vertical spacing and SVG elbow connectors between them.
 */
export const BracketTreeDesktop: React.FC<BracketTreeDesktopProps> = ({
  tree,
  height,
  roundLabel,
  onTeamClick,
}) => {
  return (
    <div
      className="bracket-tree"
      style={{
        position: 'relative',
        height,
        width: tree.length * (COLUMN_WIDTH + COLUMN_GAP),
      }}
    >
      {tree.map((nodes, roundIdx) => {
        const round = roundIdx + 1;
        const label = roundLabel(round, tree.length);
        return (
          <div
            key={round}
            style={{
              position: 'absolute',
              left: roundIdx * (COLUMN_WIDTH + COLUMN_GAP),
              top: 0,
              height,
            }}
          >
            <BracketColumn nodes={nodes} round={round} label={label} onTeamClick={onTeamClick} />
            {roundIdx < tree.length - 1 && (
              <BracketConnectors
                fromNodes={nodes}
                toNodes={tree[roundIdx + 1]}
                fromRound={round}
                toRound={round + 1}
                totalHeight={height - HEADER_HEIGHT}
                headerOffset={HEADER_HEIGHT}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
