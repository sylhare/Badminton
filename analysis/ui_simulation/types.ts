/** Types for the UI (Playwright-driven) load-test harness. */

export type UiEngine = 'sa' | 'sl';

/** The `ui` block of analysis/data/config.json. */
export interface UiConfig {
  engines: UiEngine[];
  concurrency: number[];
  runs: number;
  rounds: number;
  playerCount: number;
  sampleIntervalMs: number;
  headless: boolean;
  /** If > 0, each concurrency cell runs for this long (equal-time load) instead of a fixed `runs`. */
  durationSec?: number;
}

/** Shape of analysis/data/config.json as consumed by the UI harness. */
export interface RawConfigFile {
  ui?: Partial<UiConfig>;
  numCourts?: number;
  playerProfiles?: Record<string, { level: number }>;
}

/** One decided court, captured through the UI, with realistic (strength-based) outcome. */
export interface UiMatchEvent {
  engine: UiEngine;
  concurrency: number;
  sessionId: number;
  round: number;
  courtIndex: number;
  /** Pipe-joined player names on each team, so teammate repeats can be counted from observed play. */
  team1: string;
  team2: string;
  team1Level: number;
  team2Level: number;
  strengthDiff: number;
  winner: 1 | 2;
  strongerTeamWon: boolean;
}

/** Per-player tallies decoded from the app's saved engine state after a session. */
export interface UiPlayerStat {
  engine: UiEngine;
  concurrency: number;
  sessionId: number;
  playerId: string;
  level: number;
  bench: number;
  single: number;
  win: number;
  loss: number;
  games: number;
}

/** One generate/regenerate call driven through the UI. */
export interface GenerateEvent {
  engine: UiEngine;
  concurrency: number;
  sessionId: number;
  round: number;
  latencyMs: number;
}

/** Per-session summary, derived from the app state saved to localStorage. */
export interface SessionResult {
  engine: UiEngine;
  concurrency: number;
  sessionId: number;
  players: number;
  courts: number;
  rounds: number;
  roundsPlayed: number;
  totalMs: number;
  avgGenerateMs: number;
  maxGenerateMs: number;
  /** Distinct teammate pairs formed. */
  teammatePairs: number;
  /** Extra times a pair was teamed beyond the first, summed across pairs. */
  repeatTeammateEvents: number;
  /** Pairs teamed together more than once. */
  repeatTeammatePairs: number;
  /** max(bench) - min(bench) across players — bench fairness. */
  benchRange: number;
  /** max(wins) - min(wins) across players — win spread. */
  winSpread: number;
  totalWins: number;
}

/** A single CPU/RAM sample of the browser process subtree during a run. */
export interface ResourceSample {
  engine: UiEngine;
  concurrency: number;
  tMs: number;
  cpuPct: number;
  rssMB: number;
  procCount: number;
}

/** Aggregated metrics for one (engine, concurrency) cell. */
export interface ConcurrencySummary {
  engine: UiEngine;
  concurrency: number;
  sessions: number;
  wallMs: number;
  sessionsPerSec: number;
  roundsPerSec: number;
  p50GenerateMs: number;
  p95GenerateMs: number;
  meanGenerateMs: number;
  peakCpuPct: number;
  meanCpuPct: number;
  peakRssMB: number;
  meanRssMB: number;
}
