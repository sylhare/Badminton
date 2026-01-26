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

// =============================================================================
// PLAYER SKILL LEVELS & MATCH OUTCOME SIMULATION
// =============================================================================

// Generate player skill levels (1-5) with a roughly normal distribution
// More players at level 2-4, fewer at extremes 1 and 5
const generatePlayerLevels = (count: number): Map<string, number> => {
  const levels = new Map<string, number>();
  // Distribution weights: level 1=10%, 2=25%, 3=30%, 4=25%, 5=10%
  const distribution = [1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5];
  
  for (let i = 0; i < count; i++) {
    const playerId = `P${i + 1}`;
    // Use deterministic assignment based on player index for reproducibility
    const level = distribution[i % distribution.length];
    levels.set(playerId, level);
  }
  return levels;
};

// Global player levels (consistent across all simulations)
const PLAYER_LEVELS = generatePlayerLevels(NUM_PLAYERS);

// Calculate team strength (sum of player levels)
const calculateTeamStrength = (players: Player[]): number => {
  return players.reduce((sum, p) => sum + (PLAYER_LEVELS.get(p.id) ?? 3), 0);
};

// Simulate match outcome based on team strengths
// Returns 1 if team1 wins, 2 if team2 wins
const simulateMatchOutcome = (team1Strength: number, team2Strength: number): 1 | 2 => {
  // PROBABILISTIC outcome - weaker teams CAN win, just less likely!
  // Uses logistic function: P(team1 wins) = 1 / (1 + exp(-k * strengthDiff))
  //
  // With k=0.3, win probabilities for the STRONGER team:
  //   diff 0: 50% (coin flip when equal)
  //   diff 1: 57%   <- very close, almost random
  //   diff 2: 65%   <- slight advantage
  //   diff 4: 77%   <- clear favorite but upsets happen ~23%
  //   diff 6: 86%   <- strong favorite, upsets ~14%
  //   diff 8: 92%   <- max diff (5+5 vs 1+1), still 8% upset chance!
  const k = 0.3; // Lower k = more randomness/upsets, higher k = skill dominates
  const strengthDiff = team1Strength - team2Strength;
  const pTeam1Wins = 1 / (1 + Math.exp(-k * strengthDiff));
  return Math.random() < pTeam1Wins ? 1 : 2;
};

// Types for match tracking
type MatchEvent = {
  batch: number;
  simulationId: number;
  roundIndex: number;
  courtIndex: number;
  team1Players: string; // "P1|P2"
  team2Players: string; // "P3|P4"
  team1Strength: number;
  team2Strength: number;
  strengthDifferential: number;
  winner: 1 | 2;
  strongerTeamWon: boolean;
};

type PlayerStats = {
  playerId: string;
  level: number;
  totalWins: number;
  totalLosses: number;
  gamesPlayed: number;
};

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
  matchEvents: MatchEvent[];
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

