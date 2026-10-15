import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { engineSL as SmartEngine } from '../../src/engines/SmartEngine.ts';
import { engineSL2 as Smart2Engine, Smart2Engine as Smart2EngineClass } from '../../src/engines/Smart2Engine.ts';
import type { Court } from '../../src/types';
import { pairKey } from '../../src/utils/playerUtils';

import type { DisparityProfile } from './utils';
import {
  calculateTeamStrength,
  DISPARITY_PROFILES,
  generateDisparityPlayerLevels,
  generateDisparityPlayers,
  getPlayerTier,
  simulateRandomMatchOutcome,
  toCsv,
} from './utils';

const SCRIPT_DIR = import.meta.dirname;
const DATA_DIR = resolve(SCRIPT_DIR, '..', 'data');

/** Result metrics for a disparity benchmark scenario. */
export type DisparityScenarioResult = {
  engine: string;
  engineName: string;
  configName: string;
  profile: DisparityProfile;
  numPlayers: number;
  runs: number;
  rounds: number;
  podLockInCount: number;
  earlyLockInPercentage: number;
  oppDiversityStrong: number;
  oppDiversityMedium: number;
  oppDiversityWeak: number;
  oppDiversityOverall: number;
  maxOpponentFacing: number;
  mixedDoublesCount: number;
  mixedDoublesRate: number;
  avgStrengthDiff: number;
  avgIntraGap: number;
  avgCourtSpread: number;
  perfectBalanceRate: number;
  durationMs: number;
};

/** Parameter sweep definition for Smart2Engine configuration experiments. */
export type SweepConfig = {
  name: string;
  params: {
    levelWeight?: number;
    varietyWeight?: number;
    mixedDoublesWeight?: number;
    winStreakWeight?: number;
    windowTolerance?: number;
    podRepeatThreshold?: number;
  };
};

/** Default parameter configurations for SL2 sweep benchmarks. */
export const SWEEP_CONFIGURATIONS: SweepConfig[] = [
  {
    name: 'sl2_baseline',
    params: { levelWeight: 150, varietyWeight: 800, mixedDoublesWeight: 200, winStreakWeight: 300 },
  },
  {
    name: 'sl2_low_level',
    params: { levelWeight: 50, varietyWeight: 800, mixedDoublesWeight: 200, winStreakWeight: 300 },
  },
  {
    name: 'sl2_high_level',
    params: { levelWeight: 300, varietyWeight: 800, mixedDoublesWeight: 200, winStreakWeight: 300 },
  },
  {
    name: 'sl2_low_variety',
    params: { levelWeight: 150, varietyWeight: 400, mixedDoublesWeight: 200, winStreakWeight: 300 },
  },
  {
    name: 'sl2_high_variety',
    params: { levelWeight: 150, varietyWeight: 1200, mixedDoublesWeight: 200, winStreakWeight: 300 },
  },
  {
    name: 'sl2_low_mixed',
    params: { levelWeight: 150, varietyWeight: 800, mixedDoublesWeight: 50, winStreakWeight: 300 },
  },
  {
    name: 'sl2_high_mixed',
    params: { levelWeight: 150, varietyWeight: 800, mixedDoublesWeight: 400, winStreakWeight: 300 },
  },
  {
    name: 'sl2_low_streak',
    params: { levelWeight: 150, varietyWeight: 800, mixedDoublesWeight: 200, winStreakWeight: 100 },
  },
  {
    name: 'sl2_high_streak',
    params: { levelWeight: 150, varietyWeight: 800, mixedDoublesWeight: 200, winStreakWeight: 500 },
  },
];

/** CLI configuration options. */
type CliOptions = {
  quick: boolean;
  runs: number;
  rounds: number;
  sweep: boolean;
  playerCounts: number[];
  profiles: DisparityProfile[];
};

/** Parses CLI arguments into structured options. */
const parseCliArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  const quick = args.includes('--quick');
  const sweep = args.includes('--sweep');

  const runsIdx = args.indexOf('--runs');
  const runs = runsIdx !== -1 && args[runsIdx + 1] ? parseInt(args[runsIdx + 1], 10) : quick ? 10 : 30;

  const roundsIdx = args.indexOf('--rounds');
  const rounds = roundsIdx !== -1 && args[roundsIdx + 1] ? parseInt(args[roundsIdx + 1], 10) : 12;

  const pcIdx = args.indexOf('--player-counts');
  const playerCounts = pcIdx !== -1 && args[pcIdx + 1]
    ? args[pcIdx + 1].split(',').map((n: string) => parseInt(n.trim(), 10))
    : [16, 18, 20];

  const profIdx = args.indexOf('--profiles');
  const profiles = profIdx !== -1 && args[profIdx + 1]
    ? (args[profIdx + 1].split(',').map((p: string) => p.trim()) as DisparityProfile[])
    : [...DISPARITY_PROFILES];

  return { quick, runs, rounds, sweep, playerCounts, profiles };
};

