import type { AppState, CourtEngineState, StorageData } from '../types';

const OLD_KEYS = {
  APP_STATE: 'badminton-app-state',
  COURT_ENGINE_STATE: 'badminton-court-engine-state',
} as const;

class StorageManager {
  private static readonly KEY = 'badminton-state';
  private static readonly MAX_SIZE = 150_000;

  saveApp(state: Partial<AppState>): void {
    try {
      const current = this.read();
      this.write({ ...current, app: { ...(current.app ?? {}), ...state } as AppState });
    } catch (error) {
      console.warn('Failed to save app state to localStorage:', error);
    }
  }

  loadApp(): Partial<AppState> {
    try {
      const data = this.read();
      const app = data.app;
      if (!app) return {};

      if (app.players && !Array.isArray(app.players)) return {};
      if (app.assignments && !Array.isArray(app.assignments)) return {};

      return {
        players: Array.isArray(app.players) ? app.players : [],
        numberOfCourts: typeof app.numberOfCourts === 'number' ? app.numberOfCourts : 4,
        assignments: Array.isArray(app.assignments) ? app.assignments : [],
        lastGeneratedAt: typeof app.lastGeneratedAt === 'number' ? app.lastGeneratedAt : undefined,
        isSmartEngineEnabled: typeof app.isSmartEngineEnabled === 'boolean' ? app.isSmartEngineEnabled : undefined,
      };
    } catch (error) {
      console.warn('Failed to load app state from localStorage:', error);
      localStorage.removeItem(StorageManager.KEY);
      return {};
    }
  }

  saveEngine(state: CourtEngineState): void {
    try {
      const current = this.read();
      this.write({ ...current, engine: state } as StorageData);
    } catch (error) {
      console.warn('Failed to save engine state to localStorage:', error);
    }
  }

  loadEngine(): Partial<CourtEngineState> {
    try {
      const data = this.read();
      return data.engine ?? {};
    } catch (_error) {
      localStorage.removeItem(StorageManager.KEY);
      return {};
    }
  }

  clearAll(): void {
    try {
      localStorage.removeItem(StorageManager.KEY);
    } catch (error) {
      console.warn('Failed to clear stored state:', error);
    }
  }

  private read(): Partial<StorageData> {
    const newRaw = localStorage.getItem(StorageManager.KEY);
    if (!newRaw) {
      const oldApp = localStorage.getItem(OLD_KEYS.APP_STATE);
      const oldEngine = localStorage.getItem(OLD_KEYS.COURT_ENGINE_STATE);
      if (oldApp || oldEngine) {
        const merged: Partial<StorageData> = {};
        if (oldApp) {
          try { merged.app = JSON.parse(oldApp); } catch {  }
        }
        if (oldEngine) {
          try { merged.engine = JSON.parse(oldEngine); } catch {  }
        }
        localStorage.removeItem(OLD_KEYS.APP_STATE);
        localStorage.removeItem(OLD_KEYS.COURT_ENGINE_STATE);
        return merged;
      }
      return {};
    }

    const parsed = JSON.parse(newRaw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    return parsed as Partial<StorageData>;
  }

  private write(data: Partial<StorageData>): void {
    let serialized = JSON.stringify(data);
    if (serialized.length > StorageManager.MAX_SIZE) {
      const pruned = this.pruneToFit(data as StorageData);
      serialized = JSON.stringify(pruned);
    }
    localStorage.setItem(StorageManager.KEY, serialized);
  }

  private pruneToFit(data: StorageData): StorageData {
    if (data.engine?.levelHistory) {
      const trimmed: Record<string, number[]> = {};
      for (const [id, history] of Object.entries(data.engine.levelHistory)) {
        trimmed[id] = history.slice(-10);
      }
      data = { ...data, engine: { ...data.engine, levelHistory: trimmed } };
      if (JSON.stringify(data).length <= StorageManager.MAX_SIZE) return data;
    }

    if (data.engine) {
      data = { ...data, engine: { ...data.engine, levelHistory: {} } };
      if (JSON.stringify(data).length <= StorageManager.MAX_SIZE) return data;
    }

    if (data.engine) {
      const teammate = data.engine.teammateCountMap ?? {};
      const opponent = data.engine.opponentCountMap ?? {};
      const allKeys = [...new Set([...Object.keys(teammate), ...Object.keys(opponent)])];
      if (allKeys.length > 200) {
        const kept = allKeys.slice(0, 200);
        const keptSet = new Set(kept);
        const prunedTeammate: Record<string, number> = {};
        const prunedOpponent: Record<string, number> = {};
        for (const k of keptSet) {
          if (teammate[k] !== undefined) prunedTeammate[k] = teammate[k];
          if (opponent[k] !== undefined) prunedOpponent[k] = opponent[k];
        }
        data = {
          ...data,
          engine: { ...data.engine, teammateCountMap: prunedTeammate, opponentCountMap: prunedOpponent },
        };
      }
    }

    return data;
  }
}

export const storageManager = new StorageManager();
