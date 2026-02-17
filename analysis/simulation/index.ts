import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { engineMC as CourtAssignmentEngine } from '../../src/engines/MonteCarloEngine.ts';
import { engineSA as CourtAssignmentEngineSA } from '../../src/engines/SimulatedAnnealingEngine.ts';
import { engineCG as ConflictGraphEngine } from '../../src/engines/ConflictGraphEngine.ts';
import { RandomBaselineEngine } from './RandomBaselineEngine.ts';

import type {
  MatchEvent,
  PlayerStats,
  SessionBenchStats,
  MatchPairEvent,
  SimulationSummary,
  PairEvent,
  RoundResult,
} from './types';

import {
  loadConfig,
  generatePlayerLevels,
  toPlayerList,
  toCsv,
  extractRoundPairs,
  evaluateRepeats,
} from './utils';

const SCRIPT_DIR = import.meta.dirname;
const DATA_DIR = resolve(SCRIPT_DIR, '..', 'data');
const CONFIG_PATH = resolve(DATA_DIR, 'config.json');

const config = loadConfig(CONFIG_PATH);
const RUNS = config.runs;
const ROUNDS = config.rounds;
const PLAYER_COUNTS: number[] = config.playerCounts ?? [20];
const MAX_COURTS = config.numCourts;
const MAX_PLAYERS = Math.max(...PLAYER_COUNTS);

const PLAYER_LEVELS = generatePlayerLevels(MAX_PLAYERS);

const ALL_ENGINES = [
  { id: 'random', name: 'Random Baseline', engine: RandomBaselineEngine, dir: 'random_baseline' },
  { id: 'mc', name: 'Monte Carlo (MC)', engine: CourtAssignmentEngine, dir: 'mc_algo' },
  { id: 'sa', name: 'Simulated Annealing (SA)', engine: CourtAssignmentEngineSA, dir: 'sa_algo' },
  { id: 'cg', name: 'Conflict Graph (CG)', engine: ConflictGraphEngine, dir: 'cg_algo' },
] as const;

type EngineType = typeof ALL_ENGINES[number]['engine'];

