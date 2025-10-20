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
  collapsedSteps: number[];
  manualCourt: ManualCourtSelection | null;
}

export interface CourtEngineState {
  benchCountMap: Record<string, number>;
  teammateCountMap: Record<string, number>;
  opponentCountMap: Record<string, number>;
  winCountMap: Record<string, number>;
  lossCountMap: Record<string, number>;
}
