import { existsSync, readFileSync } from 'node:fs';

import type { Court, Player } from '../../src/types';
import { opponentPairs, pairKey, teamPairs } from '../../src/utils/playerUtils';

import type { ICourtAssignmentEngine, MatchEvent, MatchPairEvent, PairEvent, RoundResult, SimulationConfig } from './types';

export const loadConfig = (configPath: string): SimulationConfig => {
  if (!existsSync(configPath)) {
    return { runs: 100, rounds: 10, playerCounts: [20], numCourts: 4 };
  }
  const raw = JSON.parse(readFileSync(configPath, 'utf-8'));
  if (!raw.playerCounts && raw.numPlayers) {
    raw.playerCounts = [raw.numPlayers];
  }
  return raw;
};

/** Generates player skill levels (0-100 scale) with roughly normal distribution (20=30%, 40=35%, 60=15%, 80=5%, 100=15%).
 * Levels are interleaved so adjacent player IDs have different levels, preventing false adjacency bias. */
export const generatePlayerLevels = (count: number): Map<string, number> => {
  const levels = new Map<string, number>();
  const distribution = [20, 40, 60, 100, 20, 40, 60, 100, 20, 40, 60, 100, 20, 40, 80, 40, 20, 40, 20, 40];

  for (let i = 0; i < count; i++) {
    const playerId = `P${i + 1}`;
    const level = distribution[i % distribution.length];
    levels.set(playerId, level);
  }
  return levels;
};

export const calculateTeamStrength = (players: Player[], playerLevels: Map<string, number>): number => {
  return players.reduce((sum, p) => sum + (playerLevels.get(p.id) ?? 60), 0);
};

/** Simulates match outcome using logistic probability (k=0.3). */
export const simulateMatchOutcome = (team1Strength: number, team2Strength: number): 1 | 2 => {
  const k = 0.3;
  const strengthDiff = team1Strength - team2Strength;
  const pTeam1Wins = 1 / (1 + Math.exp(-k * strengthDiff));
  return Math.random() < pTeam1Wins ? 1 : 2;
};

/** Simulates 50/50 random match outcome. */
export const simulateRandomMatchOutcome = (): 1 | 2 => (Math.random() < 0.5 ? 1 : 2);

/** Available disparity benchmark profile names. */
export type DisparityProfile =
  | 'lot_strong_lot_weak'
  | 'few_strong_few_weak'
  | 'lot_strong'
  | 'few_weak'
  | 'lot_weak_few_strong';

/** List of all supported disparity benchmark profiles. */
export const DISPARITY_PROFILES: DisparityProfile[] = [
  'lot_strong_lot_weak',
  'few_strong_few_weak',
  'lot_strong',
  'few_weak',
  'lot_weak_few_strong',
];

/** Count configuration for disparity profiles. */
export const DISPARITY_CONFIGS: Record<DisparityProfile, { strong: number; weak: number }> = {
  lot_strong_lot_weak: { strong: 6, weak: 6 },
  few_strong_few_weak: { strong: 2, weak: 2 },
  lot_strong: { strong: 8, weak: 0 },
  few_weak: { strong: 0, weak: 2 },
  lot_weak_few_strong: { strong: 2, weak: 6 },
};

/** Generates player skill level map for a disparity profile and player count. */
export const generateDisparityPlayerLevels = (
  profile: DisparityProfile,
  count: number,
): Map<string, number> => {
  const cfg = DISPARITY_CONFIGS[profile];
  const levels = new Map<string, number>();
  const strongCount = cfg.strong;
  const weakCount = cfg.weak;
  const mediumCount = Math.max(0, count - strongCount - weakCount);

  const levelList: number[] = [
    ...Array(strongCount).fill(75),
    ...Array(weakCount).fill(25),
    ...Array(mediumCount).fill(50),
  ];

  for (let i = 0; i < count; i++) {
    levels.set(`P${i + 1}`, levelList[i] ?? 50);
  }
  return levels;
};

/** Generates players with levels and gender matching a disparity profile. */
export const generateDisparityPlayers = (
  profile: DisparityProfile,
  count: number,
): Player[] => {
  const levels = generateDisparityPlayerLevels(profile, count);
  return toPlayerList(count, levels);
};

/** Returns skill tier for a player level. */
export const getPlayerTier = (level: number): 'strong' | 'medium' | 'weak' => {
  if (level >= 70) return 'strong';
  if (level <= 30) return 'weak';
  return 'medium';
};

const GENDER_PATTERN: Array<'M' | 'F'> = ['M', 'M', 'F', 'M', 'F'];

/**
 * Creates the player list for a simulation.
 * When `playerLevels` is provided, each player also gets a `level` (0-100 scale)
 * and a `gender` (60% M / 40% F repeating
 * pattern), so gender/level-aware engines (SL) can apply their cost functions.
 */
