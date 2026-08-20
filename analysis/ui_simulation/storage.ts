import { DEFAULT_LEVEL } from '../../src/types';
import { decompress } from '../../src/utils/StorageManager';
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

interface CompactEngineState {
  v?: number;
  pi?: string[];
  ps?: Array<[number, number, number, number]>;
  pc?: Record<string, [number, number]>;
  rp?: number;
}

export interface DecodedState {
  engine?: CompactEngineState;
}

/** Map seeded player display names to their skill level (DOM shows names, not ids). */
export function levelByName(players: SeededPlayer[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const p of players) map[p.name] = p.level;
  return map;
}

/**
 * Decode the saved localStorage value using the app's own codec (gzip+base64,
 * with a plain-JSON fallback baked into `decompress`). Decode once per session
 * and hand the result to both `deriveSessionResult` and `decodePlayerStats`.
 */
export async function decodeState(raw: string): Promise<DecodedState> {
  try {
    return JSON.parse(await decompress(raw));
  } catch {
    return {};
  }
}

/**
 * Derive per-session metrics from the compact engine state the app saved
 * (`ps[i]` = [bench, single, win, loss]). Teammate-repeat counts are supplied
 * separately by the caller from the rounds observed in the DOM, so they are not
 * computed here.
 */
export function deriveSessionResult(
  state: DecodedState,
  base: Pick<SessionResult, 'engine' | 'concurrency' | 'sessionId' | 'players' | 'courts' | 'rounds' | 'totalMs'>,
  generateMs: number[],
): Omit<SessionResult, 'teammatePairs' | 'repeatTeammateEvents' | 'repeatTeammatePairs'> {
  const engine = state.engine ?? {};
  const ps = engine.ps ?? [];

  const benchCounts = ps.map(e => e?.[0] ?? 0);
  const winCounts = ps.map(e => e?.[2] ?? 0);
  const benchRange = benchCounts.length ? Math.max(...benchCounts) - Math.min(...benchCounts) : 0;
  const winSpread = winCounts.length ? Math.max(...winCounts) - Math.min(...winCounts) : 0;
  const totalWins = winCounts.reduce((a, b) => a + b, 0);

  const avgGenerateMs = generateMs.length ? generateMs.reduce((a, b) => a + b, 0) / generateMs.length : 0;
  const maxGenerateMs = generateMs.length ? Math.max(...generateMs) : 0;

  return {
    ...base,
    roundsPlayed: engine.rp ?? 0,
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
  const pi = engine.pi ?? [];
  const ps = engine.ps ?? [];
  const levelById = new Map(players.map(p => [p.id, p.level] as const));

  return pi.map((id, i) => {
    const [bench = 0, single = 0, win = 0, loss = 0] = ps[i] ?? [0, 0, 0, 0];
    return { ...base, playerId: id, level: levelById.get(id) ?? DEFAULT_LEVEL, bench, single, win, loss, games: win + loss };
  });
}
