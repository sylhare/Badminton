import type { Player, Court } from '../App';

interface AppState {
  players: Player[];
  numberOfCourts: number;
  assignments: Court[];
  collapsedSteps: number[];
}

interface CourtEngineState {
  benchCountMap: Record<string, number>;
  teammateCountMap: Record<string, number>;
  opponentCountMap: Record<string, number>;
  winCountMap: Record<string, number>;
  lossCountMap: Record<string, number>;
}

const STORAGE_KEYS = {
  APP_STATE: 'badminton-app-state',
  COURT_ENGINE_STATE: 'badminton-court-engine-state',
} as const;

export const saveAppState = (state: {
  players: Player[];
  numberOfCourts: number;
  assignments: Court[];
  collapsedSteps: Set<number>;
}): void => {
  try {
    const stateToSave: AppState = {
      players: state.players,
      numberOfCourts: state.numberOfCourts,
      assignments: state.assignments,
      collapsedSteps: Array.from(state.collapsedSteps),
    };
    localStorage.setItem(STORAGE_KEYS.APP_STATE, JSON.stringify(stateToSave));
  } catch (error) {
    console.warn('Failed to save app state to localStorage:', error);
  }
};

export const loadAppState = (): Partial<{
  players: Player[];
  numberOfCourts: number;
  assignments: Court[];
  collapsedSteps: Set<number>;
}> => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.APP_STATE);
    if (!saved) return {};

    const parsed: AppState = JSON.parse(saved);
    if (typeof parsed !== 'object' || parsed === null) {
      localStorage.removeItem(STORAGE_KEYS.APP_STATE);
      return {};
    }

    if (parsed.players && !Array.isArray(parsed.players)) {
      localStorage.removeItem(STORAGE_KEYS.APP_STATE);
      return {};
    }

    if (parsed.assignments && !Array.isArray(parsed.assignments)) {
      localStorage.removeItem(STORAGE_KEYS.APP_STATE);
      return {};
    }

    return {
      players: Array.isArray(parsed.players) ? parsed.players : [],
      numberOfCourts: typeof parsed.numberOfCourts === 'number' ? parsed.numberOfCourts : 4,
      assignments: Array.isArray(parsed.assignments) ? parsed.assignments : [],
      collapsedSteps: new Set(Array.isArray(parsed.collapsedSteps) ? parsed.collapsedSteps : []),
    };
  } catch (_error) {
    localStorage.removeItem(STORAGE_KEYS.APP_STATE);
    localStorage.removeItem(STORAGE_KEYS.COURT_ENGINE_STATE);
    return {};
  }
};

export const saveCourtEngineState = (state: {
  benchCountMap: Map<string, number>;
  teammateCountMap: Map<string, number>;
  opponentCountMap: Map<string, number>;
  winCountMap: Map<string, number>;
  lossCountMap: Map<string, number>;
}): void => {
  try {
    const stateToSave: CourtEngineState = {
      benchCountMap: Object.fromEntries(state.benchCountMap),
      teammateCountMap: Object.fromEntries(state.teammateCountMap),
      opponentCountMap: Object.fromEntries(state.opponentCountMap),
      winCountMap: Object.fromEntries(state.winCountMap),
      lossCountMap: Object.fromEntries(state.lossCountMap),
    };
    localStorage.setItem(STORAGE_KEYS.COURT_ENGINE_STATE, JSON.stringify(stateToSave));
  } catch (error) {
    console.warn('Failed to save court engine state to localStorage:', error);
  }
};

export const loadCourtEngineState = (): Partial<CourtEngineState> => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.COURT_ENGINE_STATE);
    if (!saved) return {};

    const parsed: CourtEngineState = JSON.parse(saved);
    if (typeof parsed !== 'object' || parsed === null) {
      localStorage.removeItem(STORAGE_KEYS.COURT_ENGINE_STATE);
      return {};
    }
    return parsed;
  } catch (_error) {
    localStorage.removeItem(STORAGE_KEYS.COURT_ENGINE_STATE);
    return {};
  }
};

export const clearAllStoredState = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEYS.APP_STATE);
    localStorage.removeItem(STORAGE_KEYS.COURT_ENGINE_STATE);
  } catch (error) {
    console.warn('Failed to clear stored state:', error);
  }
};
