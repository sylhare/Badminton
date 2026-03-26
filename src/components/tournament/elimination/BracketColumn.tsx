import React from 'react';

import type { BracketNode } from '../../../tournament/bracketTree';
import type { TournamentMatch } from '../../../tournament/types';

import { BracketMatchNode } from './BracketMatchNode';

export const CARD_HEIGHT = 72;
const CARD_RENDER_HEIGHT = 64;
export const HEADER_HEIGHT = 40;
export const COLUMN_GAP = 48;
export const COLUMN_WIDTH = 180;

interface BracketColumnProps {
  nodes: BracketNode[];
  round: number;
  label: string;
  onTeamClick: (match: TournamentMatch, teamNumber: 1 | 2) => void;
}

/**
 * Returns the top offset in px for a node at the given slot index and round.
 *
 * Round 1: slots are packed (spacing = CARD_HEIGHT)
 * Round N: spacing doubles each round → spacing = CARD_HEIGHT * 2^(round-1)
 * First card is vertically centred within its spacing band.
 */
export function nodeTop(slotIndex: number, round: number): number {
  const spacing = CARD_HEIGHT * Math.pow(2, round - 1);
  const firstOffset = (spacing - CARD_HEIGHT) / 2;
  return firstOffset + slotIndex * spacing;
}

export const BracketColumn: React.FC<BracketColumnProps> = ({
  nodes,
  round,
  label,
  onTeamClick,
}) => {
  return (
    <div className="bracket-column" style={{ width: COLUMN_WIDTH }}>
      <div className="bracket-column-header" data-testid={`bracket-round-label-${label.replace(/\s/g, '-')}`}>
        {label}
      </div>
      <div className="bracket-column-nodes" style={{ position: 'relative' }}>
        {nodes.map(node => (
          <div
            key={node.slotIndex}
            style={{
              position: 'absolute',
              top: nodeTop(node.slotIndex, round) + (CARD_HEIGHT - CARD_RENDER_HEIGHT) / 2,
              width: COLUMN_WIDTH,
            }}
          >
            <BracketMatchNode
              node={node}
              cardHeight={CARD_RENDER_HEIGHT}
              onTeamClick={onTeamClick}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

