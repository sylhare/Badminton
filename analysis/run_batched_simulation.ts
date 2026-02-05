import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { CourtAssignmentEngine } from '../src/utils/CourtAssignmentEngine.ts';
import { CourtAssignmentEngineSA } from '../src/utils/CourtAssignmentEngineSA.ts';
import { ConflictGraphEngine } from '../src/utils/ConflictGraphEngine.ts';
import type { Player, Court } from '../src/types/index.ts';

/**
 * Random baseline engine with no optimization.
 * Provides contrast with optimized engines by using pure random assignment
 * without any bench fairness or pairing optimization.
 */
class RandomBaselineEngine {
  private static winCountMap: Map<string, number> = new Map();

  static reset(): void {
    this.winCountMap.clear();
  }

  static resetHistory(): void {
    this.winCountMap.clear();
  }

  static recordWins(courts: Court[]): void {
    for (const court of courts) {
      if (court.winner && court.teams) {
        const winningTeam = court.winner === 1 ? court.teams.team1 : court.teams.team2;
        for (const player of winningTeam) {
          this.winCountMap.set(player.id, (this.winCountMap.get(player.id) ?? 0) + 1);
        }
      }
    }
  }

  static getWinCounts(): Map<string, number> {
    return new Map(this.winCountMap);
  }

  /**
   * Generates court assignments using pure random shuffling.
   * @param players - All players to consider
   * @param numberOfCourts - Maximum courts available
   * @returns Array of court assignments
   */
  static generate(players: Player[], numberOfCourts: number): Court[] {
    const presentPlayers = players.filter(p => p.isPresent);
    if (presentPlayers.length === 0) return [];

    const shuffled = [...presentPlayers].sort(() => Math.random() - 0.5);
    const capacity = numberOfCourts * 4;
    const onCourt = shuffled.slice(0, Math.min(shuffled.length, capacity));
    
    const courts: Court[] = [];
    let idx = 0;
    
    for (let courtNum = 1; courtNum <= numberOfCourts && idx + 3 < onCourt.length; courtNum++) {
      const courtPlayers = onCourt.slice(idx, idx + 4);
      idx += 4;
      
      if (courtPlayers.length < 4) break;
      
      const splits = [
        { team1: [courtPlayers[0], courtPlayers[1]], team2: [courtPlayers[2], courtPlayers[3]] },
        { team1: [courtPlayers[0], courtPlayers[2]], team2: [courtPlayers[1], courtPlayers[3]] },
        { team1: [courtPlayers[0], courtPlayers[3]], team2: [courtPlayers[1], courtPlayers[2]] },
      ];
      const teams = splits[Math.floor(Math.random() * 3)];
      
      courts.push({ courtNumber: courtNum, players: courtPlayers, teams });
    }
    
    return courts;
  }
}

// ============================================================================
// Configuration
// ============================================================================

const SCRIPT_DIR = import.meta.dirname;
const DATA_DIR = resolve(SCRIPT_DIR, 'data');
const CONFIG_PATH = resolve(DATA_DIR, 'config.json');

/** Loads simulation configuration from config.json or returns defaults. */
const loadConfig = () => {
  if (!existsSync(CONFIG_PATH)) {
    return { runs: 100, rounds: 10, playerCounts: [20], numCourts: 4 };
  }
  const raw = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
  // Support both old `numPlayers` and new `playerCounts` format
  if (!raw.playerCounts && raw.numPlayers) {
    raw.playerCounts = [raw.numPlayers];
  }
  return raw;
};

const config = loadConfig();
const RUNS = config.runs;
const ROUNDS = config.rounds;
const PLAYER_COUNTS: number[] = config.playerCounts ?? [20];
const MAX_COURTS = config.numCourts;
const MAX_PLAYERS = Math.max(...PLAYER_COUNTS);

// ============================================================================
// Player Skill Levels & Match Outcome Simulation
// ============================================================================

/**
 * Generates player skill levels (1-5) with a roughly normal distribution.
 * Distribution: level 1=30%, 2=35%, 3=15%, 4=5%, 5=15%
 * @param count - Number of players to generate levels for
 */
const generatePlayerLevels = (count: number): Map<string, number> => {
  const levels = new Map<string, number>();
  const distribution = [1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 4, 5, 5, 5];
  
  for (let i = 0; i < count; i++) {
    const playerId = `P${i + 1}`;
    const level = distribution[i % distribution.length];
    levels.set(playerId, level);
  }
  return levels;
};

const PLAYER_LEVELS = generatePlayerLevels(MAX_PLAYERS);

/** Calculates team strength as sum of player levels. */
const calculateTeamStrength = (players: Player[]): number => {
  return players.reduce((sum, p) => sum + (PLAYER_LEVELS.get(p.id) ?? 3), 0);
};

