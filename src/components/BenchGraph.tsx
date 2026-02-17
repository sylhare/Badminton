import React from 'react';

import { BubbleGraph } from './BubbleGraph';

/**
 * Props for the BenchGraph component
 */
interface BenchGraphProps {
  /** Map of player IDs to bench count */
  benchData: Record<string, number>;
  /** Function to resolve player ID to display name */
  getPlayerName: (id: string) => string;
}

/**
 * Bubble chart visualization for bench count distribution.
 * Displays players as bubbles sized by how many times they've been benched.
 * Bubble size and color indicate frequency.
 */
export function BenchGraph({ benchData, getPlayerName }: BenchGraphProps): React.ReactElement | null {
  return <BubbleGraph data={benchData} getPlayerName={getPlayerName} className="bench-graph" />;
}

export default BenchGraph;
