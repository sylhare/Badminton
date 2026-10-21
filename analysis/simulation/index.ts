import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { engineSA as CourtAssignmentEngineSA } from '../../src/engines/SimulatedAnnealingEngine.ts';
import { engineSL2 as Smart2Engine } from '../../src/engines/Smart2Engine.ts';
import { mean } from '../../src/utils/numberUtils';
import { benchedPlayers, splitPairKey } from '../../src/utils/playerUtils';

import { engineCG as ConflictGraphEngine } from './ConflictGraphEngine.ts';
import { engineMC as CourtAssignmentEngine } from './MonteCarloEngine.ts';
import { engineRandom } from './RandomBaselineEngine.ts';
import { engineSL as SmartEngine } from './SmartEngine.ts';
import type {
  MatchEvent,
  MatchPairEvent,
  PairEvent,
  PlayerStats,
  RoundResult,
  SessionBenchStats,
  SimEngine,
  SimulationSummary,
} from './types';
import { evaluateRepeats, extractRoundPairs, generatePlayerLevels, loadConfig, toCsv, toPlayerList } from './utils';

const SCRIPT_DIR = import.meta.dirname;
const DATA_DIR = resolve(SCRIPT_DIR, '..', 'data');
const CONFIG_PATH = resolve(DATA_DIR, 'config.json');

const config = loadConfig(CONFIG_PATH);
const RUNS = config.runs;
const ROUNDS = config.rounds;
const PLAYER_COUNTS: number[] = config.playerCounts ?? [20];
const MAX_COURTS = config.numCourts;
const MAX_PLAYERS = Math.max(...PLAYER_COUNTS);

const PLAYER_LEVELS = config.playerProfiles
  ? new Map(Object.entries(config.playerProfiles).map(([id, p]) => [id, p.level]))
  : generatePlayerLevels(MAX_PLAYERS);

const ENGINE_PARAMS: Record<string, Record<string, unknown>> = config.engines ?? {
  random: { iterationsPerRound: 1 },
  mc: { samplesPerRound: 300 },
  sa: { iterations: 500, initialTemperature: 2000, coolingRate: 0.9995 },
  cg: { iterationsPerRound: 1 },
  sl: { iterations: 500, initialTemperature: 2000, coolingRate: 0.9985 },
  sl2: {
    levelWeight: 150,
    varietyWeight: 800,
    mixedDoublesWeight: 200,
    winStreakWeight: 300,
    windowTolerance: 25,
    podRepeatThreshold: 3,
    iterations: 500,
    initialTemperature: 2000,
    coolingRate: 0.9985,
  },
};

CourtAssignmentEngine.configure(ENGINE_PARAMS.mc ?? {});
CourtAssignmentEngineSA.configure(ENGINE_PARAMS.sa ?? {});
SmartEngine.configure(ENGINE_PARAMS.sl ?? {});
Smart2Engine.configure(ENGINE_PARAMS.sl2 ?? {});

const ALL_ENGINES = [
  { id: 'random', name: 'Random Baseline', engine: engineRandom, dir: 'random_baseline' },
  { id: 'mc', name: 'Monte Carlo (MC)', engine: CourtAssignmentEngine, dir: 'mc_algo' },
  { id: 'sa', name: 'Simulated Annealing (SA)', engine: CourtAssignmentEngineSA, dir: 'sa_algo' },
  { id: 'cg', name: 'Conflict Graph (CG)', engine: ConflictGraphEngine, dir: 'cg_algo' },
  { id: 'sl', name: 'Smart Matching (SL)', engine: SmartEngine, dir: 'sl_algo' },
  { id: 'sl2', name: 'Smart2 Matching (SL2)', engine: Smart2Engine, dir: 'sl2_algo' },
] as const;

/** Filter engines based on CLI arguments. */
const engineArgIdx = process.argv.indexOf('--engine');
const engineFilter = engineArgIdx !== -1 ? process.argv[engineArgIdx + 1]?.split(',') : null;
const enginesToRun = engineFilter
  ? ALL_ENGINES.filter(e => engineFilter.includes(e.id))
  : [...ALL_ENGINES];

type EngineType = typeof ALL_ENGINES[number]['engine'];