/**
 * Simulates match outcome using logistic probability based on team strengths.
 * Uses k=0.3 for the logistic function, giving these win probabilities for the stronger team:
 * - diff 0: 50%, diff 1: 57%, diff 2: 65%, diff 4: 77%, diff 6: 86%, diff 8: 92%
 * @returns 1 if team1 wins, 2 if team2 wins
 */
const simulateMatchOutcome = (team1Strength: number, team2Strength: number): 1 | 2 => {
  const k = 0.3;
  const strengthDiff = team1Strength - team2Strength;
  const pTeam1Wins = 1 / (1 + Math.exp(-k * strengthDiff));
  return Math.random() < pTeam1Wins ? 1 : 2;
};

// ============================================================================
// Types
// ============================================================================

/** Records a single match with team compositions, strengths, and outcome. */
type MatchEvent = {
  simulationId: number;
  roundIndex: number;
  courtIndex: number;
  team1Players: string;
  team2Players: string;
  team1Strength: number;
  team2Strength: number;
  strengthDifferential: number;
  winner: 1 | 2;
  strongerTeamWon: boolean;
  team1EngineWins: number;
  team2EngineWins: number;
  engineWinDifferential: number;
  engineBalancedTeamWon: boolean;
};

/** Aggregate statistics for a player across all simulations. */
type PlayerStats = {
  playerId: string;
  level: number;
  totalWins: number;
  totalLosses: number;
  gamesPlayed: number;
};

/** Aggregate bench fairness statistics for a session. */
type SessionBenchStats = {
  simulationId: number;
  numPlayers: number;
  maxBenchCount: number;
  minBenchCount: number;
  benchRange: number;
  avgBenchCount: number;
  meanGap: number;
  doubleBenchCount: number;
  totalGapEvents: number;
};

/** Tracks when two players were in the same match. */
type MatchPairEvent = {
  simulationId: number;
  roundIndex: number;
  pairId: string;
  wasTeammate: boolean;
};

/** Summary of repeat pair statistics for a simulation. */
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

/** Records when a team pairing was repeated across rounds. */
type PairEvent = {
  simulationId: number;
  fromRound: number;
  toRound: number;
  pairId: string;
  opponentFrom: string;
  opponentTo: string;
  opponentChanged: boolean;
};

/** Results extracted from a single round. */
type RoundResult = {
  roundIndex: number;
  pairToOpponent: Map<string, string>;
  matchEvents: MatchEvent[];
  matchPairEvents: MatchPairEvent[];
};

// ============================================================================
// Engine Registry
// ============================================================================

const ALL_ENGINES = [
  { id: 'random', name: 'Random Baseline', engine: RandomBaselineEngine, dir: 'random_baseline' },
  { id: 'mc', name: 'Monte Carlo (MC)', engine: CourtAssignmentEngine, dir: 'mc_algo' },
  { id: 'sa', name: 'Simulated Annealing (SA)', engine: CourtAssignmentEngineSA, dir: 'sa_algo' },
  { id: 'cg', name: 'Conflict Graph (CG)', engine: ConflictGraphEngine, dir: 'cg_algo' },
] as const;

type EngineType = typeof ALL_ENGINES[number]['engine'];

// ============================================================================
// Utility Functions
// ============================================================================

/** Creates a canonical pair key by sorting player IDs. */
const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** Creates a list of present players with sequential IDs. */
const toPlayerList = (count: number): Player[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `P${i + 1}`,
    name: `Player ${i + 1}`,
    isPresent: true,
  }));

/**
 * Converts an array of records to CSV format.
 * @param rows - Array of objects to convert
 * @param defaultHeaders - Headers to use if rows is empty
 */
const toCsv = (rows: Array<Record<string, string | number | boolean>>, defaultHeaders?: string[]): string => {
  const escape = (value: string | number | boolean) => {
    const raw = String(value);
    if (raw.includes(',') || raw.includes('"') || raw.includes('\n')) {
      return `"${raw.replaceAll('"', '""')}"`;
    }
    return raw;
  };
  
  if (rows.length === 0) {
    return defaultHeaders ? defaultHeaders.join(',') : '';
  }
  
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map(header => escape(row[header] ?? '')).join(','));
  }
  return lines.join('\n');
};

// ============================================================================
// Simulation Logic
// ============================================================================

/**
 * Extracts match data from court assignments for a single round.
 * Records wins to the engine for skill balancing in subsequent rounds.
 */
