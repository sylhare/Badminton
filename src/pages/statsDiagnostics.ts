import { countTier } from '../constants/graphColors';
import type { CountTier } from '../constants/graphColors';
import type { EngineSnapshot, Player } from '../types';
import { mean, sum } from '../utils/numberUtils';
import { splitPairKey } from '../utils/playerUtils';

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
  /** Players who have been benched, sorted by count */
  benchPlayers: Array<{ player: string; count: number }>;
  /** Players who have played singles matches, sorted by count */
  singlesPlayers: Array<{ player: string; count: number }>;
  /** Number of players who played singles more than once */
  playersWithMultipleSingles: number;
  /** Context-aware warnings about algorithm fairness */
  warnings: string[];
}

export const getPlayerName = (players: Player[], playerId: string): string => {
  const player = players.find(p => p.id === playerId);
  return player?.name || 'removed';
};

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

export const getChipClass = (count: number): string => CHIP_CLASS_BY_TIER[countTier(count)];

export const hasEntries = (map?: Record<string, unknown> | null): boolean => {
  if (!map) return false;
  for (const _ in map) return true;
  return false;
};

function formatRepeatedPairs(
  playerNameMap: Map<string, string>,
  map: Record<string, number>,
  separator: string,
): Array<{ pair: string; count: number }> {
  return Object.entries(map)
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([pair, count]) => {
      const [id1, id2] = splitPairKey(pair);
      return { pair: `${playerNameMap.get(id1) || 'removed'} ${separator} ${playerNameMap.get(id2) || 'removed'}`, count };
    });
}

function addPairWarning(
  warnings: string[],
  pairs: Array<{ pair: string; count: number }>,
  expectedAvg: number,
  label: string,
): void {
  const threshold = Math.max(4, Math.ceil(expectedAvg * 2), Math.ceil(expectedAvg) + 3);
  const highPairs = pairs.filter(p => p.count >= threshold);
  if (highPairs.length > 0) {
    warnings.push(`${highPairs.length} pair(s) ${label} ${threshold}+ times (avg is ${expectedAvg.toFixed(1)})`);
  }
}

export function computeDiagnostics(
  snapshot: EngineSnapshot | null,
  players: Player[],
): DiagnosticStats | null {
  if (!snapshot || players.length === 0) return null;

  const maps = [
    snapshot.benchCountMap, snapshot.teammateCountMap, snapshot.opponentCountMap,
    snapshot.singleCountMap, snapshot.winCountMap, snapshot.lossCountMap,
  ];
  if (!maps.some(hasEntries)) return null;

  const totalPlayers = players.length;
  const totalRounds = snapshot.roundsPlayed || 1;

  const playerNameMap = new Map(players.map(p => [p.id, p.name]));

  const benchCounts = Object.values(snapshot.benchCountMap);
  const benchedOnce = benchCounts.filter(c => c === 1).length;
  const benchedMultiple = benchCounts.filter(c => c > 1).length;
  const neverBenched = totalPlayers - benchCounts.length;
  const maxBenchCount = benchCounts.length > 0 ? Math.max(...benchCounts) : 0;
  const minBenchCount = benchCounts.length > 0 ? Math.min(...benchCounts) : 0;

  const avgBench = mean(benchCounts);
  const benchVariance = benchCounts.length > 0
    ? mean(benchCounts.map(c => Math.pow(c - avgBench, 2)))
    : 0;
  const benchFairnessScore = Math.round(Math.sqrt(benchVariance) * 100) / 100;

  const repeatedTeammates = formatRepeatedPairs(playerNameMap, snapshot.teammateCountMap, '&');
  const repeatedOpponents = formatRepeatedPairs(playerNameMap, snapshot.opponentCountMap, 'vs');

  const benchPlayers = Object.entries(snapshot.benchCountMap)
    .map(([playerId, count]) => ({ player: playerNameMap.get(playerId) || 'removed', count }))
    .sort((a, b) => b.count - a.count);

  const singlesPlayers = Object.entries(snapshot.singleCountMap)
    .map(([playerId, count]) => ({ player: playerNameMap.get(playerId) || 'removed', count }))
    .sort((a, b) => b.count - a.count);
  const playersWithMultipleSingles = singlesPlayers.filter(p => p.count > 1).length;

  const warnings: string[] = [];
  const possiblePairs = Math.max(1, (totalPlayers * (totalPlayers - 1)) / 2);

  const totalTeammatePairings = sum(Object.values(snapshot.teammateCountMap));
  const totalOpponentPairings = sum(Object.values(snapshot.opponentCountMap));
  const totalSinglesPlayed = sum(Object.values(snapshot.singleCountMap));
  const expectedSinglesPerPlayer = totalSinglesPlayed / totalPlayers;

  const expectedBenchSpread = Math.ceil(Math.sqrt(totalRounds)) + 1;
  if (maxBenchCount - minBenchCount > expectedBenchSpread + 2) {
    warnings.push(`Bench imbalance: spread of ${maxBenchCount - minBenchCount} (expected ~${expectedBenchSpread} for ${totalRounds} rounds)`);
  }

  if (singlesPlayers.length > 0 && singlesPlayers[0].count > expectedSinglesPerPlayer + 1.5) {
    const overPlayedSingles = singlesPlayers.filter(p => p.count > expectedSinglesPerPlayer + 1);
    if (overPlayedSingles.length > 0) {
      const expected = expectedSinglesPerPlayer.toFixed(1);
      warnings.push(`${overPlayedSingles.length} player(s) played singles ${Math.round(expectedSinglesPerPlayer + 1.5)}+ times (expected ~${expected} each)`);
    }
  }

  addPairWarning(warnings, repeatedTeammates, totalTeammatePairings / possiblePairs, 'teamed up');
  addPairWarning(warnings, repeatedOpponents, totalOpponentPairings / possiblePairs, 'faced each other');

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
    benchPlayers,
    singlesPlayers,
    playersWithMultipleSingles,
    warnings,
  };
}
