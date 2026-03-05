import type { AppState, CourtEngineState, EngineType, StorageData } from '../types';

const OLD_KEYS = {
  APP_STATE: 'badminton-app-state',
  COURT_ENGINE_STATE: 'badminton-court-engine-state',
} as const;

/**
 * Compact v3 engine state stored in localStorage.
 *
 * Player IDs are deduplicated into an index array (`pi`) so that pair keys
 * can use cheap "i:j" integer tokens instead of full UUIDs.
 *
 * Fields:
 *   v   — format version (3)
 *   et  — engine type ('sa' | 'mc' | 'cg' | 'sl')
 *   pi  — player ID index: pi[i] = playerId
 *   ps  — per-player stats, same order as pi: [bench, single, win, loss]
 *   pc  — pair counts keyed "i:j" (i < j): [teammate, opponent]
 *   lh  — level history per pi index (capped at MAX_LEVEL_HISTORY entries)
 */
interface CompactEngineState {
  v: 3;
  et?: EngineType;
  pi: string[];
  ps: Array<[number, number, number, number]>;
  pc: Record<string, [number, number]>;
  lh?: number[][];
}

export async function readAllChunks(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}

async function compress(data: string): Promise<string> {
  const stream = new CompressionStream('gzip');
  const writer = stream.writable.getWriter();
  writer.write(new TextEncoder().encode(data));
  writer.close();
  const result = await readAllChunks(stream.readable.getReader());
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
  return new TextDecoder().decode(await readAllChunks(stream.readable.getReader()));
}

