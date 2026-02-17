import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Player, Court } from '../../src/types';
import type {
  MatchEvent,
  MatchPairEvent,
  PairEvent,
  RoundResult,
  SimulationConfig,
} from './types';

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

/** Generates player skill levels with roughly normal distribution (1=30%, 2=35%, 3=15%, 4=5%, 5=15%). */
export const generatePlayerLevels = (count: number): Map<string, number> => {
  const levels = new Map<string, number>();
  const distribution = [1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 4, 5, 5, 5];

  for (let i = 0; i < count; i++) {
    const playerId = `P${i + 1}`;
    const level = distribution[i % distribution.length];
    levels.set(playerId, level);
  }
  return levels;
};

export const calculateTeamStrength = (players: Player[], playerLevels: Map<string, number>): number => {
  return players.reduce((sum, p) => sum + (playerLevels.get(p.id) ?? 3), 0);
};

/** Simulates match outcome using logistic probability (k=0.3). */
export const simulateMatchOutcome = (team1Strength: number, team2Strength: number): 1 | 2 => {
  const k = 0.3;
  const strengthDiff = team1Strength - team2Strength;
  const pTeam1Wins = 1 / (1 + Math.exp(-k * strengthDiff));
  return Math.random() < pTeam1Wins ? 1 : 2;
};

export const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

export const toPlayerList = (count: number): Player[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `P${i + 1}`,
    name: `Player ${i + 1}`,
    isPresent: true,
  }));

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
  Engine: any,
  playerLevels: Map<string, number>,
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

    const team1Strength = calculateTeamStrength(court.teams.team1, playerLevels);
    const team2Strength = calculateTeamStrength(court.teams.team2, playerLevels);
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

export const evaluateRepeats = (rounds: RoundResult[], simulationId: number) => {
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
