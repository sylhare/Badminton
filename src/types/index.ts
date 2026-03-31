import type React from 'react';

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
  savedAt?: number;
  sessionId?: string;
}

export interface CourtEngineState {
  engineType?: EngineType;
  savedAt?: number;
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
  applyRoundStats(courts: Court[], players: Player[]): void;
  prepareStateForSaving(engineType: EngineType): CourtEngineState;
  saveState(engineType: EngineType): Promise<void>;
  loadState(engineType: EngineType): Promise<void>;
  recordLevelSnapshot(players: Player[]): void;
  getWinCounts(): Map<string, number>;
  getBenchCounts(): Map<string, number>;
  updateWinner(params: UpdateWinnerParams): Court[];
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

export interface AppStateContextType {
  players: Player[];
  isLoaded: boolean;
  handlePlayerToggle: (id: string) => void;
  handleAddPlayers: (names: string[]) => void;
  handleRemovePlayer: (id: string) => void;
  handleUpdatePlayer: (id: string, gender: Player['gender'], level: number) => void;
  clearPlayers: () => void;
  setPlayers: React.Dispatch<React.SetStateAction<Player[]>>;
  isSmartEngineEnabled: boolean;
  handleToggleSmartEngine: () => void;
  applyCourtResults: (courts: Court[]) => void;
  winCounts: Map<string, number>;
  lossCounts: Map<string, number>;
}
