import { countTier } from '../constants/graphColors';
import type { CountTier } from '../constants/graphColors';
import type { Player } from '../types';
import { splitPairKey } from '../utils/playerUtils';

export type CountMap = Record<string, number>;

export interface DiagnosticMaps {
  bench: CountMap;
  teammate: CountMap;
  opponent: CountMap;
  single: CountMap;
  win: CountMap;
  loss: CountMap;
  levelHistory?: Record<string, number[]>;
  roundsPlayed?: number;
}

/**
 * Diagnostic statistics for the current session.
 * Provides insights into algorithm fairness and player distribution.
 */
export interface DiagnosticStats {
  totalPlayers: number;
  totalRounds: number;
  /** Number of players benched exactly once */
  benchedOnce: number;
  /** Number of players benched more than once */
  benchedMultiple: number;
  /** Number of players never benched */
  neverBenched: number;
  /** Maximum bench count among all players */
  maxBenchCount: number;
  /** Minimum bench count among all players */
  minBenchCount: number;
  /** Standard deviation of bench counts. Lower is better (0 = perfectly fair) */
  benchFairnessScore: number;
  /** Top 10 pairs who have teamed up more than once */
  repeatedTeammates: Array<{ pair: string; count: number }>;
  /** Top 10 pairs who have faced each other more than once */
  repeatedOpponents: Array<{ pair: string; count: number }>;
  /** Players who have played singles matches, sorted by count */
  singlesPlayers: Array<{ player: string; count: number }>;
  /** Number of players who played singles more than once */
  playersWithMultipleSingles: number;
  /** Context-aware warnings about algorithm fairness */
  warnings: string[];
}

/** Sums all values in a count map */
export const sumValues = (map: CountMap): number =>
  Object.values(map).reduce((a, b) => a + b, 0);

/** Checks if a count map has any entries */
export const hasEntries = (map: CountMap): boolean =>
  Object.keys(map).length > 0;

/** Gets min value from count map, or 0 if empty */
export const getMin = (map: CountMap): number => {
  const values = Object.values(map);
  return values.length > 0 ? Math.min(...values) : 0;
};

/** Gets max value from count map, or 0 if empty */
export const getMax = (map: CountMap): number => {
  const values = Object.values(map);
  return values.length > 0 ? Math.max(...values) : 0;
};

/**
 * Resolves a player ID to their display name.
 * @param players - Roster to search
 * @param playerId - The unique identifier for the player
 * @returns The player's name, or 'removed' if not found
 */
export const getPlayerName = (players: Player[], playerId: string): string => {
  const player = players.find(p => p.id === playerId);
  return player?.name || 'removed';
};

/**
 * Formats a pair key (e.g., "id1|id2") using player names.
 * @param players - Roster to resolve names from
 * @param pairKey - The pipe-separated pair of player IDs
 * @param separator - The separator to use between names (e.g., " & " or " vs ")
 */
export const formatPair = (players: Player[], pairKey: string, separator: string): string => {
  const [id1, id2] = splitPairKey(pairKey);
  return `${getPlayerName(players, id1)}${separator}${getPlayerName(players, id2)}`;
};

/**
 * Returns the CSS class for fairness score styling.
 * @param score - The fairness score (standard deviation of bench counts)
 * @returns CSS class name: 'good' (<1), 'neutral' (<2), or 'warning'
 */
export const getFairnessClass = (score: number): string => {
  if (score < 1) return 'good';
  if (score < 2) return 'neutral';
  return 'warning';
};

const CHIP_CLASS_BY_TIER: Record<CountTier, string> = {
  count1: 'low',
  count2: 'medium',
  count3: 'medium-high',
  count4Plus: 'high',
};

/**
 * Returns the CSS class for bench count chip styling.
 * @param count - The number of times a player has been benched
 * @returns CSS class name based on severity: 'low', 'medium', 'medium-high', or 'high'
 */
export const getChipClass = (count: number): string => CHIP_CLASS_BY_TIER[countTier(count)];

/**
 * Extracts repeated pairs from a count map.
 * @param players - Roster to resolve names from
 * @param map - The count map (teammate or opponent)
 * @param separator - The separator for display (' & ' or ' vs ')
 * @returns Top 10 pairs with count > 1, sorted descending
 */