export const toPlayerList = (count: number, playerLevels?: Map<string, number>): Player[] =>
  Array.from({ length: count }, (_, i) => {
    const id = `P${i + 1}`;
    const skillLevel = playerLevels?.get(id);
    return {
      id,
      name: `Player ${i + 1}`,
      isPresent: true,
      ...(playerLevels && {
        level: Math.min(100, Math.max(0, skillLevel ?? 60)),
        gender: GENDER_PATTERN[i % GENDER_PATTERN.length],
      }),
    };
  });

export const toCsv = (rows: Array<Record<string, string | number | boolean>>, defaultHeaders?: string[]): string => {
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

export const extractRoundPairs = (
  roundIndex: number,
  courts: Court[],
  simulationId: number,
  numPlayers: number,
  Engine: ICourtAssignmentEngine,
  playerLevels: Map<string, number>,
  randomMatchOutcome = false,
): RoundResult => {
  const pairToOpponent = new Map<string, string>();
  const matchEvents: MatchEvent[] = [];
  const matchPairEvents: MatchPairEvent[] = [];
  const courtsWithWinners: Court[] = [];
  const winCountRecord = Engine.snapshot().winCountMap;

  for (let courtIdx = 0; courtIdx < courts.length; courtIdx++) {
    const court = courts[courtIdx];
    if (!court.teams) continue;

    const [a1, a2] = court.teams.team1;
    const [b1, b2] = court.teams.team2;
    if (!a1 || !a2 || !b1 || !b2) continue;

    const team1Key = pairKey(a1.id, a2.id);
    const team2Key = pairKey(b1.id, b2.id);

    pairToOpponent.set(team1Key, team2Key);
    pairToOpponent.set(team2Key, team1Key);

    for (const pairId of teamPairs(court.teams.team1)) {
      matchPairEvents.push({
        simulationId,
        roundIndex,
        pairId,
        wasTeammate: true,
      });
    }
    for (const pairId of teamPairs(court.teams.team2)) {
      matchPairEvents.push({
        simulationId,
        roundIndex,
        pairId,
        wasTeammate: true,
      });
    }
    for (const pairId of opponentPairs(court.teams.team1, court.teams.team2)) {
      matchPairEvents.push({
        simulationId,
        roundIndex,
        pairId,
        wasTeammate: false,
      });
    }

    const team1Strength = calculateTeamStrength(court.teams.team1, playerLevels);
    const team2Strength = calculateTeamStrength(court.teams.team2, playerLevels);
    const strengthDiff = Math.abs(team1Strength - team2Strength);
    const matchAvgLevel = court.players.reduce((sum, p) => sum + (p.level ?? 0), 0) / court.players.length;
    const [ta1, ta2] = [a1, a2].map(p => p.level ?? 50);
    const [tb1, tb2] = [b1, b2].map(p => p.level ?? 50);
    const team1AvgLevel = (ta1 + ta2) / 2;
    const team2AvgLevel = (tb1 + tb2) / 2;
    const team1IntraGap = Math.abs(ta1 - ta2);
    const team2IntraGap = Math.abs(tb1 - tb2);
    const winner = randomMatchOutcome
      ? simulateRandomMatchOutcome()
      : simulateMatchOutcome(team1Strength, team2Strength);
    const strongerTeam = team1Strength >= team2Strength ? 1 : 2;

    const team1EngineWins = (winCountRecord[a1.id] ?? 0) + (winCountRecord[a2.id] ?? 0);
    const team2EngineWins = (winCountRecord[b1.id] ?? 0) + (winCountRecord[b2.id] ?? 0);
    const engineWinDiff = Math.abs(team1EngineWins - team2EngineWins);
    const engineStrongerTeam = team1EngineWins >= team2EngineWins ? 1 : 2;

    courtsWithWinners.push({ ...court, winner });

    matchEvents.push({
      simulationId,
      numPlayers,
      roundIndex,
      courtIndex: courtIdx + 1,
      team1Players: team1Key,
      team2Players: team2Key,
      team1Strength,
      team2Strength,
      strengthDifferential: strengthDiff,
      matchAvgLevel,
      team1IntraGap,
      team2IntraGap,
      team1AvgLevel,
      team2AvgLevel,
      winner,
      strongerTeamWon: winner === strongerTeam,
      team1EngineWins,
      team2EngineWins,
      engineWinDifferential: engineWinDiff,
      engineBalancedTeamWon: winner === engineStrongerTeam,
    });
  }

  Engine.recordWins(courtsWithWinners);

  return { roundIndex, pairToOpponent, matchEvents, matchPairEvents };
};

export const evaluateRepeats = (
  rounds: RoundResult[],
  simulationId: number,
): {
  repeatPairCount: number;
  repeatPairDifferentOpponentsCount: number;
  repeatPairSameOpponentsCount: number;
  events: PairEvent[]
} => {
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
