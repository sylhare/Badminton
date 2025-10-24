import type { Player, Court, ManualCourtSelection, AppState, CourtEngineState } from '../types';

const STORAGE_KEYS = {
  APP_STATE: 'badminton-app-state',
  COURT_ENGINE_STATE: 'badminton-court-engine-state',
} as const;

export const saveAppState = (state: {
  players: Player[];
  numberOfCourts: number;
  assignments: Court[];
  collapsedSteps: Set<number>;
  manualCourt: ManualCourtSelection | null;
}): void => {
  try {
    const stateToSave: AppState = {
      players: state.players,
      numberOfCourts: state.numberOfCourts,
      assignments: state.assignments,
      collapsedSteps: Array.from(state.collapsedSteps),
      manualCourt: state.manualCourt,
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
  manualCourt: ManualCourtSelection | null;
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
      manualCourt: parsed.manualCourt || null,
    };
  } catch (error) {
    console.warn('Failed to load app state from localStorage:', error);
    localStorage.removeItem(STORAGE_KEYS.APP_STATE);
    localStorage.removeItem(STORAGE_KEYS.COURT_ENGINE_STATE);
    return {};
  }
};

export const saveCourtEngineState = (state: CourtEngineState): void => {
  try {
    const stateToSave: CourtEngineState = {
      benchCountMap: state.benchCountMap,
      teammateCountMap: state.teammateCountMap,
      opponentCountMap: state.opponentCountMap,
      winCountMap: state.winCountMap,
      lossCountMap: state.lossCountMap,
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
