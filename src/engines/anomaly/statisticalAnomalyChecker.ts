/**
 * Compares live session stats against simulation baselines.
 * Returns anomalies for display in StatsPage and GA event tracking via useAnalytics.
 *
 * Smart engine (SL) is excluded from checks.
 */

import type { EngineType } from '../../types';

import { getBaseline } from './simulationBaselines';

type CountMap = Record<string, number>;

export interface StatAnomaly {
  code: string;
  message: string;
}

export interface CheckInput {
  engineType: EngineType;
  benchCountMap: CountMap;
  teammateCountMap: CountMap;
  opponentCountMap: CountMap;
  totalRounds: number;
}

const checkTeammateRepeats = (
  teammateCountMap: CountMap,
  baseline: ReturnType<typeof getBaseline>,
  totalRounds: number,
): StatAnomaly[] => {
  if (!baseline) return [];

  const repeatedPairs = Object.values(teammateCountMap).filter(c => c > 1);
  if (repeatedPairs.length === 0) return [];

  const expectedRepeats = (baseline.avgTeammateRepeatsPerSession / baseline.simulationRounds) * totalRounds;

  if (baseline.teammateRepeatSessionRate === 0) {
    if (totalRounds > baseline.simulationRounds) return [];
    return [{
      code: 'stat_teammate_repeat',
      message: `${repeatedPairs.length} teammate pair(s) repeated — expected 0 for this engine in ${baseline.simulationRounds} rounds`,
    }];
  }

  const threshold = Math.max(expectedRepeats * 2, expectedRepeats + 3);
  if (repeatedPairs.length > threshold) {
    return [{
      code: 'stat_teammate_repeat_excess',
      message: `${repeatedPairs.length} repeated teammate pair(s) (expected ~${expectedRepeats.toFixed(1)} for ${totalRounds} rounds)`,
    }];
  }

  return [];
};

const checkOpponentRepeats = (opponentCountMap: CountMap): StatAnomaly[] => {
  const repeatedPairs = Object.values(opponentCountMap).filter(c => c > 1);
  if (repeatedPairs.length === 0) return [];

  const totalPlayers = new Set(
    Object.keys(opponentCountMap).flatMap(k => k.split('|')),
  ).size;
  const possiblePairs = totalPlayers > 1 ? (totalPlayers * (totalPlayers - 1)) / 2 : 1;
  const avgOpponentCount = Object.values(opponentCountMap).reduce((a, b) => a + b, 0) / possiblePairs;

  const excessThreshold = Math.max(3, Math.ceil(avgOpponentCount * 3));
  const excessPairs = Object.values(opponentCountMap).filter(c => c >= excessThreshold);
  if (excessPairs.length > 0) {
    return [{
      code: 'stat_opponent_repeat_excess',
      message: `${excessPairs.length} opponent pair(s) faced each other ${excessThreshold}+ times (avg is ${avgOpponentCount.toFixed(1)})`,
    }];
  }

  return [];
};

const checkBenchImbalance = (benchCountMap: CountMap, totalRounds: number): StatAnomaly[] => {
  const benchValues = Object.values(benchCountMap);
  if (benchValues.length === 0) return [];

  const maxBench = Math.max(...benchValues);
  const minBench = Math.min(...benchValues);

  if (maxBench >= 2 && minBench === 0) {
    const overBenchedCount = benchValues.filter(c => c >= 2).length;
    return [{
      code: 'stat_bench_double_before_zero',
      message: `${overBenchedCount} player(s) benched 2+ times while others have never been benched`,
    }];
  }

  const expectedRange = Math.ceil(Math.sqrt(totalRounds));
  if (maxBench - minBench > expectedRange + 1) {
    return [{
      code: 'stat_bench_range_excess',
      message: `Bench spread of ${maxBench - minBench} is high for ${totalRounds} rounds (expected <=${expectedRange + 1})`,
    }];
  }

  return [];
};

/**
 * Runs all statistical anomaly checks for the current session state.
 * Smart engine (SL) is excluded — its cost function is not comparable to the baselines.
 */
export const checkForAnomalies = (input: CheckInput): StatAnomaly[] => {
  if (input.engineType === 'sl') return [];

  const baseline = getBaseline(input.engineType);
  return [
    ...checkTeammateRepeats(input.teammateCountMap, baseline, input.totalRounds),
    ...checkOpponentRepeats(input.opponentCountMap),
    ...checkBenchImbalance(input.benchCountMap, input.totalRounds),
  ];
};
