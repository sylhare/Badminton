import React from 'react';

import { BubbleGraph } from './BubbleGraph';

/**
 * Props for the SinglesGraph component
 */
interface SinglesGraphProps {
  /** Map of player IDs to singles match count */
  singlesData: Record<string, number>;
  /** Function to resolve player ID to display name */
  getPlayerName: (id: string) => string;
}

/**
 * Bubble chart visualization for singles match distribution.
 * Displays players as bubbles sized by how many singles matches they've played.
 * Bubble size and color indicate frequency.
 */
export function SinglesGraph({ singlesData, getPlayerName }: SinglesGraphProps): React.ReactElement | null {
  return <BubbleGraph data={singlesData} getPlayerName={getPlayerName} className="singles-graph" />;
}

export default SinglesGraph;
