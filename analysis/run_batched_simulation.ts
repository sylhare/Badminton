import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { CourtAssignmentEngine } from '../src/utils/CourtAssignmentEngine.ts';
import { CourtAssignmentEngineSA } from '../src/utils/CourtAssignmentEngineSA.ts';
import { ConflictGraphEngine } from '../src/utils/ConflictGraphEngine.ts';
import type { Player, Court } from '../src/types/index.ts';

// Configuration from analysis/data/config.json
const SCRIPT_DIR = import.meta.dirname;
const DATA_DIR = resolve(SCRIPT_DIR, 'data');
const CONFIG_PATH = resolve(DATA_DIR, 'config.json');

// Load config
const loadConfig = () => {
  if (!existsSync(CONFIG_PATH)) {
    return { runs: 100, rounds: 3, numPlayers: 20, numCourts: 4 };
  }
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
};

const config = loadConfig();
const RUNS = config.runs;
const ROUNDS = config.rounds;
const NUM_PLAYERS = config.numPlayers;
const NUM_COURTS = config.numCourts;
const NUM_BATCHES = 5;

// All available engines
const ALL_ENGINES = [
  { id: 'mc', name: 'Monte Carlo (MC)', engine: CourtAssignmentEngine, dir: 'mc_algo' },
  { id: 'sa', name: 'Simulated Annealing (SA)', engine: CourtAssignmentEngineSA, dir: 'sa_algo' },
  { id: 'cg', name: 'Conflict Graph (CG)', engine: ConflictGraphEngine, dir: 'cg_algo' },
] as const;

type EngineType = typeof ALL_ENGINES[number]['engine'];

type RoundResult = {
  roundIndex: number;
  pairToOpponent: Map<string, string>;
};

type SimulationSummary = {
  batch?: number;
  simulationId: number;
  rounds: number;
  repeatAnyPair: boolean;
  repeatPairDifferentOpponents: boolean;
  repeatPairSameOpponents: boolean;
  repeatPairCount: number;
  repeatPairDifferentOpponentsCount: number;
  repeatPairSameOpponentsCount: number;
};

type PairEvent = {
  batch?: number;
  simulationId: number;
  fromRound: number;
  toRound: number;
  pairId: string;
  opponentFrom: string;
  opponentTo: string;
  opponentChanged: boolean;
};

type BatchTiming = {
  batch: number;
  engineId: string;
  durationMs: number;
  runs: number;
  rounds: number;
};

const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

const toPlayerList = (count: number): Player[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `P${i + 1}`,
    name: `Player ${i + 1}`,
    isPresent: true,
  }));

const extractRoundPairs = (roundIndex: number, courts: Court[]): RoundResult => {
  const pairToOpponent = new Map<string, string>();

  for (const court of courts) {
    if (!court.teams || court.teams.team1.length !== 2 || court.teams.team2.length !== 2) continue;

    const [a1, a2] = court.teams.team1;
    const [b1, b2] = court.teams.team2;

    const team1 = pairKey(a1.id, a2.id);
    const team2 = pairKey(b1.id, b2.id);

    pairToOpponent.set(team1, team2);
    pairToOpponent.set(team2, team1);
  }

  return { roundIndex, pairToOpponent };
};

const evaluateRepeats = (rounds: RoundResult[], simulationId: number, batchId: number) => {
  let repeatPairCount = 0;
  let repeatPairDifferentOpponentsCount = 0;
  let repeatPairSameOpponentsCount = 0;
  const events: PairEvent[] = [];

  for (let i = 0; i < rounds.length - 1; i++) {
    const current = rounds[i];
    const next = rounds[i + 1];

    for (const [pairId, opponentFrom] of current.pairToOpponent.entries()) {
      const opponentTo = next.pairToOpponent.get(pairId);
      if (!opponentTo) continue;

      repeatPairCount += 1;
      const opponentChanged = opponentFrom !== opponentTo;
      if (opponentChanged) {
        repeatPairDifferentOpponentsCount += 1;
      } else {
        repeatPairSameOpponentsCount += 1;
      }

      events.push({
        batch: batchId,
        simulationId,
        fromRound: current.roundIndex,
        toRound: next.roundIndex,
        pairId,
        opponentFrom,
        opponentTo,
        opponentChanged,
      });
    }
  }

  return {
    repeatPairCount,
    repeatPairDifferentOpponentsCount,
    repeatPairSameOpponentsCount,
    events,
  };
};

const toCsv = (rows: Array<Record<string, string | number | boolean>>, defaultHeaders?: string[]): string => {
  const escape = (value: string | number | boolean) => {
    const raw = String(value);
    if (raw.includes(',') || raw.includes('"') || raw.includes('\n')) {
      return `"${raw.replaceAll('"', '""')}"`;
    }
    return raw;
  };
  
  if (rows.length === 0) {
    // Return header-only CSV if defaultHeaders provided
    return defaultHeaders ? defaultHeaders.join(',') : '';
  }
  
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map(header => escape(row[header] ?? '')).join(','));
  }
  return lines.join('\n');
};

