import { countTier } from '../constants/graphColors';
import type { CountTier } from '../constants/graphColors';
import type { EngineSnapshot, Player } from '../types';
import { splitPairKey } from '../utils/playerUtils';

export type { EngineSnapshot };

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

export const hasEntries = (map: Record<string, number>): boolean => Object.keys(map).length > 0;

export function computeDiagnostics(
  snapshot: EngineSnapshot | null,
  players: Player[],
): DiagnosticStats | null {
  if (!snapshot || players.length === 0) return null;

  const hasAnyData = hasEntries(snapshot.benchCountMap) || hasEntries(snapshot.teammateCountMap) || 
    hasEntries(snapshot.opponentCountMap) || hasEntries(snapshot.singleCountMap) || 
    hasEntries(snapshot.winCountMap) || hasEntries(snapshot.lossCountMap);
  
  if (!hasAnyData) return null;

  const totalPlayers = players.length;
  const totalRounds = snapshot.roundsPlayed ?? 1;

  const benchCounts = Object.values(snapshot.benchCountMap);
  const benchedOnce = benchCounts.filter(c => c === 1).length;
  const benchedMultiple = benchCounts.filter(c => c > 1).length;
  const neverBenched = totalPlayers - Object.keys(snapshot.benchCountMap).length;
  const maxBenchCount = benchCounts.length > 0 ? Math.max(...benchCounts) : 0;
  const minBenchCount = benchCounts.length > 0 ? Math.min(...benchCounts) : 0;

  const avgBench = benchCounts.length > 0
    ? benchCounts.reduce((a, b) => a + b, 0) / benchCounts.length
    : 0;
  const benchVariance = benchCounts.length > 0
    ? benchCounts.reduce((sum, c) => sum + Math.pow(c - avgBench, 2), 0) / benchCounts.length
    : 0;
  const benchFairnessScore = Math.round(Math.sqrt(benchVariance) * 100) / 100;

  const repeatedTeammates = Object.entries(snapshot.teammateCountMap)
    .filter(([, count]) => count > 1)
    .map(([pair, count]) => {
      const [id1, id2] = splitPairKey(pair);
      return { pair: `${getPlayerName(players, id1)} & ${getPlayerName(players, id2)}`, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const repeatedOpponents = Object.entries(snapshot.opponentCountMap)
    .filter(([, count]) => count > 1)
    .map(([pair, count]) => {
      const [id1, id2] = splitPairKey(pair);
      return { pair: `${getPlayerName(players, id1)} vs ${getPlayerName(players, id2)}`, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const singlesPlayers = Object.entries(snapshot.singleCountMap)
    .map(([playerId, count]) => ({ player: getPlayerName(players, playerId), count }))
    .sort((a, b) => b.count - a.count);
  const playersWithMultipleSingles = singlesPlayers.filter(p => p.count > 1).length;

  const warnings: string[] = [];
  const possiblePairs = totalPlayers > 1 ? (totalPlayers * (totalPlayers - 1)) / 2 : 1;

  const totalTeammatePairings = Object.values(snapshot.teammateCountMap).reduce((a, b) => a + b, 0);
  const totalOpponentPairings = Object.values(snapshot.opponentCountMap).reduce((a, b) => a + b, 0);
  const totalSinglesPlayed = Object.values(snapshot.singleCountMap).reduce((a, b) => a + b, 0);

  const expectedTeammateAvg = possiblePairs > 0 ? totalTeammatePairings / possiblePairs : 0;
  const expectedOpponentAvg = possiblePairs > 0 ? totalOpponentPairings / possiblePairs : 0;
  const expectedSinglesPerPlayer = totalPlayers > 0 ? totalSinglesPlayed / totalPlayers : 0;

  const expectedBenchSpread = Math.ceil(Math.sqrt(totalRounds)) + 1;
  if (maxBenchCount - minBenchCount > expectedBenchSpread + 2) {
    warnings.push(`Bench imbalance: spread of ${maxBenchCount - minBenchCount} (expected ~${expectedBenchSpread} for ${totalRounds} rounds)`);
  }

  const maxSingles = singlesPlayers.length > 0 ? singlesPlayers[0].count : 0;
  if (maxSingles > expectedSinglesPerPlayer + 1.5 && totalSinglesPlayed > 0) {
    const overPlayedSingles = singlesPlayers.filter(p => p.count > expectedSinglesPerPlayer + 1);
    if (overPlayedSingles.length > 0) {
      warnings.push(`${overPlayedSingles.length} player(s) played singles ${Math.round(expectedSinglesPerPlayer + 1.5)}+ times (expected ~${expectedSinglesPerPlayer.toFixed(1)} each)`);
    }
  }

  const getWarningThreshold = (expectedAvg: number): number =>
    Math.max(4, Math.ceil(expectedAvg * 2), Math.ceil(expectedAvg) + 3);

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
