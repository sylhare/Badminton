import type { AppState, CourtEngineState, EngineType } from '../types';
import { DEFAULT_TOURNAMENT_STATE } from '../types/tournament';
import type { TournamentState } from '../types/tournament';

interface StorageData {
  app: AppState;
  engine: CourtEngineState;
  tournament?: TournamentState;
}

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

export async function decompress(data: string): Promise<string> {
  try {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const stream = new DecompressionStream('gzip');
    const writer = stream.writable.getWriter();
    writer.write(bytes);
    writer.close();
    return new TextDecoder().decode(await readAllChunks(stream.readable.getReader()));
  } catch {
    return data;
  }
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
 *     "isSmartEngineEnabled": false
 *   },
 *   "tournament": {
 *     "phase": "active",
 *     "format": "singles",
 *     "type": "round-robin",
 *     "numberOfCourts": 2,
 *     "teams": [...],
 *     "matches": [...]
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
/** Maximum number of level-history snapshots stored per player. */
export const MAX_LEVEL_HISTORY_ENTRIES = 50;

class StorageManager {
  private static readonly KEY = 'badminton-state';
  private static readonly MAX_SIZE = 150_000;

  /** Serialises all writes so concurrent save calls never race on read→write. */
  private writeQueue: Promise<void> = Promise.resolve();

  private enqueue(task: () => Promise<void>): Promise<void> {
    this.writeQueue = this.writeQueue.then(
      () => task().catch(error => console.warn('StorageManager: write failed:', error)),
    );
    return this.writeQueue;
  }

  private save(transform: (current: Partial<StorageData>) => Partial<StorageData>): Promise<void> {
    return this.enqueue(async () => {
      const current = await this.read();
      await this.write(transform(current));
    });
  }

  async saveApp(state: Partial<AppState>): Promise<void> {
    return this.save(
      current => ({ ...current, app: { ...(current.app ?? {}), ...state, savedAt: Date.now(), sessionId: (current.app as AppState)?.sessionId ?? crypto.randomUUID() } as AppState }),
    );
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
        savedAt: typeof app.savedAt === 'number' ? app.savedAt : undefined,
        sessionId: typeof app.sessionId === 'string' ? app.sessionId : undefined,
      };
    } catch (error) {
      console.warn('Failed to load app state from localStorage:', error);
      localStorage.removeItem(StorageManager.KEY);
      return {};
    }
  }

  async saveEngine(state: CourtEngineState): Promise<void> {
    const compact = this.toCompact(state);
    return this.save(
      current => ({ ...current, engine: compact as unknown as CourtEngineState }),
    );
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

  async saveTournament(state: TournamentState | null): Promise<void> {
    return this.save(current => {
      const next = { ...current };
      if (state === null) {
        delete next.tournament;
      } else {
        next.tournament = state;
      }
      return next;
    });
  }

  async loadTournament(): Promise<TournamentState | null> {
    try {
      const data = await this.read();
      if (!data.tournament) return null;
      return { ...DEFAULT_TOURNAMENT_STATE, ...data.tournament };
    } catch {
      return null;
    }
  }

  clearAll(): Promise<void> {
    return this.enqueue(async () => {
      localStorage.removeItem(StorageManager.KEY);
    });
  }

  /** Returns a promise that resolves once all currently enqueued writes complete. */
  waitForQueue(): Promise<void> {
    return this.writeQueue;
  }

  /** Returns the raw compressed+base64 localStorage value, or null if empty. */
  getRawState(): string | null {
    return localStorage.getItem(StorageManager.KEY);
  }

  /** Writes raw compressed state directly. Used for import — keeps all localStorage access inside StorageManager. */
  importRawState(raw: string): void {
    localStorage.setItem(StorageManager.KEY, raw);
  }

  /** Returns true if the raw string is a valid compressed state with players array. */
  async isValidState(raw: string): Promise<boolean> {
    const parsed = await this.decompressJson(raw);
    return Array.isArray(parsed?.app?.players);
  }

  /**
   * Returns savedAt timestamps for the import modal.
   * Returns undefined for both if both raw states share the same sessionId
   * (i.e. the user is sharing their own session back to themselves).
   */
  async getImportTimestamps(
    sharedRaw: string,
    currentRaw: string | null,
  ): Promise<{ sharedSavedAt?: number; currentSavedAt?: number }> {
    const [shared, current] = await Promise.all([
      this.decompressJson(sharedRaw),
      currentRaw ? this.decompressJson(currentRaw) : Promise.resolve(null),
    ]);

    const sharedSessionId = shared?.app?.sessionId;
    const currentSessionId = current?.app?.sessionId;
    if (sharedSessionId && currentSessionId && sharedSessionId === currentSessionId) {
      return {};
    }

    const sharedSavedAt = typeof shared?.app?.savedAt === 'number' ? shared.app.savedAt : undefined;
    const currentSavedAt = typeof current?.app?.savedAt === 'number' ? current.app.savedAt : undefined;
    return { sharedSavedAt, currentSavedAt };
  }

  /** Decompresses and JSON-parses a raw compressed state string. Returns null on failure. */
  private async decompressJson(raw: string): Promise<Partial<StorageData> | null> {
    try {
      const parsed = JSON.parse(await decompress(raw));
      return typeof parsed === 'object' && parsed !== null ? parsed as Partial<StorageData> : null;
    } catch {
      return null;
    }
  }

  private toCompact(state: CourtEngineState): CompactEngineState {
    const allPlayerIds = new Set([
      ...Object.keys(state.benchCountMap),
      ...Object.keys(state.singleCountMap),
      ...Object.keys(state.winCountMap),
      ...Object.keys(state.lossCountMap),
    ]);

    const pairKeys = [...new Set([...Object.keys(state.teammateCountMap), ...Object.keys(state.opponentCountMap)])];
    for (const key of pairKeys) {
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

    const pc: Record<string, [number, number]> = {};
    for (const key of pairKeys) {
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
    const raw = this.getRawState();
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

    const data = await this.decompressJson(raw);
    if (data === null) {
      localStorage.removeItem(StorageManager.KEY);
      return {};
    }
    return data;
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

    const rebuild = (e: CompactEngineState): StorageData => ({ ...data, engine: e as unknown as CourtEngineState });
    const fits = (d: StorageData) => JSON.stringify(d).length <= StorageManager.MAX_SIZE;

    if (engine.lh?.some(h => h.length > MAX_LEVEL_HISTORY_ENTRIES)) {
      const pruned = rebuild({ ...engine, lh: engine.lh!.map(h => h.slice(-MAX_LEVEL_HISTORY_ENTRIES)) });
      if (fits(pruned)) return pruned;
    }

    const noLh = rebuild({ ...engine, lh: [] });
    if (fits(noLh)) return noLh;

    const allKeys = Object.keys(engine.pc ?? {});
    if (allKeys.length > 200) {
      return rebuild({ ...engine, pc: Object.fromEntries(allKeys.slice(0, 200).map(k => [k, engine.pc[k]])) });
    }

    console.warn('StorageManager: pruneToFit could not reduce payload below MAX_SIZE');
    return noLh;
  }
}

export const storageManager = new StorageManager();
