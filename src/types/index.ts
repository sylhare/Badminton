export interface Player {
  id: string;
  name: string;
  isPresent: boolean;
  gender?: 'M' | 'F' | 'Unknown';
  level?: number;
  averageScore?: number;
  scoredGames?: number;
}

/** Neutral fallback skill level (0–100) for a player whose level is unknown. */
export const DEFAULT_LEVEL = 50;

/** Points scored by each side within a single set. */
export interface SetScore {
  team1: number;
  team2: number;
}

/** Points a side plays to in a single set unless a tournament configures otherwise. */
export const DEFAULT_SET_SIZE = 21;

/** Join players' names into a team label ("Alice & Bob"). */
export function formatPlayerNames(players: Player[]): string {
  return players.map(p => p.name).join(' & ');
}

export interface Court {
  courtNumber: number;
  players: Player[];
  teams?: {
    team1: Player[];
    team2: Player[];
  };
  winner?: 1 | 2;
  /** One entry per set played; empty while undecided or won without a score. A casual game is a best-of-1. */
  sets?: SetScore[];
}

export type TeamNumber = 1 | 2;
export type WinnerSelection = TeamNumber | undefined;
export type EngineType = 'sa' | 'sl';

/** A decided game the level tracker should replay: the court result plus its Elo weighting. */
export interface ScoredGame {
  court: Court;
  /** Multiplier applied to this game's rating change (default 1 — see ELO_DEFAULT_IMPORTANCE). */
  importance?: number;
  /** Points a side played to in a set; scores are normalised to the reference length. Defaults to 21. */
  setSize?: number;
}

export interface AppState {
  players: Player[];
  numberOfCourts: number;
  assignments: Court[];
  lastGeneratedAt?: number;
  isSmartEngineEnabled?: boolean;
  savedAt?: number;
  sessionId?: string;
}

/**
 * Read-only view of engine state for rendering. Structurally the counts the
 * stats view needs, with no persistence-only concerns (engine type, savedAt).
 */
export interface EngineSnapshot {
  benchCountMap: Record<string, number>;
  singleCountMap: Record<string, number>;
  teammateCountMap: Record<string, number>;
  opponentCountMap: Record<string, number>;
  winCountMap: Record<string, number>;
  lossCountMap: Record<string, number>;
  levelHistory?: Record<string, number[]>;
  roundsPlayed?: number;
}

/** Engine state as persisted to storage: a snapshot plus persistence metadata. */
export interface CourtEngineState extends EngineSnapshot {
  engineType?: EngineType;
  savedAt?: number;
}

export interface UpdateWinnerParams {
  courtNumber: number;
  winner: 1 | 2 | undefined;
  currentAssignments: Court[];
  rotatedCourt?: Court;
}

export interface AssignmentAnomaly {
  type: 'consecutive_bench' | 'consecutive_singles' | 'consecutive_teammates';
  playerIds: string[];
}

export interface GenerateResult {
  courts: Court[];
  committed: boolean;
  anomalies: AssignmentAnomaly[];
}

export interface ICourtAssignmentTracker {
  onStateChange(listener: () => void): () => void;
  resetHistory(): void;
  removePlayerHistory(playerId: string): void;
  clearCurrentSession(): void;
  applyRoundStats(courts: Court[], players: Player[]): AssignmentAnomaly[];
  snapshot(): EngineSnapshot;
  prepareStateForSaving(engineType: EngineType): CourtEngineState;
  saveState(engineType: EngineType): Promise<void>;
  loadState(engineType: EngineType): Promise<void>;
  recordLevelSnapshot(players: Player[]): void;
  updateWinner(params: UpdateWinnerParams): Court[];
  applyManualEdit(previous: Court[], next: Court[], players: Player[]): Court[];
  levelTrend(playerId: string): 'up' | 'down' | null;
}

export interface ICourtAssignmentEngine extends ICourtAssignmentTracker {
  generate(players: Player[], numberOfCourts: number, forceBenchPlayerIds?: Set<string>): GenerateResult;
  readonly name: string;
  readonly description: string;
}

