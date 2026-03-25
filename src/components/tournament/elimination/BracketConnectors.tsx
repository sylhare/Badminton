import React from 'react';

import type { BracketNode } from '../../../tournament/bracketTree';

import { CARD_HEIGHT, COLUMN_GAP, COLUMN_WIDTH, nodeTop } from './BracketColumn';

interface BracketConnectorsProps {
  /** Nodes in the left (source) column */
  fromNodes: BracketNode[];
  /** Nodes in the right (target) column */
  toNodes: BracketNode[];
  /** 1-based round number of the LEFT column */
  fromRound: number;
  /** 1-based round number of the RIGHT column */
  toRound: number;
  /** Total height of the bracket in px */
  totalHeight: number;
  /** Vertical offset from column top to card area (header height) */
  headerOffset: number;
}

/**
 * Draws SVG elbow connectors between adjacent columns.
 * Each target node connects to the two source nodes that feed into it.
 *
 * The SVG is absolutely positioned in the gap between two columns,
 * with width = COLUMN_GAP and height = totalHeight.
 */
const BracketConnectors: React.FC<BracketConnectorsProps> = ({
  fromNodes,
  toNodes,
  fromRound,
  toRound,
  totalHeight,
  headerOffset,
}) => {
  const paths: string[] = [];

  for (const toNode of toNodes) {
    if (toNode.type === 'empty') continue;

    // The two source positions feeding into this target
    const srcIdx0 = 2 * toNode.slotIndex;
    const srcIdx1 = 2 * toNode.slotIndex + 1;

    const fromNode0 = fromNodes[srcIdx0];
    const fromNode1 = fromNodes[srcIdx1];

    if (!fromNode0 || !fromNode1) continue;
    if (fromNode0.type === 'empty' && fromNode1.type === 'empty') continue;

    const fromTop0 = nodeTop(fromNode0.slotIndex, fromRound);
    const fromTop1 = nodeTop(fromNode1.slotIndex, fromRound);
    const toTop = nodeTop(toNode.slotIndex, toRound);

    // Mid-y of each source card
    const y0 = fromTop0 + CARD_HEIGHT / 2;
    const y1 = fromTop1 + CARD_HEIGHT / 2;
    // Mid-y of target card
    const yTarget = toTop + CARD_HEIGHT / 2;

    // x: left edge of SVG = right edge of left column = 0 in SVG coords
    // x: right edge = COLUMN_GAP
    const xLeft = 0;
    const xMid = COLUMN_GAP / 2;
    const xRight = COLUMN_GAP;

    // Draw two elbows: one from each source to the midpoint, then connect to target
    // Elbow for fromNode0
    if (fromNode0.type !== 'empty') {
      paths.push(`M ${xLeft} ${y0} H ${xMid} V ${yTarget} H ${xRight}`);
    }
    // Elbow for fromNode1
    if (fromNode1.type !== 'empty') {
      paths.push(`M ${xLeft} ${y1} H ${xMid} V ${yTarget} H ${xRight}`);
    }
  }

  return (
    <svg
      className="bracket-connectors"
      style={{
        position: 'absolute',
        top: headerOffset,
        left: COLUMN_WIDTH,
        width: COLUMN_GAP,
        height: totalHeight,
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      {paths.map((d, i) => (
        <path key={i} d={d} className="bracket-connector-path" />
      ))}
    </svg>
  );
};

export default BracketConnectors;