const extractRoundPairs = (
  roundIndex: number, 
  courts: Court[], 
  simulationId: number,
  Engine: EngineType
): RoundResult => {
  const pairToOpponent = new Map<string, string>();
  const matchEvents: MatchEvent[] = [];
  const matchPairEvents: MatchPairEvent[] = [];
  const courtsWithWinners: Court[] = [];
  const engineWinCounts = Engine.getWinCounts ? Engine.getWinCounts() : new Map<string, number>();

  for (let courtIdx = 0; courtIdx < courts.length; courtIdx++) {
    const court = courts[courtIdx];
    if (!court.teams) continue;

    const [a1, a2] = court.teams.team1;
    const [b1, b2] = court.teams.team2;

    const team1Key = pairKey(a1.id, a2.id);
    const team2Key = pairKey(b1.id, b2.id);

    pairToOpponent.set(team1Key, team2Key);
    pairToOpponent.set(team2Key, team1Key);

    const allPlayers = [a1, a2, b1, b2];
    for (let i = 0; i < allPlayers.length; i++) {
      for (let j = i + 1; j < allPlayers.length; j++) {
        const p1 = allPlayers[i];
        const p2 = allPlayers[j];
        const wasTeammate = (i < 2 && j < 2) || (i >= 2 && j >= 2);
        matchPairEvents.push({
          simulationId,
          roundIndex,
          pairId: pairKey(p1.id, p2.id),
          wasTeammate,
        });
      }
    }

    const team1Strength = calculateTeamStrength(court.teams.team1);
    const team2Strength = calculateTeamStrength(court.teams.team2);
    const strengthDiff = Math.abs(team1Strength - team2Strength);
    const winner = simulateMatchOutcome(team1Strength, team2Strength);
    const strongerTeam = team1Strength >= team2Strength ? 1 : 2;

    const team1EngineWins = (engineWinCounts.get(a1.id) ?? 0) + (engineWinCounts.get(a2.id) ?? 0);
    const team2EngineWins = (engineWinCounts.get(b1.id) ?? 0) + (engineWinCounts.get(b2.id) ?? 0);
    const engineWinDiff = Math.abs(team1EngineWins - team2EngineWins);
    const engineStrongerTeam = team1EngineWins >= team2EngineWins ? 1 : 2;

    courtsWithWinners.push({ ...court, winner });

    matchEvents.push({
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
      team1EngineWins,
      team2EngineWins,
      engineWinDifferential: engineWinDiff,
      engineBalancedTeamWon: winner === engineStrongerTeam,
    });
  }

  if (Engine.recordWins) {
    Engine.recordWins(courtsWithWinners);
  }

  return { roundIndex, pairToOpponent, matchEvents, matchPairEvents };
};

/** Analyzes rounds for repeated team pairings. */
const evaluateRepeats = (rounds: RoundResult[], simulationId: number) => {
  let repeatPairCount = 0;
  let repeatPairDifferentOpponentsCount = 0;
  let repeatPairSameOpponentsCount = 0;
  const events: PairEvent[] = [];

  const pairOccurrences = new Map<string, { roundIndex: number; opponent: string }[]>();
  
  for (const round of rounds) {
    for (const [pairId, opponent] of round.pairToOpponent.entries()) {
      const occurrences = pairOccurrences.get(pairId) ?? [];
      occurrences.push({ roundIndex: round.roundIndex, opponent });
      pairOccurrences.set(pairId, occurrences);
    }
  }

  for (const [pairId, occurrences] of pairOccurrences.entries()) {
    if (occurrences.length <= 1) continue;

    const firstOccurrence = occurrences[0];
    
    for (let i = 1; i < occurrences.length; i++) {
      const repeat = occurrences[i];
      repeatPairCount += 1;
      
      const opponentChanged = firstOccurrence.opponent !== repeat.opponent;
      if (opponentChanged) {
        repeatPairDifferentOpponentsCount += 1;
      } else {
        repeatPairSameOpponentsCount += 1;
      }

      events.push({
        simulationId,
        fromRound: firstOccurrence.roundIndex,
        toRound: repeat.roundIndex,
        pairId,
        opponentFrom: firstOccurrence.opponent,
        opponentTo: repeat.opponent,
        opponentChanged,
      });
    }
  }

  return { repeatPairCount, repeatPairDifferentOpponentsCount, repeatPairSameOpponentsCount, events };
};

/**
 * Runs multiple simulation sessions for a single engine with a specific player count.
 * Each session consists of multiple rounds with the engine making court assignments.
 */
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
      
      const roundResult = extractRoundPairs(round + 1, courts, simId, Engine);
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
        
        // Removed detailed bench events - only aggregate stats are needed
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

/**
 * Runs simulation for a single engine configuration and writes results to disk.
 * Runs batches for each player count in PLAYER_COUNTS.
 * @param engineConfig - Engine configuration from ALL_ENGINES
 */
const runEngine = (engineConfig: typeof ALL_ENGINES[number]) => {
  const { name, engine, dir } = engineConfig;
  const engineDir = resolve(DATA_DIR, dir);
  mkdirSync(engineDir, { recursive: true });

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Running ${name}`);
  console.log(`${'='.repeat(60)}`);

  const startTime = Date.now();
  
  // Aggregate results across all player counts
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
        .map(([id, level]) => [id, { level }])
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

// ============================================================================
// Main Execution
// ============================================================================

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
