import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { storageManager } from '../../src/utils/StorageManager';
import type { Court, CourtEngineState, Player } from '../../src/types';

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

    it('should save engine state in compact format under single key', async () => {
      await storageManager.saveEngine(mockEngineState);

      const savedData = localStorage.getItem(STORAGE_KEY);
      expect(savedData).toBeTruthy();

      const parsed = await readDecompressed() as { engine: { v: number; ps: Record<string, number[]>; pc: Record<string, number[]> } };
      expect(parsed.engine.v).toBe(2);
      expect(parsed.engine.ps['player-1']).toEqual([2, 0, 5, 2]);
      expect(parsed.engine.ps['player-2']).toEqual([1, 0, 3, 4]);
      expect(parsed.engine.pc['player-1|player-2']).toEqual([3, 0]);
      expect(parsed.engine.pc['player-1|player-3']).toEqual([0, 2]);
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

      const parsed = await readDecompressed() as { engine: { lh: Record<string, number[]> } };

      expect(parsed.engine.lh).toEqual({});

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
