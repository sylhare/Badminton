import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { CourtAssignmentEngine } from '../src/utils/CourtAssignmentEngine.ts';
import type { Player, Court } from '../src/types/index.ts';

type RoundResult = {
  roundIndex: number;
  pairToOpponent: Map<string, string>;
};

type SimulationSummary = {
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
  simulationId: number;
  fromRound: number;
  toRound: number;
  pairId: string;
  opponentFrom: string;
  opponentTo: string;
  opponentChanged: boolean;
};

// Types for bench analysis
type BenchEvent = {
  simulationId: number;
  playerId: string;
  benchRound: number;
  gamesSinceLastBench: number;
};

type BenchSummary = {
  simulationId: number;
  numPlayers: number;
  numCourts: number;
  rounds: number;
  avgGamesBetweenBenches: number;
  minGamesBetweenBenches: number;
  maxGamesBetweenBenches: number;
  theoreticalMax: number;
};

// Use import.meta.dirname to get the directory of this script file
const SCRIPT_DIR = import.meta.dirname;
const DATA_DIR = resolve(SCRIPT_DIR, 'data');
const RUNS = Number(process.env.SIM_RUNS ?? 5000);
const ROUNDS = Number(process.env.SIM_ROUNDS ?? 2);
const NUM_PLAYERS = Number(process.env.SIM_PLAYERS ?? 20);
const NUM_COURTS = Number(process.env.SIM_COURTS ?? 4);
const BATCH_ID = process.env.SIM_BATCH_ID ?? '';
const NUM_BATCHES = Number(process.env.SIM_NUM_BATCHES ?? 1);

const ensureDataDir = () => {
  mkdirSync(DATA_DIR, { recursive: true });
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

const evaluateRepeats = (rounds: RoundResult[], simulationId: number) => {
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

const toCsv = (rows: Array<Record<string, string | number | boolean>>): string => {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (value: string | number | boolean) => {
    const raw = String(value);
    if (raw.includes(',') || raw.includes('"') || raw.includes('\n')) {
      return `"${raw.replaceAll('"', '""')}"`;
    }
    return raw;
  };
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map(header => escape(row[header] ?? '')).join(','));
  }
  return lines.join('\n');
};

