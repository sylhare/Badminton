/**
 * Statistical baselines derived from analysis/data/{engine}/config.json.
 * Simulation config: 50 runs x 4 player counts (15-18) = 200 sessions of 10 rounds each.
 *
 *
 * Smart engine (SL) is excluded: it optimises for level/gender balance,
 * so raw pairing statistics are not meaningful in isolation.
 */

import type { EngineType } from '../../types';

export interface EngineBaseline {
  simulationRounds: number;
  teammateRepeatSessionRate: number;
  avgTeammateRepeatsPerSession: number;
  avgBenchRange: number;
  doubleBenchSessionRate: number;
}

export const ENGINE_BASELINES: Record<EngineType, EngineBaseline | undefined> = {
  sa: {
    simulationRounds: 10,
    teammateRepeatSessionRate: 0,
    avgTeammateRepeatsPerSession: 0,
    avgBenchRange: 0.75,
    doubleBenchSessionRate: 0.095,
  },
  sl: undefined,
};

/** Returns the baseline for the given engine, or undefined if not tracked. */
export const getBaseline = (engineType: EngineType): EngineBaseline | undefined =>
  ENGINE_BASELINES[engineType];
