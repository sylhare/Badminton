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

async function compress(data: string): Promise<string> {
  const stream = new CompressionStream('gzip');
  const writer = stream.writable.getWriter();
  writer.write(new TextEncoder().encode(data));
  writer.close();
  const chunks: Uint8Array[] = [];
  const reader = stream.readable.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  let binary = '';
  for (let i = 0; i < result.length; i++) binary += String.fromCharCode(result[i]);
  return btoa(binary);
}

async function decompress(data: string): Promise<string> {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const stream = new DecompressionStream('gzip');
  const writer = stream.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const chunks: Uint8Array[] = [];
  const reader = stream.readable.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder().decode(result);
}

class StorageManager {
  private static readonly KEY = 'badminton-state';
  private static readonly MAX_SIZE = 150_000;

  /** Serialises all writes so concurrent save calls never race on read→write. */
  private writeQueue: Promise<void> = Promise.resolve();

  private enqueue(task: () => Promise<void>): Promise<void> {
    this.writeQueue = this.writeQueue.then(task, task);
    return this.writeQueue;
  }

  async saveApp(state: Partial<AppState>): Promise<void> {
    return this.enqueue(async () => {
      try {
        const current = await this.read();
        await this.write({ ...current, app: { ...(current.app ?? {}), ...state } as AppState });
      } catch (error) {
        console.warn('Failed to save app state to localStorage:', error);
      }
    });
  }

  async loadApp(): Promise<Partial<AppState>> {
    try {
      const data = await this.read();
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

  async saveEngine(state: CourtEngineState): Promise<void> {
    return this.enqueue(async () => {
      try {
        const current = await this.read();
        await this.write({ ...current, engine: this.toCompact(state) as unknown as CourtEngineState });
      } catch (error) {
        console.warn('Failed to save engine state to localStorage:', error);
      }
    });
  }

  async loadEngine(): Promise<Partial<CourtEngineState>> {
    try {
      const data = await this.read();
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

  private async read(): Promise<Partial<StorageData>> {
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
    try {
      const decompressed = await decompress(raw);
      const parsed = JSON.parse(decompressed);
      if (typeof parsed === 'object' && parsed !== null) return parsed as Partial<StorageData>;
    } catch { /* fall through to plain JSON for old uncompressed data */ }
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    return parsed as Partial<StorageData>;
  }

  private async write(data: Partial<StorageData>): Promise<void> {
    let serialized = JSON.stringify(data);
    if (serialized.length > StorageManager.MAX_SIZE) {
      const pruned = this.pruneToFit(data as StorageData);
      serialized = JSON.stringify(pruned);
    }
    localStorage.setItem(StorageManager.KEY, await compress(serialized));
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
