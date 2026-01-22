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

const DATA_DIR = resolve(process.cwd(), 'analysis', 'data');
const RUNS = Number(process.env.SIM_RUNS ?? 5000);
const ROUNDS = Number(process.env.SIM_ROUNDS ?? 2);
const NUM_PLAYERS = Number(process.env.SIM_PLAYERS ?? 20);
const NUM_COURTS = Number(process.env.SIM_COURTS ?? 4);

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

const runSimulation = () => {
  ensureDataDir();

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

  writeFileSync(resolve(DATA_DIR, 'summary.csv'), toCsv(summaries));
  writeFileSync(resolve(DATA_DIR, 'pair_events.csv'), toCsv(pairEvents));

  const config = {
    runs: RUNS,
    rounds: ROUNDS,
    numPlayers: NUM_PLAYERS,
    numCourts: NUM_COURTS,
    timestamp: new Date().toISOString(),
  };
  writeFileSync(resolve(DATA_DIR, 'config.json'), JSON.stringify(config, null, 2));
};

runSimulation();

console.log(`Simulations complete. Data saved to ${DATA_DIR}`);
