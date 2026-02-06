import React, { useMemo } from 'react';

import { GRAPH_COLORS, getColorForCount } from '../constants/graphColors';

type GraphVariant = 'teammate' | 'opponent';

/**
 * Props for the TeammateGraph component
 */
interface TeammateGraphProps {
  /** Map of player pair keys ("id1|id2") to pairing count */
  teammateData: Record<string, number>;
  /** Function to resolve player ID to display name */
  getPlayerName: (id: string) => string;
  /** Visual variant - affects node border color */
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

/** Minimum arc length per node to prevent overlap (diameter + spacing) */
const MIN_ARC_PER_NODE = 50;

/** Minimum circle radius for small player groups */
const BASE_RADIUS = 80;

/** Maximum display size before scrolling is enabled */
const MAX_DISPLAY_SIZE = 400;

/** Fixed node circle radius */
const NODE_RADIUS = 20;

/** Fixed font size for node labels */
const FONT_SIZE = 10;

/** Maximum characters to display in node labels */
const MAX_NAME_LENGTH = 6;

/**
 * Calculates the circle radius needed to fit all nodes without overlap.
 * Uses circumference calculation: each node needs MIN_ARC_PER_NODE pixels of arc length.
 */
function calculateRadius(nodeCount: number): number {
  const circumferenceNeeded = nodeCount * MIN_ARC_PER_NODE;
  const radiusFromCircumference = circumferenceNeeded / (2 * Math.PI);
  return Math.max(BASE_RADIUS, radiusFromCircumference);
}

/**
 * Calculates canvas size based on radius (diameter + padding for nodes).
 */
function calculateCanvasSize(radius: number): number {
  return (radius * 2) + 50;
}

/**
 * Network graph visualization for teammate/opponent connections.
 * Displays players as nodes in a circle with edges showing pairing frequency.
 * Edge thickness and color indicate how often players have been paired.
 */
export function TeammateGraph({ teammateData, getPlayerName, variant = 'teammate' }: TeammateGraphProps): React.ReactElement | null {
  const { nodes, edges, maxCount } = useMemo(() => {
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

    const nodeArray = Array.from(playerIds);
    const radius = calculateRadius(nodeArray.length);
    const canvasSize = calculateCanvasSize(radius);
    const center = canvasSize / 2;

    const nodeList: Node[] = nodeArray.map((id, index) => {
      const angle = (2 * Math.PI * index) / nodeArray.length - Math.PI / 2;
      return {
        id,
        name: getPlayerName(id),
        x: center + radius * Math.cos(angle),
        y: center + radius * Math.sin(angle),
      };
    });

    return { nodes: nodeList, edges: edgeList, maxCount: max, canvasSize };
  }, [teammateData, getPlayerName]);

  if (nodes.length === 0) {
    return null;
  }

  const { canvasSize } = useMemo(() => {
    const radius = calculateRadius(nodes.length);
    return { canvasSize: calculateCanvasSize(radius) };
  }, [nodes.length]);

  /**
   * Returns stroke width scaled by count relative to max (range: 1-8px).
   */
  const getStrokeWidth = (count: number): number => {
    if (maxCount <= 1) return 2;
    return 1 + (count / maxCount) * 7;
  };

  /**
   * Returns opacity scaled by count relative to max (range: 0.3-0.8).
   */
  const getOpacity = (count: number): number => {
    if (maxCount <= 1) return 0.6;
    return 0.3 + (count / maxCount) * 0.5;
  };

  const nodeStrokeColor = variant === 'opponent' ? GRAPH_COLORS.opponentStroke : GRAPH_COLORS.teammateStroke;
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const needsScroll = canvasSize > MAX_DISPLAY_SIZE;
  const displaySize = Math.min(canvasSize, MAX_DISPLAY_SIZE);

  return (
    <div className="teammate-graph">
      <div
        style={{
          overflow: needsScroll ? 'auto' : 'visible',
          maxHeight: needsScroll ? '400px' : 'none',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <svg
          viewBox={`0 0 ${canvasSize} ${canvasSize}`}
          width={displaySize}
          height={displaySize}
          style={{ display: 'block', flexShrink: 0 }}
        >
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
              stroke={getColorForCount(edge.count)}
              strokeWidth={getStrokeWidth(edge.count)}
              opacity={getOpacity(edge.count)}
              strokeLinecap="round"
            />
          );
        })}

        {nodes.map(node => (
          <g key={node.id}>
            <circle
              cx={node.x}
              cy={node.y}
              r={NODE_RADIUS}
              fill={GRAPH_COLORS.nodeFill}
              stroke={nodeStrokeColor}
              strokeWidth={2}
            />
            <text
              x={node.x}
              y={node.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#c9d1d9"
              fontSize={FONT_SIZE}
              fontWeight={500}
              style={{ pointerEvents: 'none' }}
            >
              {node.name.length > MAX_NAME_LENGTH ? node.name.slice(0, MAX_NAME_LENGTH - 1) + '…' : node.name}
            </text>
          </g>
        ))}
        </svg>
      </div>

      <div className="graph-legend">
        <div className="legend-item">
          <span className="legend-line thin" style={{ background: GRAPH_COLORS.count1 }}></span>
          <span>1×</span>
        </div>
        <div className="legend-item">
          <span className="legend-line" style={{ background: GRAPH_COLORS.count2, width: '24px', height: '3px' }}></span>
          <span>2×</span>
        </div>
        <div className="legend-item">
          <span className="legend-line" style={{ background: GRAPH_COLORS.count3, width: '24px', height: '5px' }}></span>
          <span>3×</span>
        </div>
        <div className="legend-item">
          <span className="legend-line thick" style={{ background: GRAPH_COLORS.count4Plus }}></span>
          <span>4×+</span>
        </div>
      </div>
    </div>
  );
}

export default TeammateGraph;
