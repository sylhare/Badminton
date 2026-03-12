export interface Player {
  id: string;
  name: string;
  isPresent: boolean;
  gender?: 'M' | 'F' | 'Unknown';
  level?: number;
  averageScore?: number;
  scoredGames?: number;
}

export interface ManualCourtSelection {
  players: Player[];
}

export interface Court {
  courtNumber: number;
  players: Player[];
  teams?: {
    team1: Player[];
    team2: Player[];
  };
  winner?: 1 | 2;
  wasManuallyAssigned?: boolean;
  score?: { team1: number; team2: number };
}

export type TeamNumber = 1 | 2;
export type WinnerSelection = TeamNumber | undefined;
export type EngineType = 'sa' | 'sl';

export interface AppState {
  players: Player[];
  numberOfCourts: number;
  assignments: Court[];
  lastGeneratedAt?: number;
  isSmartEngineEnabled?: boolean;
}

export interface CourtEngineState {
  engineType?: EngineType;
  benchCountMap: Record<string, number>;
  singleCountMap: Record<string, number>;
  teammateCountMap: Record<string, number>;
  opponentCountMap: Record<string, number>;
  winCountMap: Record<string, number>;
  lossCountMap: Record<string, number>;
  levelHistory?: Record<string, number[]>;
}

export interface TrackerStats {
  winCountMap: Map<string, number>;
  lossCountMap: Map<string, number>;
  teammateCountMap: Map<string, number>;
  opponentCountMap: Map<string, number>;
  benchCountMap: Map<string, number>;
  singleCountMap: Map<string, number>;
}

export interface UpdateWinnerParams {
  courtNumber: number;
  winner: 1 | 2 | undefined;
  currentAssignments: Court[];
  rotatedCourt?: Court;
}

export interface ICourtAssignmentTracker {
  onStateChange(listener: () => void): () => void;
  resetHistory(): void;
  removePlayerHistory(playerId: string): void;
  clearCurrentSession(): void;
  prepareStateForSaving(engineType: EngineType): CourtEngineState;
  saveState(engineType: EngineType): Promise<void>;
  loadState(engineType: EngineType): Promise<void>;
  recordWins(courts: Court[]): void;
  recordLevelSnapshot(players: Player[]): void;
  getWinCounts(): Map<string, number>;
  getBenchCounts(): Map<string, number>;
  updateWinner(params: UpdateWinnerParams): Court[];
  updateCourtTeamStats(court: Court, previousCourt?: Court): void;
  getBenchedPlayers(assignments: Court[], players: Player[]): Player[];
  getStats(): TrackerStats;
  getLevelTrend(playerId: string): 'up' | 'down' | null;
}

export interface ICourtAssignmentEngine extends ICourtAssignmentTracker {
  generate(players: Player[], numberOfCourts: number, manualSelection?: ManualCourtSelection, forceBenchPlayerIds?: Set<string>): Court[];
  getName(): string;
  getDescription(): string;
  supportsScoreTracking(): boolean;
}