const runSimulation = (Engine: EngineType, numPlayers: number): {
  summaries: SimulationSummary[];
  pairEvents: PairEvent[];
  matchEvents: MatchEvent[];
  matchPairEvents: MatchPairEvent[];
  benchStats: SessionBenchStats[];
} => {
  const players = toPlayerList(numPlayers);
  const summaries: SimulationSummary[] = [];
  const pairEvents: PairEvent[] = [];
  const matchEvents: MatchEvent[] = [];
  const matchPairEvents: MatchPairEvent[] = [];
  const benchStats: SessionBenchStats[] = [];

  for (let simId = 1; simId <= RUNS; simId++) {
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
      const courts = Engine.generate(players, MAX_COURTS);

      const roundResult = extractRoundPairs(round + 1, courts, simId, Engine, PLAYER_LEVELS);
      rounds.push(roundResult);
      for (const m of roundResult.matchEvents) matchEvents.push(m);
      for (const mp of roundResult.matchPairEvents) matchPairEvents.push(mp);

      const playersOnCourt = new Set<string>();
      for (const court of courts) {
        for (const p of court.players) {
          playersOnCourt.add(p.id);
        }
      }

      for (const player of players) {
        const wasBenched = !playersOnCourt.has(player.id);
        if (wasBenched) {
          sessionBenchCounts.set(player.id, (sessionBenchCounts.get(player.id) ?? 0) + 1);

          const lastRound = lastBenchRound.get(player.id) ?? 0;
          if (lastRound > 0) {
            const gap = (round + 1) - lastRound - 1;
            sessionGaps.push(gap);
          }
          lastBenchRound.set(player.id, round + 1);
        }
      }
    }

    const benchCounts = Array.from(sessionBenchCounts.values());
    const maxBench = Math.max(...benchCounts);
    const minBench = Math.min(...benchCounts);
    const avgBench = benchCounts.reduce((a, b) => a + b, 0) / benchCounts.length;
    const meanGap = sessionGaps.length > 0 ? sessionGaps.reduce((a, b) => a + b, 0) / sessionGaps.length : 0;
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

    const repeatStats = evaluateRepeats(rounds, simId);
    for (const e of repeatStats.events) pairEvents.push(e);

    summaries.push({
      simulationId: simId,
      rounds: ROUNDS,
      repeatAnyPair: repeatStats.repeatPairCount > 0,
      repeatPairDifferentOpponents: repeatStats.repeatPairDifferentOpponentsCount > 0,
      repeatPairSameOpponents: repeatStats.repeatPairSameOpponentsCount > 0,
      repeatPairCount: repeatStats.repeatPairCount,
      repeatPairDifferentOpponentsCount: repeatStats.repeatPairDifferentOpponentsCount,
      repeatPairSameOpponentsCount: repeatStats.repeatPairSameOpponentsCount,
    });
  }

  return { summaries, pairEvents, matchEvents, matchPairEvents, benchStats };
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

  for (const numPlayers of PLAYER_COUNTS) {
    const { summaries, pairEvents, matchEvents, matchPairEvents, benchStats } = runSimulation(engine, numPlayers);
    allSummaries.push(...summaries);
    allPairEvents.push(...pairEvents);
    allMatchEvents.push(...matchEvents);
    allMatchPairEvents.push(...matchPairEvents);
    allBenchStats.push(...benchStats);
  }

  const summaries = allSummaries;
  const pairEvents = allPairEvents;
  const matchEvents = allMatchEvents;
  const matchPairEvents = allMatchPairEvents;
  const benchStats = allBenchStats;

  const elapsed = Date.now() - startTime;

  const pairEventHeaders = ['simulationId', 'fromRound', 'toRound', 'pairId', 'opponentFrom', 'opponentTo', 'opponentChanged'];
  const matchEventHeaders = ['simulationId', 'roundIndex', 'courtIndex', 'team1Players', 'team2Players', 'team1Strength', 'team2Strength', 'strengthDifferential', 'winner', 'strongerTeamWon', 'team1EngineWins', 'team2EngineWins', 'engineWinDifferential', 'engineBalancedTeamWon'];
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
  const matchPairSummary = Array.from(matchPairCounts.entries()).map(([pairId, counts]) => ({
    pairId,
    totalMatches: counts.total,
    asTeammate: counts.asTeammate,
    asOpponent: counts.asOpponent,
  }));
  writeFileSync(resolve(engineDir, 'match_pair_summary.csv'), toCsv(matchPairSummary));

  const totalRepeats = summaries.filter(s => s.repeatAnyPair).length;
  const totalRepeatRate = (totalRepeats / summaries.length) * 100;
  const avgRepeats = summaries.reduce((acc, s) => acc + s.repeatPairDifferentOpponentsCount, 0) / summaries.length;

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

  const playerWins = new Map<string, number>();
  const playerLosses = new Map<string, number>();
  const playerGames = new Map<string, number>();

  for (const match of matchEvents) {
    const team1Players = match.team1Players.split('|');
    const team2Players = match.team2Players.split('|');
    const winners = match.winner === 1 ? team1Players : team2Players;
    const losers = match.winner === 1 ? team2Players : team1Players;

    for (const p of winners) {
      playerWins.set(p, (playerWins.get(p) ?? 0) + 1);
      playerGames.set(p, (playerGames.get(p) ?? 0) + 1);
    }
    for (const p of losers) {
      playerLosses.set(p, (playerLosses.get(p) ?? 0) + 1);
      playerGames.set(p, (playerGames.get(p) ?? 0) + 1);
    }
  }

  const playerStats: PlayerStats[] = [];
  for (let i = 0; i < MAX_PLAYERS; i++) {
    const playerId = `P${i + 1}`;
    playerStats.push({
      playerId,
      level: PLAYER_LEVELS.get(playerId) ?? 3,
      totalWins: playerWins.get(playerId) ?? 0,
      totalLosses: playerLosses.get(playerId) ?? 0,
      gamesPlayed: playerGames.get(playerId) ?? 0,
    });
  }
  writeFileSync(resolve(engineDir, 'player_stats.csv'), toCsv(playerStats));

  const engineConfigFile = {
    runs: RUNS,
    rounds: ROUNDS,
    playerCounts: PLAYER_COUNTS,
    maxCourts: MAX_COURTS,
    totalSimulations: summaries.length,
    playerProfiles: Object.fromEntries(
      Array.from(PLAYER_LEVELS.entries())
        .filter(([id]) => parseInt(id.slice(1)) <= MAX_PLAYERS)
        .map(([id, level]) => [id, { level }]),
    ),
    aggregateStats: {
      repeatRate: totalRepeatRate,
      avgRepeatsPerRun: avgRepeats,
      zeroRepeatRate: (summaries.filter(s => s.repeatPairDifferentOpponentsCount === 0).length / summaries.length) * 100,
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

for (const engineConfig of ALL_ENGINES) {
  allResults[engineConfig.id] = runEngine(engineConfig);
}

console.log(`\n${'═'.repeat(60)}`);
console.log('FINAL COMPARISON SUMMARY');
console.log(`${'═'.repeat(60)}`);

const comparisonData = ALL_ENGINES.map(({ id, name }) => {
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
console.log(`  - random_baseline/, mc_algo/, sa_algo/, cg_algo/`);
console.log(`  - comparison_summary.csv`);