const runSingleBatch = (batchId: string) => {
  const players = toPlayerList(NUM_PLAYERS);
  const summaries: SimulationSummary[] = [];
  const pairEvents: PairEvent[] = [];

  for (let simId = 1; simId <= RUNS; simId++) {
    CourtAssignmentEngine.resetHistory();

    const rounds: RoundResult[] = [];
    for (let round = 0; round < ROUNDS; round++) {
      const courts = CourtAssignmentEngine.generate(players, NUM_COURTS);
      rounds.push(extractRoundPairs(round + 1, courts));
    }

    const repeatStats = evaluateRepeats(rounds, simId);
    pairEvents.push(...repeatStats.events);

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

  const suffix = batchId ? `_batch${batchId}` : '';
  writeFileSync(resolve(DATA_DIR, `summary${suffix}.csv`), toCsv(summaries));
  writeFileSync(resolve(DATA_DIR, `pair_events${suffix}.csv`), toCsv(pairEvents));

  return { summaries, pairEvents };
};

const runSimulation = () => {
  ensureDataDir();

  // If running multiple batches, generate all of them
  if (NUM_BATCHES > 1) {
    const allBatchIds: string[] = [];
    for (let batch = 1; batch <= NUM_BATCHES; batch++) {
      console.log(`Running batch ${batch}/${NUM_BATCHES}...`);
      runSingleBatch(String(batch));
      allBatchIds.push(String(batch));
    }

    // Also run a single batch without suffix for backwards compatibility
    runSingleBatch('');

    const config = {
      runs: RUNS,
      rounds: ROUNDS,
      numPlayers: NUM_PLAYERS,
      numCourts: NUM_COURTS,
      numBatches: NUM_BATCHES,
      batchIds: allBatchIds,
      timestamp: new Date().toISOString(),
    };
    writeFileSync(resolve(DATA_DIR, 'config.json'), JSON.stringify(config, null, 2));
  } else if (BATCH_ID) {
    // Single batch with specific ID
    runSingleBatch(BATCH_ID);

    const config = {
      runs: RUNS,
      rounds: ROUNDS,
      numPlayers: NUM_PLAYERS,
      numCourts: NUM_COURTS,
      batchId: BATCH_ID,
      timestamp: new Date().toISOString(),
    };
    writeFileSync(resolve(DATA_DIR, 'config.json'), JSON.stringify(config, null, 2));
  } else {
    // Default: single batch without ID
    runSingleBatch('');

    const config = {
      runs: RUNS,
      rounds: ROUNDS,
      numPlayers: NUM_PLAYERS,
      numCourts: NUM_COURTS,
      timestamp: new Date().toISOString(),
    };
    writeFileSync(resolve(DATA_DIR, 'config.json'), JSON.stringify(config, null, 2));
  }
};

// ============================================================================
// BENCH ANALYSIS SIMULATION
// ============================================================================

const BENCH_DATA_DIR = resolve(SCRIPT_DIR, 'data', 'bench_analysis');
const BENCH_RUNS = Number(process.env.BENCH_RUNS ?? 1000);
const BENCH_ROUNDS = Number(process.env.BENCH_ROUNDS ?? 10);
const BENCH_MIN_PLAYERS = Number(process.env.BENCH_MIN_PLAYERS ?? 17);
const BENCH_MAX_PLAYERS = Number(process.env.BENCH_MAX_PLAYERS ?? 20);
const BENCH_COURTS = Number(process.env.BENCH_COURTS ?? 4);
const BENCH_BATCHES = Number(process.env.BENCH_BATCHES ?? 5);

const ensureBenchDataDir = () => {
  mkdirSync(BENCH_DATA_DIR, { recursive: true });
};

/**
 * Calculate the theoretical maximum games between benches in an ideal scenario.
 * With N players and C courts (4 players per court), the bench count per round is N - 4C.
 * In an ideal rotation, each player benches once every N/(N-4C) rounds.
 * So the maximum consecutive games before benching = ceil(N/(N-4C)) - 1
 * 
 * For a more intuitive formula:
 * - 16 playing spots per round (4 courts × 4 players)
 * - (N-16) players benched per round
 * - To spread benches evenly, each player sits out every N/(N-16) rounds
 * - Max games between benches = 16/(N-16) in the ideal continuous case
 */
const calculateTheoreticalMax = (numPlayers: number, numCourts: number): number => {
  const playingSpots = numCourts * 4;
  const benchSpots = numPlayers - playingSpots;
  if (benchSpots <= 0) return Infinity; // More spots than players - never bench
  // In ideal rotation: max consecutive games = (playingSpots / benchSpots)
  return playingSpots / benchSpots;
};

const runBenchSimulation = (numPlayers: number, batchId: number) => {
  const players = toPlayerList(numPlayers);
  const benchEvents: BenchEvent[] = [];
  const summaries: BenchSummary[] = [];

  for (let simId = 1; simId <= BENCH_RUNS; simId++) {
    CourtAssignmentEngine.resetHistory();

    // Track last bench round for each player (0 = start, meaning never benched yet)
    const lastBenchRound: Map<string, number> = new Map();
    players.forEach(p => lastBenchRound.set(p.id, 0));

    const allGapsBetweenBenches: number[] = [];

    for (let round = 1; round <= BENCH_ROUNDS; round++) {
      const courts = CourtAssignmentEngine.generate(players, BENCH_COURTS);
      const playingIds = new Set(courts.flatMap(c => c.players.map(p => p.id)));

      // Find who is benched this round
      for (const player of players) {
        if (!playingIds.has(player.id)) {
          // Player is benched
          const lastBench = lastBenchRound.get(player.id) ?? 0;
          const gamesSinceLastBench = round - lastBench - 1; // Games played between benches

          if (lastBench > 0) {
            // Only record if this isn't their first bench
            benchEvents.push({
              simulationId: simId,
              playerId: player.id,
              benchRound: round,
              gamesSinceLastBench,
            });
            allGapsBetweenBenches.push(gamesSinceLastBench);
          }

          lastBenchRound.set(player.id, round);
        }
      }
    }

    // Calculate summary stats for this simulation
    const theoreticalMax = calculateTheoreticalMax(numPlayers, BENCH_COURTS);
    
    if (allGapsBetweenBenches.length > 0) {
      summaries.push({
        simulationId: simId,
        numPlayers,
        numCourts: BENCH_COURTS,
        rounds: BENCH_ROUNDS,
        avgGamesBetweenBenches: allGapsBetweenBenches.reduce((a, b) => a + b, 0) / allGapsBetweenBenches.length,
        minGamesBetweenBenches: Math.min(...allGapsBetweenBenches),
        maxGamesBetweenBenches: Math.max(...allGapsBetweenBenches),
        theoreticalMax,
      });
    }
  }

  // Write results
  const suffix = `_${numPlayers}p_batch${batchId}`;
  writeFileSync(resolve(BENCH_DATA_DIR, `bench_events${suffix}.csv`), toCsv(benchEvents));
  writeFileSync(resolve(BENCH_DATA_DIR, `bench_summary${suffix}.csv`), toCsv(summaries));

  return { benchEvents, summaries };
};

const runAllBenchSimulations = () => {
  ensureBenchDataDir();

  const allConfigs: Array<{ numPlayers: number; batchId: number }> = [];

  for (let numPlayers = BENCH_MIN_PLAYERS; numPlayers <= BENCH_MAX_PLAYERS; numPlayers++) {
    for (let batchId = 1; batchId <= BENCH_BATCHES; batchId++) {
      allConfigs.push({ numPlayers, batchId });
    }
  }

  console.log(`Running bench analysis: ${allConfigs.length} configurations...`);

  for (const { numPlayers, batchId } of allConfigs) {
    console.log(`  Running ${numPlayers} players, batch ${batchId}...`);
    runBenchSimulation(numPlayers, batchId);
  }

  // Write config file
  const config = {
    runs: BENCH_RUNS,
    rounds: BENCH_ROUNDS,
    minPlayers: BENCH_MIN_PLAYERS,
    maxPlayers: BENCH_MAX_PLAYERS,
    numCourts: BENCH_COURTS,
    numBatches: BENCH_BATCHES,
    timestamp: new Date().toISOString(),
  };
  writeFileSync(resolve(BENCH_DATA_DIR, 'config.json'), JSON.stringify(config, null, 2));

  console.log(`Bench analysis complete. Data saved to ${BENCH_DATA_DIR}`);
};

// Main execution: run standard simulation or bench analysis based on env var
const simulationType = process.env.SIM_TYPE ?? 'standard';

if (simulationType === 'bench') {
  runAllBenchSimulations();
} else {
  runSimulation();
  console.log(`Simulations complete. Data saved to ${DATA_DIR}`);
}