export const getRepeatedPairs = (
  players: Player[],
  map: CountMap,
  separator: string,
): Array<{ pair: string; count: number }> =>
  Object.entries(map)
    .filter(([, count]) => count > 1)
    .map(([pair, count]) => ({ pair: formatPair(players, pair, separator), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

/**
 * Calculates warning threshold for repeated pairings.
 * @param expectedAvg - The expected average pairings
 * @returns Threshold: max of 4, 2x average, or average + 3
 */
export const getWarningThreshold = (expectedAvg: number): number =>
  Math.max(4, Math.ceil(expectedAvg * 2), Math.ceil(expectedAvg) + 3);

/**
 * Computes comprehensive diagnostic statistics from the engine state maps.
 * Analyzes bench distribution, teammate/opponent repetitions, singles matches,
 * and generates context-aware warnings when fairness thresholds are exceeded.
 * @returns DiagnosticStats object or null if no data available
 */
export function computeDiagnostics(
  maps: DiagnosticMaps,
  players: Player[],
): DiagnosticStats | null {
  const playersFromTeammates = new Set<string>();
  Object.keys(maps.teammate).forEach(pair => {
    const [id1, id2] = splitPairKey(pair);
    playersFromTeammates.add(id1);
    playersFromTeammates.add(id2);
  });

  const allPlayers = new Set([
    ...playersFromTeammates,
    ...Object.keys(maps.bench),
    ...Object.keys(maps.win),
    ...Object.keys(maps.loss),
    ...Object.keys(maps.single),
  ]);

  const totalPlayers = allPlayers.size;
  if (totalPlayers === 0) return null;

  const totalTeammatePairings = sumValues(maps.teammate);
  const totalSinglesMatches = sumValues(maps.single) / 2;
  const totalDoublesMatches = totalTeammatePairings / 2;
  const maxBenchFromData = getMax(maps.bench);
  const totalMatchesEstimate = totalDoublesMatches + totalSinglesMatches;

  const playersPerRound = Math.max(4, totalPlayers - 1);
  const matchesPerRound = Math.max(1, Math.floor(playersPerRound / 4) + (playersPerRound % 4 >= 2 ? 1 : 0));
  const roundsFromMatches = matchesPerRound > 0 ? Math.ceil(totalMatchesEstimate / matchesPerRound) : 0;
  const internalRounds = Math.max(maxBenchFromData, roundsFromMatches, 1);
  const storedRoundsPlayed = maps.roundsPlayed ?? 0;
  const totalRounds = storedRoundsPlayed > 0 ? storedRoundsPlayed : internalRounds;

  const benchCounts = Object.values(maps.bench);
  const benchedOnce = benchCounts.filter(c => c === 1).length;
  const benchedMultiple = benchCounts.filter(c => c > 1).length;
  const neverBenched = totalPlayers - Object.keys(maps.bench).length;
  const maxBenchCount = maxBenchFromData;
  const minBenchCount = getMin(maps.bench);

  const avgBench = benchCounts.length > 0
    ? benchCounts.reduce((a, b) => a + b, 0) / benchCounts.length
    : 0;
  const benchVariance = benchCounts.length > 0
    ? benchCounts.reduce((sum, c) => sum + Math.pow(c - avgBench, 2), 0) / benchCounts.length
    : 0;
  const benchFairnessScore = Math.round(Math.sqrt(benchVariance) * 100) / 100;

  const repeatedTeammates = getRepeatedPairs(players, maps.teammate, ' & ');
  const repeatedOpponents = getRepeatedPairs(players, maps.opponent, ' vs ');

  const singlesPlayers = Object.entries(maps.single)
    .map(([playerId, count]) => ({ player: getPlayerName(players, playerId), count }))
    .sort((a, b) => b.count - a.count);
  const playersWithMultipleSingles = singlesPlayers.filter(p => p.count > 1).length;

  const warnings: string[] = [];
  const possiblePairs = totalPlayers > 1 ? (totalPlayers * (totalPlayers - 1)) / 2 : 1;

  const expectedTeammateAvg = possiblePairs > 0 ? totalTeammatePairings / possiblePairs : 0;
  const expectedOpponentAvg = possiblePairs > 0 ? sumValues(maps.opponent) / possiblePairs : 0;
  const totalSinglesPlayed = sumValues(maps.single);
  const expectedSinglesPerPlayer = totalPlayers > 0 ? totalSinglesPlayed / totalPlayers : 0;

  const expectedBenchSpread = Math.ceil(Math.sqrt(internalRounds)) + 1;
  if (maxBenchCount - minBenchCount > expectedBenchSpread + 2) {
    warnings.push(`Bench imbalance: spread of ${maxBenchCount - minBenchCount} (expected ~${expectedBenchSpread} for ${internalRounds} rounds)`);
  }

  const maxSingles = singlesPlayers.length > 0 ? singlesPlayers[0].count : 0;
  if (maxSingles > expectedSinglesPerPlayer + 1.5 && totalSinglesPlayed > 0) {
    const overPlayedSingles = singlesPlayers.filter(p => p.count > expectedSinglesPerPlayer + 1);
    if (overPlayedSingles.length > 0) {
      warnings.push(`${overPlayedSingles.length} player(s) played singles ${Math.round(expectedSinglesPerPlayer + 1.5)}+ times (expected ~${expectedSinglesPerPlayer.toFixed(1)} each)`);
    }
  }

  const teammateThreshold = getWarningThreshold(expectedTeammateAvg);
  const highRepeatTeammates = repeatedTeammates.filter(t => t.count >= teammateThreshold);
  if (highRepeatTeammates.length > 0) {
    warnings.push(`${highRepeatTeammates.length} pair(s) teamed up ${teammateThreshold}+ times (avg is ${expectedTeammateAvg.toFixed(1)})`);
  }

  const opponentThreshold = getWarningThreshold(expectedOpponentAvg);
  const highRepeatOpponents = repeatedOpponents.filter(o => o.count >= opponentThreshold);
  if (highRepeatOpponents.length > 0) {
    warnings.push(`${highRepeatOpponents.length} pair(s) faced each other ${opponentThreshold}+ times (avg is ${expectedOpponentAvg.toFixed(1)})`);
  }

  return {
    totalPlayers,
    totalRounds,
    benchedOnce,
    benchedMultiple,
    neverBenched,
    maxBenchCount,
    minBenchCount,
    benchFairnessScore,
    repeatedTeammates,
    repeatedOpponents,
    singlesPlayers,
    playersWithMultipleSingles,
    warnings,
  };
}