const extractRoundPairs = (
  roundIndex: number, 
  courts: Court[], 
  batchId: number, 
  simulationId: number
): RoundResult => {
  const pairToOpponent = new Map<string, string>();
  const matchEvents: MatchEvent[] = [];

  for (let courtIdx = 0; courtIdx < courts.length; courtIdx++) {
    const court = courts[courtIdx];
    if (!court.teams || court.teams.team1.length !== 2 || court.teams.team2.length !== 2) continue;

    const [a1, a2] = court.teams.team1;
    const [b1, b2] = court.teams.team2;

    const team1Key = pairKey(a1.id, a2.id);
    const team2Key = pairKey(b1.id, b2.id);

    pairToOpponent.set(team1Key, team2Key);
    pairToOpponent.set(team2Key, team1Key);

    // Calculate team strengths and simulate match outcome
    const team1Strength = calculateTeamStrength(court.teams.team1);
    const team2Strength = calculateTeamStrength(court.teams.team2);
    const strengthDiff = Math.abs(team1Strength - team2Strength);
    const winner = simulateMatchOutcome(team1Strength, team2Strength);
    const strongerTeam = team1Strength >= team2Strength ? 1 : 2;

    matchEvents.push({
      batch: batchId,
      simulationId,
      roundIndex,
      courtIndex: courtIdx + 1,
      team1Players: team1Key,
      team2Players: team2Key,
      team1Strength,
      team2Strength,
      strengthDifferential: strengthDiff,
      winner,
      strongerTeamWon: winner === strongerTeam,
    });
  }

  return { roundIndex, pairToOpponent, matchEvents };
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

const runSingleBatch = (batchId: number, Engine: EngineType): { 
  summaries: SimulationSummary[]; 
  pairEvents: PairEvent[];
  matchEvents: MatchEvent[];
} => {
  const players = toPlayerList(NUM_PLAYERS);
  const summaries: SimulationSummary[] = [];
  const pairEvents: PairEvent[] = [];
  const matchEvents: MatchEvent[] = [];

  for (let simId = 1; simId <= RUNS; simId++) {
    Engine.resetHistory();

    const rounds: RoundResult[] = [];
    for (let round = 0; round < ROUNDS; round++) {
      const courts = Engine.generate(players, NUM_COURTS);
      const roundResult = extractRoundPairs(round + 1, courts, batchId, simId);
      rounds.push(roundResult);
      for (const m of roundResult.matchEvents) matchEvents.push(m);
    }

    const repeatStats = evaluateRepeats(rounds, simId, batchId);
    for (const e of repeatStats.events) pairEvents.push(e);

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

  return { summaries, pairEvents, matchEvents };
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
  const allMatchEvents: MatchEvent[] = [];
  const batchTimings: BatchTiming[] = [];

  for (let batchId = 1; batchId <= NUM_BATCHES; batchId++) {
    const startTime = Date.now();
    
    const { summaries, pairEvents, matchEvents } = runSingleBatch(batchId, engine);
    
    const elapsed = Date.now() - startTime;
    
    // Use for loop instead of spread to avoid stack overflow with large arrays
    for (const s of summaries) allSummaries.push(s);
    for (const p of pairEvents) allPairEvents.push(p);
    for (const m of matchEvents) allMatchEvents.push(m);
    
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
  const matchEventHeaders = ['batch', 'simulationId', 'roundIndex', 'courtIndex', 'team1Players', 'team2Players', 'team1Strength', 'team2Strength', 'strengthDifferential', 'winner', 'strongerTeamWon'];
  
  writeFileSync(resolve(engineDir, 'summary.csv'), toCsv(allSummaries));
  writeFileSync(resolve(engineDir, 'pair_events.csv'), toCsv(allPairEvents, pairEventHeaders));
  writeFileSync(resolve(engineDir, 'match_events.csv'), toCsv(allMatchEvents, matchEventHeaders));
  writeFileSync(resolve(engineDir, 'batch_timings.csv'), toCsv(batchTimings));

  // Calculate aggregate stats
  const totalRepeats = allSummaries.filter(s => s.repeatAnyPair).length;
  const totalRepeatRate = (totalRepeats / allSummaries.length) * 100;
  const avgRepeats = allSummaries.reduce((acc, s) => acc + s.repeatPairDifferentOpponentsCount, 0) / allSummaries.length;
  const totalTime = batchTimings.reduce((acc, t) => acc + t.durationMs, 0);
  const avgTimePerBatch = totalTime / NUM_BATCHES;

  // Calculate team balance stats from match events
  const totalMatches = allMatchEvents.length;
  const strongerTeamWins = allMatchEvents.filter(m => m.strongerTeamWon).length;
  const avgStrengthDiff = allMatchEvents.reduce((acc, m) => acc + m.strengthDifferential, 0) / totalMatches;
  const perfectlyBalanced = allMatchEvents.filter(m => m.strengthDifferential === 0).length;

  // Calculate player win stats
  const playerWins = new Map<string, number>();
  const playerLosses = new Map<string, number>();
  const playerGames = new Map<string, number>();
  
  for (const match of allMatchEvents) {
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

  // Build player stats array
  const playerStats: PlayerStats[] = [];
  for (let i = 0; i < NUM_PLAYERS; i++) {
    const playerId = `P${i + 1}`;
    playerStats.push({
      playerId,
      level: PLAYER_LEVELS.get(playerId) ?? 3,
      totalWins: playerWins.get(playerId) ?? 0,
      totalLosses: playerLosses.get(playerId) ?? 0,
      gamesPlayed: playerGames.get(playerId) ?? 0,
    });
  }

  // Write player stats
  writeFileSync(resolve(engineDir, 'player_stats.csv'), toCsv(playerStats));

  // Write engine config with player profiles and balance stats
  const engineConfigFile = {
    runs: RUNS,
    rounds: ROUNDS,
    numPlayers: NUM_PLAYERS,
    numCourts: NUM_COURTS,
    numBatches: NUM_BATCHES,
    totalSimulations: allSummaries.length,
    playerProfiles: Object.fromEntries(
      Array.from(PLAYER_LEVELS.entries()).map(([id, level]) => [id, { level }])
    ),
    aggregateStats: {
      repeatRate: totalRepeatRate,
      avgRepeatsPerRun: avgRepeats,
      zeroRepeatRate: (allSummaries.filter(s => s.repeatPairDifferentOpponentsCount === 0).length / allSummaries.length) * 100,
    },
    balanceStats: {
      totalMatches,
      strongerTeamWinRate: (strongerTeamWins / totalMatches) * 100,
      avgStrengthDifferential: avgStrengthDiff,
      perfectlyBalancedMatches: perfectlyBalanced,
      perfectlyBalancedRate: (perfectlyBalanced / totalMatches) * 100,
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
  console.log(`    Stronger team win rate: ${engineConfigFile.balanceStats.strongerTeamWinRate.toFixed(1)}%`);
  console.log(`    Avg strength differential: ${avgStrengthDiff.toFixed(2)}`);
  console.log(`    Total time: ${totalTime}ms (avg ${avgTimePerBatch.toFixed(0)}ms/batch)`);

  return { summaries: allSummaries, timings: batchTimings, stats: engineConfigFile.aggregateStats, balanceStats: engineConfigFile.balanceStats };
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
    strongerTeamWinRate: result.balanceStats.strongerTeamWinRate,
    avgStrengthDiff: result.balanceStats.avgStrengthDifferential,
    totalTimeMs: result.timings.reduce((a, t) => a + t.durationMs, 0),
  };
});

writeFileSync(resolve(DATA_DIR, 'comparison_summary.csv'), toCsv(comparisonData));

console.log('\n  Repeat Metrics:');
for (const row of comparisonData) {
  console.log(`    ${row.engineName.padEnd(30)} | ${row.zeroRepeatRate.toFixed(1).padStart(6)}% zero-repeat | ${row.avgRepeatsPerRun.toFixed(3).padStart(6)} avg`);
}

console.log('\n  Balance Metrics:');
for (const row of comparisonData) {
  console.log(`    ${row.engineName.padEnd(30)} | ${row.strongerTeamWinRate.toFixed(1).padStart(5)}% stronger wins | ${row.avgStrengthDiff.toFixed(2).padStart(5)} avg diff`);
}

// Print player level distribution
console.log('\n  Player Levels:');
const levelCounts = [0, 0, 0, 0, 0, 0]; // index 1-5 used
for (const level of PLAYER_LEVELS.values()) {
  levelCounts[level]++;
}
console.log(`    Level 1: ${levelCounts[1]} players | Level 2: ${levelCounts[2]} players | Level 3: ${levelCounts[3]} players | Level 4: ${levelCounts[4]} players | Level 5: ${levelCounts[5]} players`);

console.log(`\n✓ Data saved to ${DATA_DIR}`);
console.log(`  - mc_algo/summary.csv, pair_events.csv, match_events.csv, player_stats.csv, batch_timings.csv, config.json`);
console.log(`  - sa_algo/summary.csv, pair_events.csv, match_events.csv, player_stats.csv, batch_timings.csv, config.json`);
console.log(`  - cg_algo/summary.csv, pair_events.csv, match_events.csv, player_stats.csv, batch_timings.csv, config.json`);
console.log(`  - comparison_summary.csv`);
console.log(`\n  New files for team balance analysis:`);
console.log(`    - match_events.csv: Team compositions, strengths, and match outcomes`);
console.log(`    - player_stats.csv: Per-player win/loss statistics`);
console.log(`    - config.json now includes playerProfiles with skill levels (1-5)`);