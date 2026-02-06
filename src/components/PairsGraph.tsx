import React, { useMemo } from 'react';

import { GRAPH_COLORS, getColorForCount, getGlowColorForCount } from '../constants/graphColors';

/**
 * Props for the PairsGraph component
 */
interface PairsGraphProps {
  /** Array of pairs with their display name and count */
  pairsData: Array<{ pair: string; count: number }>;
}

interface PairBubble {
  pair: string;
  count: number;
  x: number;
  y: number;
  radius: number;
}

/** Minimum bubble radius */
const MIN_RADIUS = 30;

/** Maximum bubble radius */
const MAX_RADIUS = 50;

/** Grid cell dimensions */
const CELL_SIZE = 120;

/** Maximum characters to display in bubble labels */
const MAX_PAIR_LENGTH = 16;

/**
 * Truncates pair names for display in bubbles.
 * Splits on separator (&, vs) and truncates each name if needed.
 */
function truncatePairName(pair: string): { line1: string; line2: string } {
  const separators = [' & ', ' vs '];
  for (const sep of separators) {
    if (pair.includes(sep)) {
      const [name1, name2] = pair.split(sep);
      const truncate = (s: string, len: number) =>
        s.length > len ? s.slice(0, len - 1) + '…' : s;
      return {
        line1: truncate(name1, 8),
        line2: truncate(name2, 8),
      };
    }
  }
  return {
    line1: pair.length > MAX_PAIR_LENGTH ? pair.slice(0, MAX_PAIR_LENGTH - 1) + '…' : pair,
    line2: '',
  };
}

/**
 * Bubble chart visualization for pair (teammate/opponent) distribution.
 * Displays pairs as bubbles sized by how many times they've been matched.
 * Bubble size and color indicate frequency.
 */
export function PairsGraph({ pairsData }: PairsGraphProps): React.ReactElement | null {
  const bubbles = useMemo(() => {
    if (pairsData.length === 0) return [];

    const max = Math.max(...pairsData.map(p => p.count));
    const cols = Math.ceil(Math.sqrt(pairsData.length));

    const bubbleList: PairBubble[] = pairsData.map((item, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      const normalizedCount = max > 1 ? (item.count - 1) / (max - 1) : 0;
      const radius = MIN_RADIUS + normalizedCount * (MAX_RADIUS - MIN_RADIUS);
      const offsetX = (Math.random() - 0.5) * 10;
      const offsetY = (Math.random() - 0.5) * 10;

      return {
        pair: item.pair,
        count: item.count,
        x: 70 + col * CELL_SIZE + offsetX,
        y: 70 + row * CELL_SIZE + offsetY,
        radius,
      };
    });

    return bubbleList;
  }, [pairsData]);

  if (bubbles.length === 0) {
    return null;
  }

  const cols = Math.ceil(Math.sqrt(bubbles.length));
  const rows = Math.ceil(bubbles.length / cols);
  const width = Math.max(300, cols * CELL_SIZE + 80);
  const height = Math.max(200, rows * CELL_SIZE + 80);

  return (
    <div className="pairs-graph">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={Math.min(350, height)}
        style={{ maxWidth: '600px', margin: '0 auto', display: 'block' }}
      >
        {bubbles.map(bubble => {
          const { line1, line2 } = truncatePairName(bubble.pair);
          return (
            <g key={bubble.pair}>
              <circle
                cx={bubble.x}
                cy={bubble.y}
                r={bubble.radius + 3}
                fill="none"
                stroke={getGlowColorForCount(bubble.count)}
                strokeWidth={4}
                opacity={0.5}
              />
              <circle
                cx={bubble.x}
                cy={bubble.y}
                r={bubble.radius}
                fill={GRAPH_COLORS.nodeFill}
                stroke={getColorForCount(bubble.count)}
                strokeWidth={3}
              />
              <text
                x={bubble.x}
                y={bubble.y - (line2 ? 12 : 6)}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#c9d1d9"
                fontSize={10}
                fontWeight={500}
                style={{ pointerEvents: 'none' }}
              >
                {line1}
              </text>
              {line2 && (
                <text
                  x={bubble.x}
                  y={bubble.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#c9d1d9"
                  fontSize={10}
                  fontWeight={500}
                  style={{ pointerEvents: 'none' }}
                >
                  {line2}
                </text>
              )}
              <text
                x={bubble.x}
                y={bubble.y + (line2 ? 14 : 10)}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={getColorForCount(bubble.count)}
                fontSize={14}
                fontWeight={700}
                style={{ pointerEvents: 'none' }}
              >
                {bubble.count}×
              </text>
            </g>
          );
        })}
      </svg>

      <div className="graph-legend">
        <div className="legend-item">
          <span className="legend-dot" style={{ background: GRAPH_COLORS.count1 }}></span>
          <span>1×</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: GRAPH_COLORS.count2 }}></span>
          <span>2×</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: GRAPH_COLORS.count3 }}></span>
          <span>3×</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: GRAPH_COLORS.count4Plus }}></span>
          <span>4×+</span>
        </div>
      </div>
    </div>
  );
}

export default PairsGraph;
