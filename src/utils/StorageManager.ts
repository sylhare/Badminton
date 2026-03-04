import LZString from 'lz-string';

import type { AppState, CourtEngineState, EngineType, StorageData } from '../types';

const OLD_KEYS = {
  APP_STATE: 'badminton-app-state',
  COURT_ENGINE_STATE: 'badminton-court-engine-state',
} as const;

interface CompactEngineState {
  v: 2;
  et?: EngineType;
  ps: Record<string, [number, number, number, number]>;  // [bench, singles, wins, losses]
  pc: Record<string, [number, number]>;                  // [teammate, opponent]
  lh?: Record<string, number[]>;
}

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
      this.write({ ...current, engine: this.toCompact(state) as unknown as CourtEngineState });
    } catch (error) {
      console.warn('Failed to save engine state to localStorage:', error);
    }
  }

  loadEngine(): Partial<CourtEngineState> {
    try {
      const data = this.read();
      const raw = data.engine as unknown as CompactEngineState | CourtEngineState | undefined;
      if (!raw) return {};
      if ((raw as CompactEngineState).v === 2) return this.fromCompact(raw as CompactEngineState);
      return raw as CourtEngineState;
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

  private toCompact(state: CourtEngineState): CompactEngineState {
    const ps: Record<string, [number, number, number, number]> = {};
    const allPlayerIds = new Set([
      ...Object.keys(state.benchCountMap),
      ...Object.keys(state.singleCountMap),
      ...Object.keys(state.winCountMap),
      ...Object.keys(state.lossCountMap),
    ]);
    for (const id of allPlayerIds) {
      ps[id] = [
        state.benchCountMap[id] ?? 0,
        state.singleCountMap[id] ?? 0,
        state.winCountMap[id]   ?? 0,
        state.lossCountMap[id]  ?? 0,
      ];
    }
    const pc: Record<string, [number, number]> = {};
    const allPairKeys = new Set([
      ...Object.keys(state.teammateCountMap),
      ...Object.keys(state.opponentCountMap),
    ]);
    for (const key of allPairKeys) {
      pc[key] = [state.teammateCountMap[key] ?? 0, state.opponentCountMap[key] ?? 0];
    }
    return { v: 2, et: state.engineType, ps, pc, lh: state.levelHistory };
  }

  private fromCompact(c: CompactEngineState): CourtEngineState {
    const benchCountMap: Record<string, number> = {};
    const singleCountMap: Record<string, number> = {};
    const winCountMap: Record<string, number> = {};
    const lossCountMap: Record<string, number> = {};
    const teammateCountMap: Record<string, number> = {};
    const opponentCountMap: Record<string, number> = {};
    for (const [id, [b, s, w, l]] of Object.entries(c.ps ?? {})) {
      if (b) benchCountMap[id]  = b;
      if (s) singleCountMap[id] = s;
      if (w) winCountMap[id]    = w;
      if (l) lossCountMap[id]   = l;
    }
    for (const [key, [t, o]] of Object.entries(c.pc ?? {})) {
      if (t) teammateCountMap[key] = t;
      if (o) opponentCountMap[key] = o;
    }
    return {
      engineType: c.et,
      benchCountMap, singleCountMap,
      teammateCountMap, opponentCountMap,
      winCountMap, lossCountMap,
      levelHistory: c.lh,
    };
  }

  private read(): Partial<StorageData> {
    const raw = localStorage.getItem(StorageManager.KEY);
    if (!raw) {
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

    // Try decompressing first (new format); fall back to raw JSON (old uncompressed format)
    const decompressed = LZString.decompressFromUTF16(raw);
    if (decompressed) {
      try {
        const parsed = JSON.parse(decompressed);
        if (typeof parsed === 'object' && parsed !== null) return parsed as Partial<StorageData>;
      } catch { /* fall through to plain JSON */ }
    }
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    return parsed as Partial<StorageData>;
  }

  private write(data: Partial<StorageData>): void {
    let serialized = JSON.stringify(data);
    if (serialized.length > StorageManager.MAX_SIZE) {
      const pruned = this.pruneToFit(data as StorageData);
      serialized = JSON.stringify(pruned);
    }
    localStorage.setItem(StorageManager.KEY, LZString.compressToUTF16(serialized));
  }

  private pruneToFit(data: StorageData): StorageData {
    const engine = data.engine as unknown as CompactEngineState;
    if (!engine) return data;

    // Step 1: trim level history to last 10 per player
    if (engine.lh && Object.keys(engine.lh).length > 0) {
      const trimmed: Record<string, number[]> = {};
      for (const [id, history] of Object.entries(engine.lh)) {
        trimmed[id] = history.slice(-10);
      }
      const pruned = { ...data, engine: { ...engine, lh: trimmed } as unknown as CourtEngineState };
      if (JSON.stringify(pruned).length <= StorageManager.MAX_SIZE) return pruned;
    }

    // Step 2: clear level history entirely
    const noLh = { ...data, engine: { ...engine, lh: {} } as unknown as CourtEngineState };
    if (JSON.stringify(noLh).length <= StorageManager.MAX_SIZE) return noLh;

    // Step 3: prune pair map to 200 keys
    const pc = engine.pc ?? {};
    const allKeys = Object.keys(pc);
    if (allKeys.length > 200) {
      const keptKeys = new Set(allKeys.slice(0, 200));
      const prunedPc: Record<string, [number, number]> = {};
      for (const k of keptKeys) prunedPc[k] = pc[k];
      return { ...data, engine: { ...engine, pc: prunedPc } as unknown as CourtEngineState };
    }
    return noLh;
  }
}

export const storageManager = new StorageManager();
