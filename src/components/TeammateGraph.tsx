import React, { useMemo } from 'react';

type GraphVariant = 'teammate' | 'opponent';

interface TeammateGraphProps {
  teammateData: Record<string, number>; // "id1|id2" -> count
  getPlayerName: (id: string) => string;
  variant?: GraphVariant;
}

interface Node {
  id: string;
  name: string;
  x: number;
  y: number;
}

interface Edge {
  source: string;
  target: string;
  count: number;
}

export function TeammateGraph({ teammateData, getPlayerName, variant = 'teammate' }: TeammateGraphProps): React.ReactElement | null {
  const { nodes, edges, maxCount } = useMemo(() => {
    // Get all unique player IDs from teammate pairs
    const playerIds = new Set<string>();
    const edgeList: Edge[] = [];
    let max = 0;

    Object.entries(teammateData).forEach(([pair, count]) => {
      if (count < 1) return;
      const [id1, id2] = pair.split('|');
      playerIds.add(id1);
      playerIds.add(id2);
      edgeList.push({ source: id1, target: id2, count });
      if (count > max) max = count;
    });

    // Position nodes in a circle
    const nodeArray = Array.from(playerIds);
    const centerX = 200;
    const centerY = 200;
    const radius = Math.min(150, Math.max(80, nodeArray.length * 12));

    const nodeList: Node[] = nodeArray.map((id, index) => {
      const angle = (2 * Math.PI * index) / nodeArray.length - Math.PI / 2;
      return {
        id,
        name: getPlayerName(id),
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      };
    });

    return { nodes: nodeList, edges: edgeList, maxCount: max };
  }, [teammateData, getPlayerName]);

  if (nodes.length === 0) {
    return null;
  }

  // Calculate viewBox based on content
  const padding = 60;
  const size = 400;

  // Get stroke width based on count (min 1, max 8)
  const getStrokeWidth = (count: number): number => {
    if (maxCount <= 1) return 2;
    return 1 + (count / maxCount) * 7;
  };

  // Get opacity based on count
  const getOpacity = (count: number): number => {
    if (maxCount <= 1) return 0.6;
    return 0.3 + (count / maxCount) * 0.5;
  };

  // Get color based on count (consistent across all graphs)
  const getStrokeColor = (count: number): string => {
    if (count >= 4) return '#f85149'; // red for 4+
    if (count === 3) return '#f0883e'; // orange for 3
    if (count === 2) return '#d29922'; // yellow for 2
    return '#58a6ff'; // blue for 1
  };

  const baseColor = '#58a6ff';
  const nodeStrokeColor = variant === 'opponent' ? '#a371f7' : '#58a6ff';

  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  return (
    <div className="teammate-graph">
      <svg 
        viewBox={`0 0 ${size} ${size}`} 
        width="100%" 
        height="300"
        style={{ maxWidth: '500px', margin: '0 auto', display: 'block' }}
      >
        {/* Edges */}
        {edges.map(edge => {
          const source = nodeMap.get(edge.source);
          const target = nodeMap.get(edge.target);
          if (!source || !target) return null;

          return (
            <line
              key={`${edge.source}-${edge.target}`}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke={getStrokeColor(edge.count)}
              strokeWidth={getStrokeWidth(edge.count)}
              opacity={getOpacity(edge.count)}
              strokeLinecap="round"
            />
          );
        })}

        {/* Nodes */}
        {nodes.map(node => (
          <g key={node.id}>
            <circle
              cx={node.x}
              cy={node.y}
              r={20}
              fill="#21262d"
              stroke={nodeStrokeColor}
              strokeWidth={2}
            />
            <text
              x={node.x}
              y={node.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#c9d1d9"
              fontSize={10}
              fontWeight={500}
              style={{ pointerEvents: 'none' }}
            >
              {node.name.length > 6 ? node.name.slice(0, 5) + '…' : node.name}
            </text>
          </g>
        ))}
      </svg>

      {/* Legend */}
      <div className="graph-legend">
        <div className="legend-item">
          <span className="legend-line thin" style={{ background: '#58a6ff' }}></span>
          <span>1×</span>
        </div>
        <div className="legend-item">
          <span className="legend-line" style={{ background: '#d29922', width: '24px', height: '3px' }}></span>
          <span>2×</span>
        </div>
        <div className="legend-item">
          <span className="legend-line" style={{ background: '#f0883e', width: '24px', height: '5px' }}></span>
          <span>3×</span>
        </div>
        <div className="legend-item">
          <span className="legend-line thick" style={{ background: '#f85149' }}></span>
          <span>4×+</span>
        </div>
      </div>
    </div>
  );
}

export default TeammateGraph;
