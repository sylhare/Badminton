import React, { useMemo } from 'react';

import { getColorForCount, getGlowColorForCount, GRAPH_COLORS } from '../constants/graphColors';

/**
 * Props for the BubbleGraph component
 */
interface BubbleGraphProps {
  /** Map of player IDs to count */
  data: Record<string, number>;
  /** Function to resolve player ID to display name */
  getPlayerName: (id: string) => string;
  /** CSS class name for the graph container */
  className?: string;
}

interface PlayerBubble {
  id: string;
  name: string;
  count: number;
  x: number;
  y: number;
  radius: number;
}

/** Minimum bubble radius */
const MIN_RADIUS = 25;

/** Maximum bubble radius */
const MAX_RADIUS = 45;

/** Grid cell dimensions */
const CELL_SIZE = 100;

/** Maximum characters to display in bubble labels */
const MAX_NAME_LENGTH = 8;

/**
 * Generic bubble chart visualization for player count distribution.
 * Displays players as bubbles sized by frequency.
 * Bubble size and color indicate frequency.
 */
export function BubbleGraph({ data, getPlayerName, className = 'bubble-graph' }: BubbleGraphProps): React.ReactElement | null {
  const { bubbles } = useMemo(() => {
    const entries = Object.entries(data).filter(([, count]) => count > 0);
    if (entries.length === 0) return { bubbles: [], maxCount: 0 };

    const max = Math.max(...entries.map(([, count]) => count));
    entries.sort((a, b) => b[1] - a[1]);

    const cols = Math.ceil(Math.sqrt(entries.length));

    const bubbleList: PlayerBubble[] = entries.map(([id, count], index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      const normalizedCount = max > 1 ? (count - 1) / (max - 1) : 0;
      const radius = MIN_RADIUS + normalizedCount * (MAX_RADIUS - MIN_RADIUS);
      const offsetX = (Math.random() - 0.5) * 10;
      const offsetY = (Math.random() - 0.5) * 10;

      return {
        id,
        name: getPlayerName(id),
        count,
        x: 60 + col * CELL_SIZE + offsetX,
        y: 60 + row * CELL_SIZE + offsetY,
        radius,
      };
    });

    return { bubbles: bubbleList, maxCount: max };
  }, [data, getPlayerName]);

  if (bubbles.length === 0) {
    return null;
  }

  const cols = Math.ceil(Math.sqrt(bubbles.length));
  const rows = Math.ceil(bubbles.length / cols);
  const width = Math.max(300, cols * CELL_SIZE + 60);
  const height = Math.max(200, rows * CELL_SIZE + 60);

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={Math.min(300, height)}
        style={{ maxWidth: '500px', margin: '0 auto', display: 'block' }}
      >
        {bubbles.map(bubble => (
          <g key={bubble.id}>
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
              y={bubble.y - 6}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#c9d1d9"
              fontSize={11}
              fontWeight={500}
              style={{ pointerEvents: 'none' }}
            >
              {bubble.name.length > MAX_NAME_LENGTH ? bubble.name.slice(0, MAX_NAME_LENGTH - 1) + '…' : bubble.name}
            </text>
            <text
              x={bubble.x}
              y={bubble.y + 10}
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
        ))}
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

export default BubbleGraph;