const runSimulation = (Engine: EngineType, numPlayers: number, simIdOffset: number): {
  summaries: SimulationSummary[];
  pairEvents: PairEvent[];
  matchEvents: MatchEvent[];
  matchPairEvents: MatchPairEvent[];
  benchStats: SessionBenchStats[];
  playerWins: Map<string, number>;
  playerLosses: Map<string, number>;
} => {
  const players = toPlayerList(numPlayers, PLAYER_LEVELS);
  const summaries: SimulationSummary[] = [];
  const pairEvents: PairEvent[] = [];
  const matchEvents: MatchEvent[] = [];
  const matchPairEvents: MatchPairEvent[] = [];
  const benchStats: SessionBenchStats[] = [];
  const playerWins = new Map<string, number>();
  const playerLosses = new Map<string, number>();

  for (let run = 1; run <= RUNS; run++) {
    const simId = simIdOffset + run;
    Engine.resetHistory();

    const sessionBenchCounts = new Map<string, number>();
    const lastBenchRound = new Map<string, number>();
    players.forEach(p => {
      sessionBenchCounts.set(p.id, 0);
      lastBenchRound.set(p.id, 0);
    });

    const sessionGaps: number[] = [];
    const rounds: RoundResult[] = [];

    for (let round = 0; round < ROUNDS; round++) {
      const generated = Engine.generate(players, MAX_COURTS);
      const courts = Array.isArray(generated) ? generated : generated.courts;

      const roundResult = extractRoundPairs(
        round + 1,
        courts,
        simId,
        numPlayers,
        Engine as unknown as SimEngine,
        PLAYER_LEVELS,
      );
      rounds.push(roundResult);
      for (const m of roundResult.matchEvents) matchEvents.push(m);
      for (const mp of roundResult.matchPairEvents) matchPairEvents.push(mp);

      const benched = benchedPlayers(courts, players);
      for (const player of benched) {
        sessionBenchCounts.set(player.id, (sessionBenchCounts.get(player.id) ?? 0) + 1);

        const lastRound = lastBenchRound.get(player.id) ?? 0;
        if (lastRound > 0) {
          const gap = (round + 1) - lastRound - 1;
          sessionGaps.push(gap);
        }
        lastBenchRound.set(player.id, round + 1);
      }
    }

    const snap = Engine.snapshot();
    for (const [playerId, wins] of Object.entries(snap.winCountMap)) {
      playerWins.set(playerId, (playerWins.get(playerId) ?? 0) + wins);
    }
    for (const [playerId, losses] of Object.entries(snap.lossCountMap)) {
      playerLosses.set(playerId, (playerLosses.get(playerId) ?? 0) + losses);
    }

    const benchCounts = Array.from(sessionBenchCounts.values());
    const maxBench = Math.max(...benchCounts);
    const minBench = Math.min(...benchCounts);
    const avgBench = mean(benchCounts);
    const meanGap = sessionGaps.length > 0 ? mean(sessionGaps) : 0;
    const doubleBenchCount = sessionGaps.filter(g => g === 0).length;

    benchStats.push({
      simulationId: simId,
      numPlayers,
      maxBenchCount: maxBench,
      minBenchCount: minBench,
      benchRange: maxBench - minBench,
      avgBenchCount: avgBench,
      meanGap,
      doubleBenchCount,
      totalGapEvents: sessionGaps.length,
    });

    const repeatStats = evaluateRepeats(rounds, simId, numPlayers);
    for (const e of repeatStats.events) pairEvents.push(e);

    summaries.push({
      simulationId: simId,
      numPlayers,
      rounds: ROUNDS,
      repeatAnyPair: repeatStats.repeatPairCount > 0,
      repeatPairDifferentOpponents: repeatStats.repeatPairDifferentOpponentsCount > 0,
      repeatPairSameOpponents: repeatStats.repeatPairSameOpponentsCount > 0,
      repeatPairCount: repeatStats.repeatPairCount,
      repeatPairDifferentOpponentsCount: repeatStats.repeatPairDifferentOpponentsCount,
      repeatPairSameOpponentsCount: repeatStats.repeatPairSameOpponentsCount,
    });
  }

  return { summaries, pairEvents, matchEvents, matchPairEvents, benchStats, playerWins, playerLosses };
};