/** Runs benchmark simulation for a single engine, disparity profile, and player count. */
const runDisparityScenario = (
  engine: typeof SmartEngine | typeof Smart2Engine | Smart2EngineClass,
  engineId: string,
  engineName: string,
  configName: string,
  profile: DisparityProfile,
  numPlayers: number,
  runs: number,
  rounds: number,
  numCourts = 4,
): DisparityScenarioResult => {
  const players = generateDisparityPlayers(profile, numPlayers);
  const playerLevels = generateDisparityPlayerLevels(profile, numPlayers);
  const startTime = Date.now();

  const sessionPodRepeats: number[] = [];
  const sessionMaxOpponents: number[] = [];
  const sessionMixedDoublesCounts: number[] = [];
  const sessionStrongOppCounts: number[] = [];
  const sessionMediumOppCounts: number[] = [];
  const sessionWeakOppCounts: number[] = [];
  const sessionOverallOppCounts: number[] = [];

  let totalEarlyLockInCourts = 0;
  let totalEarlyCourts = 0;
  let totalMatches = 0;
  let totalMixedDoubles = 0;
  let totalPerfectBalanced = 0;

  const allStrengthDiffs: number[] = [];
  const allIntraGaps: number[] = [];
  const allCourtSpreads: number[] = [];

  for (let run = 0; run < runs; run++) {
    engine.resetHistory();

    const seenPods = new Map<string, number>();
    const playerOpponents = new Map<string, Set<string>>();
    players.forEach(p => playerOpponents.set(p.id, new Set<string>()));
    const pairOpponentCounts = new Map<string, number>();

    let runPodRepeats = 0;
    let runMixedDoubles = 0;

    for (let round = 1; round <= rounds; round++) {
      const generated = engine.generate(players, numCourts);
      const courts: Court[] = Array.isArray(generated) ? generated : generated.courts;
      const courtsWithWinners: Court[] = [];

      for (const court of courts) {
        if (!court.teams || court.players.length !== 4) continue;

        const podKey = court.players.map(p => p.id).sort().join('-');
        if (seenPods.has(podKey)) {
          runPodRepeats++;
        }
        seenPods.set(podKey, (seenPods.get(podKey) ?? 0) + 1);

        if (round <= 3) {
          totalEarlyCourts++;
          const strongCount = court.players.filter(p => (playerLevels.get(p.id) ?? 50) >= 70).length;
          const weakCount = court.players.filter(p => (playerLevels.get(p.id) ?? 50) <= 30).length;
          if (strongCount === 4 || weakCount === 4) {
            totalEarlyLockInCourts++;
          }
        }

        const [t1, t2] = [court.teams.team1, court.teams.team2];
        for (const p1 of t1) {
          for (const p2 of t2) {
            playerOpponents.get(p1.id)?.add(p2.id);
            playerOpponents.get(p2.id)?.add(p1.id);
            const pair = pairKey(p1.id, p2.id);
            pairOpponentCounts.set(pair, (pairOpponentCounts.get(pair) ?? 0) + 1);
          }
        }

        totalMatches++;
        const t1Mixed = (t1[0].gender === 'M' && t1[1].gender === 'F') || (t1[0].gender === 'F' && t1[1].gender === 'M');
        const t2Mixed = (t2[0].gender === 'M' && t2[1].gender === 'F') || (t2[0].gender === 'F' && t2[1].gender === 'M');
        if (t1Mixed && t2Mixed) {
          runMixedDoubles++;
          totalMixedDoubles++;
        }

        const s1 = calculateTeamStrength(t1, playerLevels);
        const s2 = calculateTeamStrength(t2, playerLevels);
        const strengthDiff = Math.abs(s1 - s2);
        allStrengthDiffs.push(strengthDiff);
        if (strengthDiff === 0) totalPerfectBalanced++;

        const ta1 = t1[0]?.level ?? 50;
        const ta2 = t1[1]?.level ?? 50;
        const tb1 = t2[0]?.level ?? 50;
        const tb2 = t2[1]?.level ?? 50;
        allIntraGaps.push((Math.abs(ta1 - ta2) + Math.abs(tb1 - tb2)) / 2);

        const cLevels = court.players.map(p => playerLevels.get(p.id) ?? 50);
        allCourtSpreads.push(Math.max(...cLevels) - Math.min(...cLevels));

        const winner = simulateRandomMatchOutcome();
        courtsWithWinners.push({ ...court, winner });
      }

      if (engine.recordWins) {
        engine.recordWins(courtsWithWinners);
      }
    }

    sessionPodRepeats.push(runPodRepeats);
    sessionMixedDoublesCounts.push(runMixedDoubles);

    const maxOpp = pairOpponentCounts.size > 0 ? Math.max(...pairOpponentCounts.values()) : 0;
    sessionMaxOpponents.push(maxOpp);

    const strongOpps: number[] = [];
    const mediumOpps: number[] = [];
    const weakOpps: number[] = [];
    const overallOpps: number[] = [];

    players.forEach(p => {
      const tier = getPlayerTier(playerLevels.get(p.id) ?? 50);
      const count = playerOpponents.get(p.id)?.size ?? 0;
      overallOpps.push(count);
      if (tier === 'strong') strongOpps.push(count);
      else if (tier === 'weak') weakOpps.push(count);
      else mediumOpps.push(count);
    });

    sessionOverallOppCounts.push(overallOpps.reduce((a, b) => a + b, 0) / (overallOpps.length || 1));
    if (strongOpps.length > 0) {
      sessionStrongOppCounts.push(strongOpps.reduce((a, b) => a + b, 0) / strongOpps.length);
    }
    if (mediumOpps.length > 0) {
      sessionMediumOppCounts.push(mediumOpps.reduce((a, b) => a + b, 0) / mediumOpps.length);
    }
    if (weakOpps.length > 0) {
      sessionWeakOppCounts.push(weakOpps.reduce((a, b) => a + b, 0) / weakOpps.length);
    }
  }

  const durationMs = Date.now() - startTime;
  const avg = (arr: number[]) => (arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

  return {
    engine: engineId,
    engineName,
    configName,
    profile,
    numPlayers,
    runs,
    rounds,
    podLockInCount: Number(avg(sessionPodRepeats).toFixed(2)),
    earlyLockInPercentage: Number((totalEarlyCourts > 0 ? (totalEarlyLockInCourts / totalEarlyCourts) * 100 : 0).toFixed(1)),
    oppDiversityStrong: Number(avg(sessionStrongOppCounts).toFixed(2)),
    oppDiversityMedium: Number(avg(sessionMediumOppCounts).toFixed(2)),
    oppDiversityWeak: Number(avg(sessionWeakOppCounts).toFixed(2)),
    oppDiversityOverall: Number(avg(sessionOverallOppCounts).toFixed(2)),
    maxOpponentFacing: Number(avg(sessionMaxOpponents).toFixed(2)),
    mixedDoublesCount: Number(avg(sessionMixedDoublesCounts).toFixed(2)),
    mixedDoublesRate: Number((totalMatches > 0 ? (totalMixedDoubles / totalMatches) * 100 : 0).toFixed(1)),
    avgStrengthDiff: Number(avg(allStrengthDiffs).toFixed(2)),
    avgIntraGap: Number(avg(allIntraGaps).toFixed(2)),
    avgCourtSpread: Number(avg(allCourtSpreads).toFixed(2)),
    perfectBalanceRate: Number((totalMatches > 0 ? (totalPerfectBalanced / totalMatches) * 100 : 0).toFixed(1)),
    durationMs,
  };
};

/** Runs parameter sweeps over Smart2Engine configurations. */
const runParameterSweeps = (
  options: CliOptions,
): DisparityScenarioResult[] => {
  const sweepResults: DisparityScenarioResult[] = [];
  const sweepPlayerCounts = options.playerCounts.includes(18) ? [18] : [options.playerCounts[0]];
  const sweepProfiles: DisparityProfile[] = ['lot_strong_lot_weak', 'few_strong_few_weak'];

  for (const sweepConfig of SWEEP_CONFIGURATIONS) {
    const sweepEngine = new Smart2EngineClass();
    sweepEngine.configure({
      ...sweepConfig.params,
      iterations: 500,
      initialTemperature: 2000,
      coolingRate: 0.9985,
    });

    for (const numPlayers of sweepPlayerCounts) {
      for (const profile of sweepProfiles) {
        const res = runDisparityScenario(
          sweepEngine,
          'sl2',
          'Smart2 Matching (SL2)',
          sweepConfig.name,
          profile,
          numPlayers,
          options.runs,
          options.rounds,
        );
        sweepResults.push(res);
      }
    }
  }

  return sweepResults;
};

/** Main execution function orchestrating disparity benchmarks. */
const main = () => {
  const options = parseCliArgs();

  SmartEngine.configure({ iterations: 500, initialTemperature: 2000, coolingRate: 0.9985 });
  Smart2Engine.configure({
    levelWeight: 150,
    varietyWeight: 800,
    mixedDoublesWeight: 200,
    winStreakWeight: 300,
    windowTolerance: 25,
    podRepeatThreshold: 3,
    iterations: 500,
    initialTemperature: 2000,
    coolingRate: 0.9985,
  });

  const engines = [
    { id: 'sl', name: 'Smart Matching (SL)', engine: SmartEngine },
    { id: 'sl2', name: 'Smart2 Matching (SL2)', engine: Smart2Engine },
  ];

  console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║               DISPARITY BENCHMARK & COMPARISON RUNNER                          ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════╝');
  console.log(`Runs per scenario: ${options.runs}`);
  console.log(`Rounds per session: ${options.rounds}`);
  console.log(`Player counts: ${options.playerCounts.join(', ')}`);
  console.log(`Disparity profiles: ${options.profiles.join(', ')}`);
  console.log(`Sweep enabled: ${options.sweep}`);

  const comparisonResults: DisparityScenarioResult[] = [];

  for (const profile of options.profiles) {
    for (const numPlayers of options.playerCounts) {
      for (const eng of engines) {
        const result = runDisparityScenario(
          eng.engine,
          eng.id,
          eng.name,
          'default',
          profile,
          numPlayers,
          options.runs,
          options.rounds,
        );
        comparisonResults.push(result);
      }
    }
  }

  const sweepResults = options.sweep ? runParameterSweeps(options) : [];

  mkdirSync(DATA_DIR, { recursive: true });

  const outputPayload = {
    metadata: {
      timestamp: new Date().toISOString(),
      runs: options.runs,
      rounds: options.rounds,
      playerCounts: options.playerCounts,
      profiles: options.profiles,
      sweepEnabled: options.sweep,
    },
    comparison: comparisonResults,
    parameterSweeps: sweepResults,
  };

  writeFileSync(resolve(DATA_DIR, 'disparity_comparison.json'), JSON.stringify(outputPayload, null, 2));

  const allResults = [...comparisonResults, ...sweepResults];
  writeFileSync(resolve(DATA_DIR, 'disparity_summary.csv'), toCsv(allResults));

  console.log('\n' + '═'.repeat(90));
  console.log('COMPARISON SUMMARY (SL vs SL2)');
  console.log('═'.repeat(90));
  console.log(
    'Profile'.padEnd(22) +
    'N'.padStart(3) +
    '  Engine'.padEnd(8) +
    'PodLock'.padStart(9) +
    'EarlyLk%'.padStart(10) +
    'OppDiv(S/M/W)'.padStart(18) +
    'MaxOpp'.padStart(8) +
    'MixDbl%'.padStart(9) +
    'Spread'.padStart(8),
  );
  console.log('-'.repeat(90));

  for (const row of comparisonResults) {
    const oppTierStr = `${row.oppDiversityStrong}/${row.oppDiversityMedium}/${row.oppDiversityWeak}`;
    console.log(
      row.profile.padEnd(22) +
      String(row.numPlayers).padStart(3) +
      `  ${row.engine}`.padEnd(8) +
      row.podLockInCount.toFixed(2).padStart(9) +
      `${row.earlyLockInPercentage.toFixed(1)}%`.padStart(10) +
      oppTierStr.padStart(18) +
      row.maxOpponentFacing.toFixed(2).padStart(8) +
      `${row.mixedDoublesRate.toFixed(1)}%`.padStart(9) +
      row.avgCourtSpread.toFixed(1).padStart(8),
    );
  }

  if (sweepResults.length > 0) {
    console.log('\n' + '═'.repeat(90));
    console.log('PARAMETER SWEEPS SUMMARY (SL2)');
    console.log('═'.repeat(90));
    for (const row of sweepResults) {
      console.log(
        row.configName.padEnd(20) +
        row.profile.padEnd(22) +
        `N=${row.numPlayers}`.padEnd(6) +
        `PodLock: ${row.podLockInCount.toFixed(2)}`.padEnd(16) +
        `EarlyLk: ${row.earlyLockInPercentage.toFixed(1)}%`.padEnd(16) +
        `OppDiv: ${row.oppDiversityOverall.toFixed(2)}`.padEnd(15) +
        `MixDbl: ${row.mixedDoublesRate.toFixed(1)}%`,
      );
    }
  }

  console.log(`\n✓ Results written to ${resolve(DATA_DIR, 'disparity_comparison.json')}`);
  console.log(`✓ CSV written to ${resolve(DATA_DIR, 'disparity_summary.csv')}`);
};

main();
