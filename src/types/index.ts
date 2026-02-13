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

export interface AppState {
  players: Player[];
  numberOfCourts: number;
  assignments: Court[];
  isManagePlayersCollapsed: boolean;
  manualCourt: ManualCourtSelection | null;
  /** @deprecated Use isManagePlayersCollapsed instead */
  collapsedSteps?: number[];
}

export interface CourtEngineState {
  benchCountMap: Record<string, number>;
  singleCountMap: Record<string, number>;
  teammateCountMap: Record<string, number>;
  opponentCountMap: Record<string, number>;
  winCountMap: Record<string, number>;
  lossCountMap: Record<string, number>;
}

export interface ICourtAssignmentTracker {
  onStateChange(listener: () => void): () => void;
  resetHistory(): void;
  clearCurrentSession(): void;
  prepareStateForSaving(): CourtEngineState;
  saveState(): void;
  loadState(): void;
  recordWins(courts: Court[]): void;
  getWinCounts(): Map<string, number>;
  getBenchCounts(): Map<string, number>;
  updateWinner(courtNumber: number, winner: 1 | 2 | undefined, currentAssignments: Court[]): Court[];
  reverseWinForCourt(courtNumber: number): void;
  getBenchedPlayers(assignments: Court[], players: Player[]): Player[];
}

export interface ICourtAssignmentEngine extends ICourtAssignmentTracker {
  generate(players: Player[], numberOfCourts: number, manualSelection?: ManualCourtSelection): Court[];
}
