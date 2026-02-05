import React, { useMemo } from 'react';

interface SinglesGraphProps {
  singlesData: Record<string, number>; // playerId -> count
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

export function SinglesGraph({ singlesData, getPlayerName }: SinglesGraphProps): React.ReactElement | null {
  const { bubbles, maxCount } = useMemo(() => {
    const entries = Object.entries(singlesData).filter(([, count]) => count > 0);
    if (entries.length === 0) return { bubbles: [], maxCount: 0 };

    const max = Math.max(...entries.map(([, count]) => count));
    const minRadius = 25;
    const maxRadius = 45;

    // Sort by count descending for better layout
    entries.sort((a, b) => b[1] - a[1]);

    // Simple grid layout with some randomization for visual interest
    const cols = Math.ceil(Math.sqrt(entries.length));
    const cellWidth = 100;
    const cellHeight = 100;

    const bubbleList: PlayerBubble[] = entries.map(([id, count], index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      
      // Calculate radius based on count
      const normalizedCount = max > 1 ? (count - 1) / (max - 1) : 0;
      const radius = minRadius + normalizedCount * (maxRadius - minRadius);

      // Add slight offset for visual variety
      const offsetX = (Math.random() - 0.5) * 10;
      const offsetY = (Math.random() - 0.5) * 10;

      return {
        id,
        name: getPlayerName(id),
        count,
        x: 60 + col * cellWidth + offsetX,
        y: 60 + row * cellHeight + offsetY,
        radius,
      };
    });

    return { bubbles: bubbleList, maxCount: max };
  }, [singlesData, getPlayerName]);

  if (bubbles.length === 0) {
    return null;
  }

  // Calculate viewBox based on content
  const cols = Math.ceil(Math.sqrt(bubbles.length));
  const rows = Math.ceil(bubbles.length / cols);
  const width = Math.max(300, cols * 100 + 60);
  const height = Math.max(200, rows * 100 + 60);

  // Get color based on count (consistent across all graphs)
  const getBubbleColor = (count: number): string => {
    if (count >= 4) return '#f85149'; // red - 4+
    if (count === 3) return '#f0883e'; // orange - 3
    if (count === 2) return '#d29922'; // yellow - 2
    return '#58a6ff'; // blue - 1
  };

  const getBubbleBorder = (count: number): string => {
    if (count >= 4) return 'rgba(248, 81, 73, 0.5)';
    if (count === 3) return 'rgba(240, 136, 62, 0.5)';
    if (count === 2) return 'rgba(210, 153, 34, 0.5)';
    return 'rgba(88, 166, 255, 0.5)';
  };

  return (
    <div className="singles-graph">
      <svg 
        viewBox={`0 0 ${width} ${height}`} 
        width="100%" 
        height={Math.min(300, height)}
        style={{ maxWidth: '500px', margin: '0 auto', display: 'block' }}
      >
        {bubbles.map(bubble => (
          <g key={bubble.id}>
            {/* Outer glow */}
            <circle
              cx={bubble.x}
              cy={bubble.y}
              r={bubble.radius + 3}
              fill="none"
              stroke={getBubbleBorder(bubble.count)}
              strokeWidth={4}
              opacity={0.5}
            />
            {/* Main bubble */}
            <circle
              cx={bubble.x}
              cy={bubble.y}
              r={bubble.radius}
              fill="#21262d"
              stroke={getBubbleColor(bubble.count)}
              strokeWidth={3}
            />
            {/* Player name */}
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
              {bubble.name.length > 8 ? bubble.name.slice(0, 7) + '…' : bubble.name}
            </text>
            {/* Count */}
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

      {/* Legend */}
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

export default SinglesGraph;