const runEngine = (engineConfig: typeof ALL_ENGINES[number]) => {
  const { name, engine, dir } = engineConfig;
  const engineDir = resolve(DATA_DIR, dir);
  mkdirSync(engineDir, { recursive: true });

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Running ${name}`);
  console.log(`${'='.repeat(60)}`);

  const startTime = Date.now();
  const allSummaries: SimulationSummary[] = [];
  const allPairEvents: PairEvent[] = [];
  const allMatchEvents: MatchEvent[] = [];
  const allMatchPairEvents: MatchPairEvent[] = [];
  const allBenchStats: SessionBenchStats[] = [];
  const playerWins = new Map<string, number>();
  const playerLosses = new Map<string, number>();

  for (const [countIdx, numPlayers] of PLAYER_COUNTS.entries()) {
    const {
      summaries,
      pairEvents,
      matchEvents,
      matchPairEvents,
      benchStats,
      playerWins: simPlayerWins,
      playerLosses: simPlayerLosses,
    } = runSimulation(engine, numPlayers, countIdx * RUNS);
    allSummaries.push(...summaries);
    allPairEvents.push(...pairEvents);
    allMatchEvents.push(...matchEvents);
    allMatchPairEvents.push(...matchPairEvents);
    allBenchStats.push(...benchStats);
    for (const [playerId, wins] of simPlayerWins) {
      playerWins.set(playerId, (playerWins.get(playerId) ?? 0) + wins);
    }
    for (const [playerId, losses] of simPlayerLosses) {
      playerLosses.set(playerId, (playerLosses.get(playerId) ?? 0) + losses);
    }
  }

  const summaries = allSummaries;
  const pairEvents = allPairEvents;
  const matchEvents = allMatchEvents;
  const matchPairEvents = allMatchPairEvents;
  const benchStats = allBenchStats;

  const elapsed = Date.now() - startTime;

  const pairEventHeaders = ['simulationId', 'numPlayers', 'fromRound', 'toRound', 'pairId', 'opponentFrom', 'opponentTo', 'opponentChanged'];
  const matchEventHeaders = ['simulationId', 'numPlayers', 'roundIndex', 'courtIndex', 'team1Players', 'team2Players', 'team1Strength', 'team2Strength', 'strengthDifferential', 'matchAvgLevel', 'winner', 'strongerTeamWon', 'team1EngineWins', 'team2EngineWins', 'engineWinDifferential', 'engineBalancedTeamWon'];
  const benchStatsHeaders = ['simulationId', 'numPlayers', 'maxBenchCount', 'minBenchCount', 'benchRange', 'avgBenchCount', 'meanGap', 'doubleBenchCount', 'totalGapEvents'];

  writeFileSync(resolve(engineDir, 'summary.csv'), toCsv(summaries));
  writeFileSync(resolve(engineDir, 'pair_events.csv'), toCsv(pairEvents, pairEventHeaders));
  writeFileSync(resolve(engineDir, 'match_events.csv'), toCsv(matchEvents, matchEventHeaders));
  writeFileSync(resolve(engineDir, 'bench_stats.csv'), toCsv(benchStats, benchStatsHeaders));

  const matchPairCounts = new Map<string, { total: number; asTeammate: number; asOpponent: number }>();
  for (const mp of matchPairEvents) {
    const existing = matchPairCounts.get(mp.pairId) ?? { total: 0, asTeammate: 0, asOpponent: 0 };
    existing.total++;
    if (mp.wasTeammate) existing.asTeammate++;
    else existing.asOpponent++;
    matchPairCounts.set(mp.pairId, existing);
  }
  const matchPairSummary = Array.from(matchPairCounts.entries()).map(([pairId, counts]) => {
    const [p1, p2] = splitPairKey(pairId);
    return {
      pairId: `${p1}|${p2}`,
      totalMatches: counts.total,
      asTeammate: counts.asTeammate,
      asOpponent: counts.asOpponent,
    };
  });
  writeFileSync(resolve(engineDir, 'match_pair_summary.csv'), toCsv(matchPairSummary));

  const totalRepeats = summaries.filter(s => s.repeatAnyPair).length;
  const totalRepeatRate = (totalRepeats / summaries.length) * 100;
  const avgRepeats = summaries.reduce((acc, s) => acc + s.repeatPairCount, 0) / summaries.length;

  const totalMatches = matchEvents.length;
  const strongerTeamWins = matchEvents.filter(m => m.strongerTeamWon).length;
  const avgStrengthDiff = matchEvents.reduce((acc, m) => acc + m.strengthDifferential, 0) / totalMatches;
  const perfectlyBalanced = matchEvents.filter(m => m.strengthDifferential === 0).length;

  const engineBalancedWins = matchEvents.filter(m => m.engineBalancedTeamWon).length;
  const avgEngineWinDiff = matchEvents.reduce((acc, m) => acc + m.engineWinDifferential, 0) / totalMatches;
  const enginePerfectBalance = matchEvents.filter(m => m.engineWinDifferential === 0).length;

  const avgBenchRange = benchStats.reduce((acc, bs) => acc + bs.benchRange, 0) / benchStats.length;
  const avgMeanGap = benchStats.reduce((acc, bs) => acc + bs.meanGap, 0) / benchStats.length;
  const totalDoubleBench = benchStats.reduce((acc, bs) => acc + bs.doubleBenchCount, 0);
  const totalGapEvents = benchStats.reduce((acc, bs) => acc + bs.totalGapEvents, 0);
  const doubleBenchRate = totalGapEvents > 0 ? (totalDoubleBench / totalGapEvents) * 100 : 0;

  const snapshot = engine.snapshot();
  const playerStats: PlayerStats[] = [];
  for (let i = 0; i < MAX_PLAYERS; i++) {
    const playerId = `P${i + 1}`;
    const wins = playerWins.get(playerId) ?? snapshot.winCountMap[playerId] ?? 0;
    const losses = playerLosses.get(playerId) ?? snapshot.lossCountMap[playerId] ?? 0;
    playerStats.push({
      playerId,
      level: PLAYER_LEVELS.get(playerId) ?? 3,
      totalWins: wins,
      totalLosses: losses,
      gamesPlayed: wins + losses,
    });
  }
  writeFileSync(resolve(engineDir, 'player_stats.csv'), toCsv(playerStats));

  const engineConfigFile = {
    runs: RUNS,
    rounds: ROUNDS,
    playerCounts: PLAYER_COUNTS,
    maxCourts: MAX_COURTS,
    totalSimulations: summaries.length,
    algorithmParams: ENGINE_PARAMS[engineConfig.id] ?? {},
    aggregateStats: {
      repeatRate: totalRepeatRate,
      avgRepeatsPerRun: avgRepeats,
      zeroRepeatRate: (summaries.filter(s => s.repeatPairCount === 0).length / summaries.length) * 100,
    },
    levelBasedBalance: {
      totalMatches,
      strongerTeamWinRate: (strongerTeamWins / totalMatches) * 100,
      avgStrengthDifferential: avgStrengthDiff,
      perfectlyBalancedMatches: perfectlyBalanced,
      perfectlyBalancedRate: (perfectlyBalanced / totalMatches) * 100,
    },
    engineTrackedBalance: {
      totalMatches,
      engineBalancedWinRate: (engineBalancedWins / totalMatches) * 100,
      avgEngineWinDifferential: avgEngineWinDiff,
      perfectlyBalancedMatches: enginePerfectBalance,
      perfectlyBalancedRate: (enginePerfectBalance / totalMatches) * 100,
    },
    benchFairness: {
      avgBenchRange,
      avgMeanGap,
      doubleBenchRate,
      totalSessions: benchStats.length,
      totalGapEvents,
    },
    timing: { totalMs: elapsed },
    timestamp: new Date().toISOString(),
  };
  writeFileSync(resolve(engineDir, 'config.json'), JSON.stringify(engineConfigFile, null, 2));

  const repeatCount = summaries.filter(s => s.repeatAnyPair).length;
  const repeatRate = (repeatCount / summaries.length) * 100;
  console.log(`  ${RUNS} runs × ${ROUNDS} rounds: ${repeatRate.toFixed(1)}% repeat rate (${elapsed}ms)`);
  console.log(`  Zero-repeat rate: ${engineConfigFile.aggregateStats.zeroRepeatRate.toFixed(2)}%`);
  console.log(`  Bench fairness: avg gap ${avgMeanGap.toFixed(2)}, double-bench rate ${doubleBenchRate.toFixed(1)}%`);

  return {
    summaries,
    durationMs: elapsed,
    stats: engineConfigFile.aggregateStats,
    levelBasedBalance: engineConfigFile.levelBasedBalance,
    engineTrackedBalance: engineConfigFile.engineTrackedBalance,
    benchFairness: engineConfigFile.benchFairness,
  };
};

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║           ENGINE COMPARISON SIMULATION                     ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log(`\nConfiguration (from ${CONFIG_PATH}):`);
console.log(`  Runs per player count: ${RUNS}`);
console.log(`  Rounds per run: ${ROUNDS}`);
console.log(`  Player counts: ${PLAYER_COUNTS.join(', ')}`);
console.log(`  Max courts: ${MAX_COURTS}`);

const allResults: Record<string, ReturnType<typeof runEngine>> = {};

for (const engineConfig of enginesToRun) {
  allResults[engineConfig.id] = runEngine(engineConfig);
}

console.log(`\n${'═'.repeat(60)}`);
console.log('FINAL COMPARISON SUMMARY');
console.log(`${'═'.repeat(60)}`);

const comparisonData = enginesToRun.map(({ id, name }) => {
  const result = allResults[id];
  return {
    engine: id,
    engineName: name,
    repeatRate: result.stats.repeatRate,
    zeroRepeatRate: result.stats.zeroRepeatRate,
    avgRepeatsPerRun: result.stats.avgRepeatsPerRun,
    levelStrongerWinRate: result.levelBasedBalance.strongerTeamWinRate,
    levelAvgDiff: result.levelBasedBalance.avgStrengthDifferential,
    engineBalancedWinRate: result.engineTrackedBalance.engineBalancedWinRate,
    engineAvgDiff: result.engineTrackedBalance.avgEngineWinDifferential,
    benchRange: result.benchFairness.avgBenchRange,
    avgMeanGap: result.benchFairness.avgMeanGap,
    doubleBenchRate: result.benchFairness.doubleBenchRate,
    totalTimeMs: result.durationMs,
  };
});

writeFileSync(resolve(DATA_DIR, 'comparison_summary.csv'), toCsv(comparisonData));

console.log('\n  Repeat Metrics:');
for (const row of comparisonData) {
  console.log(`    ${row.engineName.padEnd(30)} | ${row.zeroRepeatRate.toFixed(1).padStart(6)}% zero-repeat | ${row.avgRepeatsPerRun.toFixed(3).padStart(6)} avg`);
}

console.log('\n  Balance (Fixed Levels 1-5):');
for (const row of comparisonData) {
  console.log(`    ${row.engineName.padEnd(30)} | ${row.levelStrongerWinRate.toFixed(1).padStart(5)}% stronger wins | ${row.levelAvgDiff.toFixed(2).padStart(5)} avg diff`);
}

console.log('\n  Balance (Engine-Tracked Wins):');
for (const row of comparisonData) {
  console.log(`    ${row.engineName.padEnd(30)} | ${row.engineBalancedWinRate.toFixed(1).padStart(5)}% balanced wins | ${row.engineAvgDiff.toFixed(2).padStart(5)} avg diff`);
}

console.log('\n  Bench Fairness:');
for (const row of comparisonData) {
  console.log(`    ${row.engineName.padEnd(30)} | ${row.avgMeanGap.toFixed(2).padStart(5)} avg gap | ${row.doubleBenchRate.toFixed(1).padStart(5)}% double-bench`);
}

console.log('\n  Timing:');
for (const row of comparisonData) {
  console.log(`    ${row.engineName.padEnd(30)} | ${row.totalTimeMs}ms`);
}

console.log(`\n✓ Data saved to ${DATA_DIR}`);
console.log(`  Files per engine: summary.csv, pair_events.csv, match_events.csv, bench_stats.csv, match_pair_summary.csv, player_stats.csv, config.json`);
console.log(`  - ${enginesToRun.map(e => e.dir).join(', ')}`);
console.log(`  - comparison_summary.csv`);
