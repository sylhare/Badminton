import React from 'react';

import type { BracketNode } from '../../../tournament/bracketTree';
import type { TournamentMatch } from '../../../tournament/types';

import BracketMatchNode from './BracketMatchNode';

/** Height of one card/slot in px */
export const CARD_HEIGHT = 72;
/** Gap between columns in px */
export const COLUMN_GAP = 48;
/** Width of one column in px */
export const COLUMN_WIDTH = 180;

interface BracketColumnProps {
  nodes: BracketNode[];
  /** 1-based round number */
  round: number;
  /** Total rounds in this bracket */
  totalRounds: number;
  /** Round header label (e.g. "Semi Final") */
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

/** Total pixel height needed to contain the entire bracket column */
export function columnHeight(bracketSize: number): number {
  return bracketSize * CARD_HEIGHT;
}

const BracketColumn: React.FC<BracketColumnProps> = ({
  nodes,
  round,
  totalRounds: _totalRounds,
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
              top: nodeTop(node.slotIndex, round),
              width: COLUMN_WIDTH,
            }}
          >
            <BracketMatchNode
              node={node}
              cardHeight={CARD_HEIGHT}
              onTeamClick={onTeamClick}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default BracketColumn;