const runSingleBatch = (batchId: number, Engine: EngineType): { summaries: SimulationSummary[]; pairEvents: PairEvent[] } => {
  const players = toPlayerList(NUM_PLAYERS);
  const summaries: SimulationSummary[] = [];
  const pairEvents: PairEvent[] = [];

  for (let simId = 1; simId <= RUNS; simId++) {
    Engine.resetHistory();

    const rounds: RoundResult[] = [];
    for (let round = 0; round < ROUNDS; round++) {
      const courts = Engine.generate(players, NUM_COURTS);
      rounds.push(extractRoundPairs(round + 1, courts));
    }

    const repeatStats = evaluateRepeats(rounds, simId, batchId);
    pairEvents.push(...repeatStats.events);

    summaries.push({
      batch: batchId,
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

  return { summaries, pairEvents };
};

const runEngineWithBatches = (engineConfig: typeof ALL_ENGINES[number]) => {
  const { id, name, engine, dir } = engineConfig;
  const engineDir = resolve(DATA_DIR, dir);
  mkdirSync(engineDir, { recursive: true });

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Running ${name} - ${NUM_BATCHES} batches`);
  console.log(`${'='.repeat(60)}`);

  const allSummaries: SimulationSummary[] = [];
  const allPairEvents: PairEvent[] = [];
  const batchTimings: BatchTiming[] = [];

  for (let batchId = 1; batchId <= NUM_BATCHES; batchId++) {
    const startTime = Date.now();
    
    const { summaries, pairEvents } = runSingleBatch(batchId, engine);
    
    const elapsed = Date.now() - startTime;
    
    allSummaries.push(...summaries);
    allPairEvents.push(...pairEvents);
    
    batchTimings.push({
      batch: batchId,
      engineId: id,
      durationMs: elapsed,
      runs: RUNS,
      rounds: ROUNDS,
    });

    const repeatCount = summaries.filter(s => s.repeatAnyPair).length;
    const repeatRate = (repeatCount / summaries.length) * 100;
    console.log(`  Batch ${batchId}: ${repeatRate.toFixed(1)}% repeat rate (${elapsed}ms)`);
  }

  // Write combined results
  const pairEventHeaders = ['batch', 'simulationId', 'fromRound', 'toRound', 'pairId', 'opponentFrom', 'opponentTo', 'opponentChanged'];
  writeFileSync(resolve(engineDir, 'summary.csv'), toCsv(allSummaries));
  writeFileSync(resolve(engineDir, 'pair_events.csv'), toCsv(allPairEvents, pairEventHeaders));
  writeFileSync(resolve(engineDir, 'batch_timings.csv'), toCsv(batchTimings));

  // Calculate aggregate stats
  const totalRepeats = allSummaries.filter(s => s.repeatAnyPair).length;
  const totalRepeatRate = (totalRepeats / allSummaries.length) * 100;
  const avgRepeats = allSummaries.reduce((acc, s) => acc + s.repeatPairDifferentOpponentsCount, 0) / allSummaries.length;
  const totalTime = batchTimings.reduce((acc, t) => acc + t.durationMs, 0);
  const avgTimePerBatch = totalTime / NUM_BATCHES;

  // Write engine config
  const engineConfigFile = {
    runs: RUNS,
    rounds: ROUNDS,
    numPlayers: NUM_PLAYERS,
    numCourts: NUM_COURTS,
    numBatches: NUM_BATCHES,
    totalSimulations: allSummaries.length,
    aggregateStats: {
      repeatRate: totalRepeatRate,
      avgRepeatsPerRun: avgRepeats,
      zeroRepeatRate: (allSummaries.filter(s => s.repeatPairDifferentOpponentsCount === 0).length / allSummaries.length) * 100,
    },
    timing: {
      totalMs: totalTime,
      avgPerBatchMs: avgTimePerBatch,
      batchTimings: batchTimings.map(t => ({ batch: t.batch, durationMs: t.durationMs })),
    },
    timestamp: new Date().toISOString(),
  };
  writeFileSync(resolve(engineDir, 'config.json'), JSON.stringify(engineConfigFile, null, 2));

  console.log(`\n  Summary for ${name}:`);
  console.log(`    Total simulations: ${allSummaries.length}`);
  console.log(`    Overall repeat rate: ${totalRepeatRate.toFixed(2)}%`);
  console.log(`    Zero-repeat rate: ${engineConfigFile.aggregateStats.zeroRepeatRate.toFixed(2)}%`);
  console.log(`    Avg repeats/run: ${avgRepeats.toFixed(3)}`);
  console.log(`    Total time: ${totalTime}ms (avg ${avgTimePerBatch.toFixed(0)}ms/batch)`);

  return { summaries: allSummaries, timings: batchTimings, stats: engineConfigFile.aggregateStats };
};

// Main execution
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║        BATCHED SIMULATION FOR ENGINE COMPARISON           ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log(`\nConfiguration:`);
console.log(`  Runs per batch: ${RUNS}`);
console.log(`  Rounds per run: ${ROUNDS}`);
console.log(`  Players: ${NUM_PLAYERS}`);
console.log(`  Courts: ${NUM_COURTS}`);
console.log(`  Batches: ${NUM_BATCHES}`);
console.log(`  Total simulations per engine: ${RUNS * NUM_BATCHES}`);

const allResults: Record<string, ReturnType<typeof runEngineWithBatches>> = {};

for (const engineConfig of ALL_ENGINES) {
  allResults[engineConfig.id] = runEngineWithBatches(engineConfig);
}

// Write comparison summary
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
    totalTimeMs: result.timings.reduce((a, t) => a + t.durationMs, 0),
  };
});

writeFileSync(resolve(DATA_DIR, 'comparison_summary.csv'), toCsv(comparisonData));

for (const row of comparisonData) {
  console.log(`${row.engineName.padEnd(30)} | ${row.zeroRepeatRate.toFixed(1).padStart(6)}% zero-repeat | ${row.avgRepeatsPerRun.toFixed(3).padStart(6)} avg | ${row.totalTimeMs}ms`);
}

console.log(`\n✓ Data saved to ${DATA_DIR}`);
console.log(`  - mc_algo/summary.csv, pair_events.csv, batch_timings.csv, config.json`);
console.log(`  - sa_algo/summary.csv, pair_events.csv, batch_timings.csv, config.json`);
console.log(`  - cg_algo/summary.csv, pair_events.csv, batch_timings.csv, config.json`);
console.log(`  - comparison_summary.csv`);
