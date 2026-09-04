/**
 * Color scheme for graph visualizations.
 * Used across all graph components (TeammateGraph, SinglesGraph, BenchGraph, PairsGraph).
 */
export const GRAPH_COLORS = {
  /** Blue - count of 1 */
  count1: '#58a6ff',
  /** Yellow - count of 2 */
  count2: '#d29922',
  /** Orange - count of 3 */
  count3: '#f0883e',
  /** Red - count of 4 or more */
  count4Plus: '#f85149',
  /** Dark background fill for nodes */
  nodeFill: '#21262d',
  /** Blue stroke for teammate variant nodes */
  teammateStroke: '#58a6ff',
  /** Purple stroke for opponent variant nodes */
  opponentStroke: '#a371f7',
} as const;

/** Semi-transparent glow colors for bubble borders */
export const GRAPH_GLOW_COLORS = {
  count1: 'rgba(88, 166, 255, 0.5)',
  count2: 'rgba(210, 153, 34, 0.5)',
  count3: 'rgba(240, 136, 62, 0.5)',
  count4Plus: 'rgba(248, 81, 73, 0.5)',
} as const;

/** Legend labels used in graph components */
export const GRAPH_LEGEND_LABELS = ['1×', '2×', '3×', '4×+'] as const;

export type CountTier = 'count1' | 'count2' | 'count3' | 'count4Plus';

/** Bucket a repetition count into its colour tier. */
export function countTier(count: number): CountTier {
  if (count >= 4) return 'count4Plus';
  if (count === 3) return 'count3';
  if (count === 2) return 'count2';
  return 'count1';
}

/** The node colour for a given repetition count. */
export function getColorForCount(count: number): string {
  return GRAPH_COLORS[countTier(count)];
}

/** The glow/border colour for a given repetition count. */
export function getGlowColorForCount(count: number): string {
  return GRAPH_GLOW_COLORS[countTier(count)];
}