/**
 * Manages persistence of application and engine state using a single
 * gzip-compressed, base64-encoded localStorage entry.
 *
 * Stored JSON structure (after decompression):
 * ```json
 * {
 *   "app": {
 *     "players":        [{ "id": "uuid", "name": "Alice", "isPresent": true, "level": 72 }, ...],
 *     "numberOfCourts": 4,
 *     "assignments":    [...],
 *     "lastGeneratedAt": 1710000000000,
 *     "isSmartEngineEnabled": false,
 *     "archivedPlayers": [{ "id": "uuid", "name": "Bob", "wins": 5, "losses": 3, "benches": 1, "singles": 2, "finalLevel": 65 }]
 *   },
 *   "engine": {
 *     "v":  3,
 *     "et": "sa",
 *     "pi": ["uuid-A", "uuid-B", "uuid-C"],
 *     "ps": [
 *       [bench, single, win, loss],   ←  pi[0] = uuid-A
 *       [bench, single, win, loss],   ←  pi[1] = uuid-B
 *       [bench, single, win, loss]    ←  pi[2] = uuid-C
 *     ],
 *     "pc": {
 *       "0:1": [teammate, opponent],  ←  uuid-A × uuid-B
 *       "0:2": [teammate, opponent],  ←  uuid-A × uuid-C
 *       "1:2": [teammate, opponent]   ←  uuid-B × uuid-C
 *     },
 *     "lh": [
 *       [55, 58, 61],   ←  pi[0] level history (capped at 10)
 *       [50, 49],       ←  pi[1]
 *       []              ←  pi[2] (no history yet)
 *     ]
 *   }
 * }
 * ```
 *
 * All writes are serialised through an internal promise queue so that
 * concurrent `saveApp` / `saveEngine` calls never race on read→modify→write.
 */
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
        archivedPlayers: Array.isArray(app.archivedPlayers) ? app.archivedPlayers : undefined,
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
      if ((raw as CompactEngineState).v === 3) return this.fromCompact(raw as CompactEngineState);
      return raw as CourtEngineState;
    } catch (_error) {
      localStorage.removeItem(StorageManager.KEY);
      return {};
    }
  }

  clearAll(): Promise<void> {
    return this.enqueue(async () => {
      try {
        localStorage.removeItem(StorageManager.KEY);
      } catch (error) {
        console.warn('Failed to clear stored state:', error);
      }
    });
  }

  /** Returns a promise that resolves once all currently enqueued writes complete. */
  waitForQueue(): Promise<void> {
    return this.writeQueue;
  }

  private toCompact(state: CourtEngineState): CompactEngineState {
    const allPlayerIds = new Set([
      ...Object.keys(state.benchCountMap),
      ...Object.keys(state.singleCountMap),
      ...Object.keys(state.winCountMap),
      ...Object.keys(state.lossCountMap),
    ]);
    for (const key of [...Object.keys(state.teammateCountMap), ...Object.keys(state.opponentCountMap)]) {
      const sep = key.indexOf('|');
      if (sep !== -1) { allPlayerIds.add(key.slice(0, sep)); allPlayerIds.add(key.slice(sep + 1)); }
    }

    const pi = [...allPlayerIds];
    const idToIndex = new Map(pi.map((id, i) => [id, i] as [string, number]));

    const ps: Array<[number, number, number, number]> = pi.map(id => [
      state.benchCountMap[id] ?? 0,
      state.singleCountMap[id] ?? 0,
      state.winCountMap[id]   ?? 0,
      state.lossCountMap[id]  ?? 0,
    ]);

    const allPairKeys = new Set([
      ...Object.keys(state.teammateCountMap),
      ...Object.keys(state.opponentCountMap),
    ]);
    const pc: Record<string, [number, number]> = {};
    for (const key of allPairKeys) {
      const sep = key.indexOf('|');
      if (sep === -1) continue;
      const i = idToIndex.get(key.slice(0, sep))!;
      const j = idToIndex.get(key.slice(sep + 1))!;
      const newKey = i < j ? `${i}:${j}` : `${j}:${i}`;
      pc[newKey] = [state.teammateCountMap[key] ?? 0, state.opponentCountMap[key] ?? 0];
    }

    let lh: number[][] | undefined;
    if (state.levelHistory && Object.keys(state.levelHistory).length > 0) {
      lh = pi.map(id => state.levelHistory![id] ?? []);
    }

    return { v: 3, et: state.engineType, pi, ps, pc, lh };
  }

  private fromCompact(c: CompactEngineState): CourtEngineState {
    const pi = c.pi ?? [];
    const benchCountMap: Record<string, number> = {};
    const singleCountMap: Record<string, number> = {};
    const winCountMap: Record<string, number> = {};
    const lossCountMap: Record<string, number> = {};
    const teammateCountMap: Record<string, number> = {};
    const opponentCountMap: Record<string, number> = {};
    const levelHistory: Record<string, number[]> = {};

    const ps = c.ps ?? [];
    for (let i = 0; i < pi.length; i++) {
      const id = pi[i];
      const entry = ps[i];
      if (!entry) continue;
      const [b, s, w, l] = entry;
      if (b) benchCountMap[id]  = b;
      if (s) singleCountMap[id] = s;
      if (w) winCountMap[id]    = w;
      if (l) lossCountMap[id]   = l;
    }

    for (const [key, [t, o]] of Object.entries(c.pc ?? {})) {
      const sep = key.indexOf(':');
      if (sep === -1) continue;
      const i = parseInt(key.slice(0, sep), 10);
      const j = parseInt(key.slice(sep + 1), 10);
      const id1 = pi[i];
      const id2 = pi[j];
      if (!id1 || !id2) continue;
      const pKey = id1 < id2 ? `${id1}|${id2}` : `${id2}|${id1}`;
      if (t) teammateCountMap[pKey] = t;
      if (o) opponentCountMap[pKey] = o;
    }

    const lh = c.lh;
    if (lh) {
      for (let i = 0; i < pi.length; i++) {
        if (lh[i] && lh[i].length > 0) levelHistory[pi[i]] = lh[i];
      }
    }

    return {
      engineType: c.et,
      benchCountMap, singleCountMap,
      teammateCountMap, opponentCountMap,
      winCountMap, lossCountMap,
      levelHistory: Object.keys(levelHistory).length > 0 ? levelHistory : undefined,
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
        await this.write(merged);
        return merged;
      }
      return {};
    }

    try {
      const decompressed = await decompress(raw);
      const parsed = JSON.parse(decompressed);
      if (typeof parsed === 'object' && parsed !== null) return parsed as Partial<StorageData>;
    } catch {  }
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

    if (engine.lh && engine.lh.some(h => h.length > 10)) {
      const pruned = { ...data, engine: { ...engine, lh: engine.lh.map(h => h.slice(-10)) } as unknown as CourtEngineState };
      if (JSON.stringify(pruned).length <= StorageManager.MAX_SIZE) return pruned;
    }

    const noLh = { ...data, engine: { ...engine, lh: [] } as unknown as CourtEngineState };
    if (JSON.stringify(noLh).length <= StorageManager.MAX_SIZE) return noLh;

    const pc = engine.pc ?? {};
    const allKeys = Object.keys(pc);
    if (allKeys.length > 200) {
      const prunedPc: Record<string, [number, number]> = {};
      for (const k of allKeys.slice(0, 200)) prunedPc[k] = pc[k];
      return { ...data, engine: { ...engine, pc: prunedPc } as unknown as CourtEngineState };
    }
    console.warn('StorageManager: pruneToFit could not reduce payload below MAX_SIZE');
    return noLh;
  }
}

export const storageManager = new StorageManager();
