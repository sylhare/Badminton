export interface Player {
  id: string;
  name: string;
  isPresent: boolean;
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
}

export type TeamNumber = 1 | 2;
export type WinnerSelection = TeamNumber | undefined;
export type EngineType = 'sa' | 'mc' | 'cg';

export interface AppState {
  players: Player[];
  numberOfCourts: number;
  assignments: Court[];
  isManagePlayersCollapsed: boolean;
  manualCourt: ManualCourtSelection | null;
}

export interface CourtEngineState {
  engineType?: EngineType;
  benchCountMap: Record<string, number>;
  singleCountMap: Record<string, number>;
  teammateCountMap: Record<string, number>;
  opponentCountMap: Record<string, number>;
  winCountMap: Record<string, number>;
  lossCountMap: Record<string, number>;
}

export interface TrackerStats {
  winCountMap: Map<string, number>;
  lossCountMap: Map<string, number>;
  teammateCountMap: Map<string, number>;
  opponentCountMap: Map<string, number>;
  benchCountMap: Map<string, number>;
  singleCountMap: Map<string, number>;
}

export interface ICourtAssignmentTracker {
  onStateChange(listener: () => void): () => void;
  resetHistory(): void;
  clearCurrentSession(): void;
  prepareStateForSaving(engineType: EngineType): CourtEngineState;
  saveState(engineType: EngineType): void;
  loadState(engineType: EngineType): void;
  recordWins(courts: Court[]): void;
  getWinCounts(): Map<string, number>;
  getBenchCounts(): Map<string, number>;
  updateWinner(courtNumber: number, winner: 1 | 2 | undefined, currentAssignments: Court[]): Court[];
  reverseWinForCourt(courtNumber: number): void;
  getBenchedPlayers(assignments: Court[], players: Player[]): Player[];
  getStats(): TrackerStats;
}

export interface ICourtAssignmentEngine extends ICourtAssignmentTracker {
  generate(players: Player[], numberOfCourts: number, manualSelection?: ManualCourtSelection, forceBenchPlayerIds?: Set<string>): Court[];
  getName(): string;
  getDescription(): string;
}
