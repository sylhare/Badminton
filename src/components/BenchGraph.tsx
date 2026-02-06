import React, { useMemo } from 'react';

/**
 * Props for the BenchGraph component
 */
interface BenchGraphProps {
  /** Map of player IDs to bench count */
  benchData: Record<string, number>;
  /** Function to resolve player ID to display name */
  getPlayerName: (id: string) => string;
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
 * Returns bubble color based on count.
 * Color scale: blue (1×) → yellow (2×) → orange (3×) → red (4×+)
 */
function getBubbleColor(count: number): string {
  if (count >= 4) return '#f85149';
  if (count === 3) return '#f0883e';
  if (count === 2) return '#d29922';
  return '#58a6ff';
}

/**
 * Returns bubble border/glow color based on count.
 */
function getBubbleBorder(count: number): string {
  if (count >= 4) return 'rgba(248, 81, 73, 0.5)';
  if (count === 3) return 'rgba(240, 136, 62, 0.5)';
  if (count === 2) return 'rgba(210, 153, 34, 0.5)';
  return 'rgba(88, 166, 255, 0.5)';
}

/**
 * Bubble chart visualization for bench count distribution.
 * Displays players as bubbles sized by how many times they've been benched.
 * Bubble size and color indicate frequency.
 */
export function BenchGraph({ benchData, getPlayerName }: BenchGraphProps): React.ReactElement | null {
  const { bubbles } = useMemo(() => {
    const entries = Object.entries(benchData).filter(([, count]) => count > 0);
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
  }, [benchData, getPlayerName]);

  if (bubbles.length === 0) {
    return null;
  }

  const cols = Math.ceil(Math.sqrt(bubbles.length));
  const rows = Math.ceil(bubbles.length / cols);
  const width = Math.max(300, cols * CELL_SIZE + 60);
  const height = Math.max(200, rows * CELL_SIZE + 60);

  return (
    <div className="bench-graph">
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
              stroke={getBubbleBorder(bubble.count)}
              strokeWidth={4}
              opacity={0.5}
            />
            <circle
              cx={bubble.x}
              cy={bubble.y}
              r={bubble.radius}
              fill="#21262d"
              stroke={getBubbleColor(bubble.count)}
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
              fill={getBubbleColor(bubble.count)}
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
          <span className="legend-dot" style={{ background: '#58a6ff' }}></span>
          <span>1×</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: '#d29922' }}></span>
          <span>2×</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: '#f0883e' }}></span>
          <span>3×</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: '#f85149' }}></span>
          <span>4×+</span>
        </div>
      </div>
    </div>
  );
}

export default BenchGraph;
