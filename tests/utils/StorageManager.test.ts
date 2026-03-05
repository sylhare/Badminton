import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { storageManager } from '../../src/utils/StorageManager';
import type { ArchivedPlayer, Court, CourtEngineState, Player } from '../../src/types';

const STORAGE_KEY = 'badminton-state';
const OLD_APP_KEY = 'badminton-app-state';
const OLD_ENGINE_KEY = 'badminton-court-engine-state';

async function readAllChunks(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<Uint8Array> {
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

async function readDecompressed(): Promise<unknown> {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const binary = atob(raw);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const stream = new DecompressionStream('gzip');
    const writer = stream.writable.getWriter();
    writer.write(bytes);
    writer.close();
    const result = await readAllChunks(stream.readable.getReader());
    return JSON.parse(new TextDecoder().decode(result));
  } catch {
    return JSON.parse(raw);
  }
}

describe('StorageManager', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  describe('saveApp and loadApp', () => {
    const mockPlayers: Player[] = [
      { id: 'player-1', name: 'Alice', isPresent: true },
      { id: 'player-2', name: 'Bob', isPresent: false },
    ];

    const mockAssignments: Court[] = [
      {
        courtNumber: 1,
        players: [mockPlayers[0], mockPlayers[1]],
        teams: {
          team1: [mockPlayers[0]],
          team2: [mockPlayers[1]],
        },
        winner: 1,
      },
    ];

    const mockAppState = {
      players: mockPlayers,
      numberOfCourts: 6,
      assignments: mockAssignments,
    };

    it('should save app state under single key', async () => {
      await storageManager.saveApp(mockAppState);

      const savedData = localStorage.getItem(STORAGE_KEY);
      expect(savedData).toBeTruthy();

      const parsed = await readDecompressed() as { app: { players: Player[]; numberOfCourts: number; assignments: Court[] } };
      expect(parsed.app.players).toEqual(mockPlayers);
      expect(parsed.app.numberOfCourts).toBe(6);
      expect(parsed.app.assignments).toEqual(mockAssignments);
    });

    it('should load app state', async () => {
      await storageManager.saveApp(mockAppState);

      const loaded = await storageManager.loadApp();

      expect(loaded.players).toEqual(mockPlayers);
      expect(loaded.numberOfCourts).toBe(6);
      expect(loaded.assignments).toEqual(mockAssignments);
    });

    it('should return empty object when no saved state exists', async () => {
      const loaded = await storageManager.loadApp();
      expect(loaded).toEqual({});
    });

    it('should handle corrupted localStorage data gracefully', async () => {
      localStorage.setItem(STORAGE_KEY, 'invalid-json');

      const loaded = await storageManager.loadApp();
      expect(loaded).toEqual({});
    });

    it('should handle localStorage save errors gracefully', async () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      await expect(storageManager.saveApp(mockAppState)).resolves.not.toThrow();
    });

    it('should persist and restore archivedPlayers', async () => {
      const archived: ArchivedPlayer[] = [
        { id: 'old-player-1', name: 'OldAlice', wins: 5, losses: 3, benches: 1, singles: 2, finalLevel: 65 },
      ];
      await storageManager.saveApp({ ...mockAppState, archivedPlayers: archived });

      const loaded = await storageManager.loadApp();
      expect(loaded.archivedPlayers).toEqual(archived);
    });

    it('should return undefined archivedPlayers when none are saved', async () => {
      await storageManager.saveApp(mockAppState);
      const loaded = await storageManager.loadApp();
      expect(loaded.archivedPlayers).toBeUndefined();
    });
  });

  describe('saveEngine and loadEngine', () => {
    const mockEngineState = {
      benchCountMap: { 'player-1': 2, 'player-2': 1 },
      singleCountMap: {},
      teammateCountMap: { 'player-1|player-2': 3 },
      opponentCountMap: { 'player-1|player-3': 2 },
      winCountMap: { 'player-1': 5, 'player-2': 3 },
      lossCountMap: { 'player-1': 2, 'player-2': 4 },
    };

    it('should save engine state in v3 compact format under single key', async () => {
      await storageManager.saveEngine(mockEngineState);

      const savedData = localStorage.getItem(STORAGE_KEY);
      expect(savedData).toBeTruthy();

      const parsed = await readDecompressed() as {
        engine: {
          v: number;
          pi: string[];
          ps: Array<number[]>;
          pc: Record<string, number[]>;
        }
      };
      expect(parsed.engine.v).toBe(3);

      // pi contains all player IDs
      expect(parsed.engine.pi).toContain('player-1');
      expect(parsed.engine.pi).toContain('player-2');

      // ps stats are indexed by pi
      const idx1 = parsed.engine.pi.indexOf('player-1');
      const idx2 = parsed.engine.pi.indexOf('player-2');
      expect(parsed.engine.ps[idx1]).toEqual([2, 0, 5, 2]);
      expect(parsed.engine.ps[idx2]).toEqual([1, 0, 3, 4]);

      // pc uses integer index keys "i:j"
      const pairKeyP1P2 = idx1 < idx2 ? `${idx1}:${idx2}` : `${idx2}:${idx1}`;
      expect(parsed.engine.pc[pairKeyP1P2]).toEqual([3, 0]);
    });

    it('should load engine state', async () => {
      await storageManager.saveEngine(mockEngineState);

      const loaded = await storageManager.loadEngine();

      expect(loaded.benchCountMap).toEqual({ 'player-1': 2, 'player-2': 1 });
      expect(loaded.teammateCountMap).toEqual({ 'player-1|player-2': 3 });
      expect(loaded.opponentCountMap).toEqual({ 'player-1|player-3': 2 });
      expect(loaded.winCountMap).toEqual({ 'player-1': 5, 'player-2': 3 });
      expect(loaded.lossCountMap).toEqual({ 'player-1': 2, 'player-2': 4 });
    });

    it('should return empty object when no saved engine state exists', async () => {
      const loaded = await storageManager.loadEngine();
      expect(loaded).toEqual({});
    });

    it('should handle localStorage save errors gracefully', async () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      await expect(storageManager.saveEngine(mockEngineState)).resolves.not.toThrow();
    });

    it('should handle corrupted data for loadEngine gracefully', async () => {
      localStorage.setItem(STORAGE_KEY, 'invalid-json');

      const loaded = await storageManager.loadEngine();

      expect(loaded).toEqual({});
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('should compress data — raw localStorage value is not plain JSON', async () => {
      await storageManager.saveEngine(mockEngineState);

      const raw = localStorage.getItem(STORAGE_KEY)!;
      expect(() => JSON.parse(raw)).toThrow();

      const loaded = await storageManager.loadEngine();
      expect(loaded.benchCountMap).toEqual({ 'player-1': 2, 'player-2': 1 });
      expect(loaded.winCountMap).toEqual({ 'player-1': 5, 'player-2': 3 });
    });

    it('should load old uncompressed plain-JSON format (backward compat)', async () => {
      const oldFormat = {
        engine: {
          benchCountMap: { 'player-1': 3 },
          singleCountMap: {},
          teammateCountMap: { 'player-1|player-2': 1 },
          opponentCountMap: {},
          winCountMap: { 'player-1': 7 },
          lossCountMap: { 'player-1': 1 },
        },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(oldFormat));

      const loaded = await storageManager.loadEngine();

      expect(loaded.benchCountMap).toEqual({ 'player-1': 3 });
      expect(loaded.winCountMap).toEqual({ 'player-1': 7 });
      expect(loaded.teammateCountMap).toEqual({ 'player-1|player-2': 1 });
    });
  });

  describe('clearAll', () => {
    it('should remove the single storage key', async () => {
      await storageManager.saveApp({ players: [], numberOfCourts: 4, assignments: [] });
      localStorage.setItem('other-data', 'should remain');

      storageManager.clearAll();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(localStorage.getItem('other-data')).toBe('should remain');
    });

    it('should handle clear errors gracefully', () => {
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('Cannot remove item');
      });

      expect(() => storageManager.clearAll()).not.toThrow();
    });
  });

  describe('migration from old keys', () => {
    it('should migrate data from old keys to new key on first load', async () => {
      const oldApp = { players: [{ id: 'p1', name: 'Alice', isPresent: true }], numberOfCourts: 4, assignments: [] };
      const oldEngine = { benchCountMap: { 'p1': 1 }, singleCountMap: {}, teammateCountMap: {}, opponentCountMap: {}, winCountMap: {}, lossCountMap: {} };

      localStorage.setItem(OLD_APP_KEY, JSON.stringify(oldApp));
      localStorage.setItem(OLD_ENGINE_KEY, JSON.stringify(oldEngine));

      const loadedApp = await storageManager.loadApp();

      expect(loadedApp.players).toEqual(oldApp.players);
      expect(localStorage.getItem(OLD_APP_KEY)).toBeNull();
      expect(localStorage.getItem(OLD_ENGINE_KEY)).toBeNull();
    });

    it('should migrate engine data from old key', async () => {
      const oldEngine = { benchCountMap: { 'p1': 2 }, singleCountMap: {}, teammateCountMap: {}, opponentCountMap: {}, winCountMap: {}, lossCountMap: {} };
      localStorage.setItem(OLD_ENGINE_KEY, JSON.stringify(oldEngine));

      const loadedEngine = await storageManager.loadEngine();

      expect(loadedEngine.benchCountMap).toEqual({ 'p1': 2 });
      expect(localStorage.getItem(OLD_ENGINE_KEY)).toBeNull();
    });

    it('should handle corrupted old key values gracefully and still remove them', async () => {
      localStorage.setItem(OLD_APP_KEY, 'invalid-json');
      localStorage.setItem(OLD_ENGINE_KEY, 'invalid-json');

      const loaded = await storageManager.loadApp();

      expect(loaded).toEqual({});
      expect(localStorage.getItem(OLD_APP_KEY)).toBeNull();
      expect(localStorage.getItem(OLD_ENGINE_KEY)).toBeNull();
    });
  });

  describe('size-based pruning', () => {
    it('should trim levelHistory to last 10 entries when payload is too large', async () => {
      const levelHistory: Record<string, number[]> = {};
      for (let i = 0; i < 1000; i++) {
        levelHistory[`player-${i}`] = Array.from({ length: 50 }, (_, j) => 50 + j);
      }

      const engineState = {
        benchCountMap: {},
        singleCountMap: {},
        teammateCountMap: {},
        opponentCountMap: {},
        winCountMap: {},
        lossCountMap: {},
        levelHistory,
      };

      await storageManager.saveEngine(engineState);

      const parsed = await readDecompressed() as { engine: { lh: Record<string, number[]> } };

      const histories = Object.values(parsed.engine.lh);
      histories.forEach(h => {
        expect(h.length).toBeLessThanOrEqual(10);
      });

      const raw = localStorage.getItem(STORAGE_KEY)!;
      expect(raw.length).toBeLessThanOrEqual(150_000);
    });

    it('should clear levelHistory entirely when trimming to 10 entries is still too large', async () => {
      const levelHistory: Record<string, number[]> = {};
      for (let i = 0; i < 4000; i++) {
        levelHistory[`player-${i}`] = Array.from({ length: 50 }, (_, j) => 50 + j);
      }

      await storageManager.saveEngine({
        benchCountMap: {},
        singleCountMap: {},
        teammateCountMap: {},
        opponentCountMap: {},
        winCountMap: {},
        lossCountMap: {},
        levelHistory,
      });

      // In v3 compact format lh is number[][]; when cleared it becomes []
      const parsed = await readDecompressed() as { engine: { lh: number[][] } };
      expect(parsed.engine.lh).toEqual([]);

      const raw = localStorage.getItem(STORAGE_KEY)!;
      expect(raw.length).toBeLessThanOrEqual(150_000);
    });

    it('should prune pair map to 200 keys when still too large', async () => {
      const teammate: Record<string, number> = {};
      const opponent: Record<string, number> = {};
      for (let i = 0; i < 200; i++) {
        for (let j = i + 1; j < 200; j++) {
          teammate[`player-${i}|player-${j}`] = 1;
          opponent[`player-${i}|player-${j}`] = 1;
        }
      }

      await storageManager.saveEngine({
        benchCountMap: {},
        singleCountMap: {},
        teammateCountMap: teammate,
        opponentCountMap: opponent,
        winCountMap: {},
        lossCountMap: {},
      });

      const parsed = await readDecompressed() as { engine: { pc: Record<string, [number, number]> } };

      const allKeys = Object.keys(parsed.engine.pc);
      expect(allKeys.length).toBeLessThanOrEqual(200);
    });
  });

  describe('compact format (v3)', () => {
    it('should round-trip engine state losslessly', async () => {
      const state = {
        benchCountMap: { 'p1': 3, 'p2': 1 },
        singleCountMap: { 'p1': 2 },
        teammateCountMap: { 'p1|p2': 5 },
        opponentCountMap: { 'p1|p3': 4 },
        winCountMap: { 'p1': 7, 'p3': 2 },
        lossCountMap: { 'p2': 3 },
      };
      await storageManager.saveEngine(state);
      const loaded = await storageManager.loadEngine();

      expect(loaded.benchCountMap).toEqual({ 'p1': 3, 'p2': 1 });
      expect(loaded.singleCountMap).toEqual({ 'p1': 2 });
      expect(loaded.teammateCountMap).toEqual({ 'p1|p2': 5 });
      expect(loaded.opponentCountMap).toEqual({ 'p1|p3': 4 });
      expect(loaded.winCountMap).toEqual({ 'p1': 7, 'p3': 2 });
      expect(loaded.lossCountMap).toEqual({ 'p2': 3 });
    });

    it('should preserve level history in round-trip', async () => {
      const state = {
        benchCountMap: { 'p1': 1 },
        singleCountMap: {},
        teammateCountMap: {},
        opponentCountMap: {},
        winCountMap: { 'p1': 2 },
        lossCountMap: {},
        levelHistory: { 'p1': [50, 55, 60] },
      };
      await storageManager.saveEngine(state);
      const loaded = await storageManager.loadEngine();
      expect(loaded.levelHistory).toEqual({ 'p1': [50, 55, 60] });
    });

    it('should include all pair participants in pi even if absent from stat maps', async () => {
      // player-3 appears only in opponent pairs, not in bench/win/loss maps
      const state = {
        benchCountMap: { 'p1': 1 },
        singleCountMap: {},
        teammateCountMap: {},
        opponentCountMap: { 'p1|p3': 2 },
        winCountMap: {},
        lossCountMap: {},
      };
      await storageManager.saveEngine(state);

      const parsed = await readDecompressed() as { engine: { v: number; pi: string[] } };
      expect(parsed.engine.v).toBe(3);
      expect(parsed.engine.pi).toContain('p1');
      expect(parsed.engine.pi).toContain('p3');

      const loaded = await storageManager.loadEngine();
      expect(loaded.opponentCountMap).toEqual({ 'p1|p3': 2 });
    });

    it('should use integer index pair keys instead of UUID pair keys', async () => {
      const uuid1 = '550e8400-e29b-41d4-a716-446655440001';
      const uuid2 = '550e8400-e29b-41d4-a716-446655440002';
      await storageManager.saveEngine({
        benchCountMap: {},
        singleCountMap: {},
        teammateCountMap: { [`${uuid1}|${uuid2}`]: 3 },
        opponentCountMap: {},
        winCountMap: {},
        lossCountMap: {},
      });

      const parsed = await readDecompressed() as { engine: { pi: string[]; pc: Record<string, unknown> } };
      const i1 = parsed.engine.pi.indexOf(uuid1);
      const i2 = parsed.engine.pi.indexOf(uuid2);
      const expectedKey = i1 < i2 ? `${i1}:${i2}` : `${i2}:${i1}`;
      expect(parsed.engine.pc[expectedKey]).toBeDefined();
      // No UUID pair key should appear
      expect(Object.keys(parsed.engine.pc).every(k => !k.includes('|'))).toBe(true);
    });
  });

  describe('write queue correctness', () => {
    const minimalEngineState: CourtEngineState = {
      benchCountMap: {},
      singleCountMap: {},
      teammateCountMap: {},
      opponentCountMap: {},
      winCountMap: {},
      lossCountMap: {},
    };

    it('should not lose data when saveApp and saveEngine are called concurrently', async () => {
      await Promise.all([
        storageManager.saveApp({ numberOfCourts: 3 }),
        storageManager.saveEngine({ ...minimalEngineState }),
      ]);
      const app = await storageManager.loadApp();
      const eng = await storageManager.loadEngine();
      expect(app.numberOfCourts).toBe(3);
      expect(eng).toBeDefined();
    });

    it('should leave storage empty when clearAll is called after pending saves', async () => {
      storageManager.saveApp({ numberOfCourts: 5 });
      storageManager.clearAll();
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('should prune pair map to 200 keys when data exceeds MAX_SIZE after clearing level history', async () => {

      const bigState: CourtEngineState = {
        benchCountMap: {}, singleCountMap: {}, winCountMap: {}, lossCountMap: {},
        teammateCountMap: Object.fromEntries(Array.from({ length: 15_000 }, (_, i) => [`p${i}|p${i + 1}`, 1])),
        opponentCountMap: {},
      };
      await storageManager.saveEngine(bigState);
      const loaded = await storageManager.loadEngine();
      const pairCount = Object.keys(loaded.teammateCountMap ?? {}).length;
      expect(pairCount).toBeLessThanOrEqual(200);
    });

    it('should read old uncompressed JSON format and write back compressed', async () => {
      const oldData = { app: { players: [{ id: '1', name: 'Alice', isPresent: true }], numberOfCourts: 2 } };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(oldData));
      const app = await storageManager.loadApp();
      expect(app.players?.[0].name).toBe('Alice');
      expect(app.numberOfCourts).toBe(2);

      await storageManager.saveApp({ numberOfCourts: 3 });
      const raw = localStorage.getItem(STORAGE_KEY)!;
      expect(() => JSON.parse(raw)).toThrow();
    });
  });
});
