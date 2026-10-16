import { type CourtEngineState, DEFAULT_LEVEL } from '../../src/types';
import { decodeEngineState } from '../../src/utils/StorageManager';
import { toPlayerList } from '../simulation/utils.ts';

import type { SessionResult, UiEngine, UiPlayerStat } from './types';

/** localStorage key the app persists its state under. */
export const STATE_KEY = 'badminton-state';

export interface SeededPlayer {
  id: string;
  name: string;
  isPresent: boolean;
  level: number;
  gender: 'M' | 'F';
}

/**
 * Build the player list for a UI session from the config player profiles,
 * reusing the shared `toPlayerList` builder. Falls back to a neutral level
 * when a profile is missing.
 */
export function buildPlayers(count: number, profiles: Record<string, { level: number }> = {}): SeededPlayer[] {
  const levels = new Map<string, number>();
  for (let i = 1; i <= count; i++) {
    const id = `P${i}`;
    levels.set(id, profiles[id]?.level ?? DEFAULT_LEVEL);
  }
  return toPlayerList(count, levels) as SeededPlayer[];
}

/**
 * Plain-JSON app state to inject into localStorage before reload.
 * The app's StorageManager.decompress falls back to the raw string when the
 * value is not gzip+base64, so plain JSON is read back correctly.
 */
export function buildSeedState(players: SeededPlayer[], numberOfCourts: number, engine: UiEngine): string {
  return JSON.stringify({
    app: {
      players,
      numberOfCourts,
      isSmartEngineEnabled: engine === 'sl',
      sessionId: `ui-load-${engine}`,
      savedAt: 0,
    },
  });
}

export interface DecodedState {
  engine?: Partial<CourtEngineState>;
}

/** Map seeded player display names to their skill level (DOM shows names, not ids). */
export function levelByName(players: SeededPlayer[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const p of players) map[p.name] = p.level;
  return map;
}

/**
 * Decode the saved localStorage value using the app's own codec.
 * Decode once per session and hand the result to both `deriveSessionResult`
 * and `decodePlayerStats`.
 */
export async function decodeState(raw: string): Promise<DecodedState> {
  try {
    const engine = await decodeEngineState(raw);
    return { engine };
  } catch {
    return {};
  }
}

/**
 * Derive per-session metrics from the compact engine state the app saved.
 * Teammate-repeat counts are supplied separately by the caller from the rounds
 * observed in the DOM, so they are not computed here.
 */
export function deriveSessionResult(
  state: DecodedState,
  base: Pick<SessionResult, 'engine' | 'concurrency' | 'sessionId' | 'players' | 'courts' | 'rounds' | 'totalMs'>,
  generateMs: number[],
): Omit<SessionResult, 'teammatePairs' | 'repeatTeammateEvents' | 'repeatTeammatePairs'> {
  const engine = state.engine ?? {};
  const benchCounts = Object.values(engine.benchCountMap ?? {});
  const winCounts = Object.values(engine.winCountMap ?? {});
  const benchRange = benchCounts.length ? Math.max(...benchCounts) - Math.min(...benchCounts) : 0;
  const winSpread = winCounts.length ? Math.max(...winCounts) - Math.min(...winCounts) : 0;
  const totalWins = winCounts.reduce((a, b) => a + b, 0);

  const avgGenerateMs = generateMs.length ? generateMs.reduce((a, b) => a + b, 0) / generateMs.length : 0;
  const maxGenerateMs = generateMs.length ? Math.max(...generateMs) : 0;

  return {
    ...base,
    roundsPlayed: engine.roundsPlayed ?? 0,
    avgGenerateMs,
    maxGenerateMs,
    benchRange,
    winSpread,
    totalWins,
  };
}

/** Decode per-player tallies (bench/single/win/loss) from the saved engine state. */
export function decodePlayerStats(
  state: DecodedState,
  base: Pick<UiPlayerStat, 'engine' | 'concurrency' | 'sessionId'>,
  players: SeededPlayer[],
): UiPlayerStat[] {
  const engine = state.engine ?? {};
  const benchMap = engine.benchCountMap ?? {};
  const singleMap = engine.singleCountMap ?? {};
  const winMap = engine.winCountMap ?? {};
  const lossMap = engine.lossCountMap ?? {};

  return players.map(p => {
    const bench = benchMap[p.id] ?? 0;
    const single = singleMap[p.id] ?? 0;
    const win = winMap[p.id] ?? 0;
    const loss = lossMap[p.id] ?? 0;
    return {
      ...base,
      playerId: p.id,
      level: p.level ?? DEFAULT_LEVEL,
      bench,
      single,
      win,
      loss,
      games: win + loss,
    };
  });
}
