import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { storageManager } from '../../src/utils/StorageManager';
import type { Court, Player } from '../../src/types';

const STORAGE_KEY = 'badminton-state';
const OLD_APP_KEY = 'badminton-app-state';
const OLD_ENGINE_KEY = 'badminton-court-engine-state';

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

    it('should save app state under single key', () => {
      storageManager.saveApp(mockAppState);

      const savedData = localStorage.getItem(STORAGE_KEY);
      expect(savedData).toBeTruthy();

      const parsed = JSON.parse(savedData!);
      expect(parsed.app.players).toEqual(mockPlayers);
      expect(parsed.app.numberOfCourts).toBe(6);
      expect(parsed.app.assignments).toEqual(mockAssignments);
    });

    it('should load app state', () => {
      storageManager.saveApp(mockAppState);

      const loaded = storageManager.loadApp();

      expect(loaded.players).toEqual(mockPlayers);
      expect(loaded.numberOfCourts).toBe(6);
      expect(loaded.assignments).toEqual(mockAssignments);
    });

    it('should return empty object when no saved state exists', () => {
      const loaded = storageManager.loadApp();
      expect(loaded).toEqual({});
    });

    it('should handle corrupted localStorage data gracefully', () => {
      localStorage.setItem(STORAGE_KEY, 'invalid-json');

      const loaded = storageManager.loadApp();
      expect(loaded).toEqual({});
    });

    it('should handle localStorage save errors gracefully', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      expect(() => storageManager.saveApp(mockAppState)).not.toThrow();
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

    it('should save engine state under single key', () => {
      storageManager.saveEngine(mockEngineState);

      const savedData = localStorage.getItem(STORAGE_KEY);
      expect(savedData).toBeTruthy();

      const parsed = JSON.parse(savedData!);
      expect(parsed.engine.benchCountMap).toEqual({ 'player-1': 2, 'player-2': 1 });
      expect(parsed.engine.teammateCountMap).toEqual({ 'player-1|player-2': 3 });
      expect(parsed.engine.winCountMap).toEqual({ 'player-1': 5, 'player-2': 3 });
    });

    it('should load engine state', () => {
      storageManager.saveEngine(mockEngineState);

      const loaded = storageManager.loadEngine();

      expect(loaded.benchCountMap).toEqual({ 'player-1': 2, 'player-2': 1 });
      expect(loaded.teammateCountMap).toEqual({ 'player-1|player-2': 3 });
      expect(loaded.opponentCountMap).toEqual({ 'player-1|player-3': 2 });
      expect(loaded.winCountMap).toEqual({ 'player-1': 5, 'player-2': 3 });
      expect(loaded.lossCountMap).toEqual({ 'player-1': 2, 'player-2': 4 });
    });

    it('should return empty object when no saved engine state exists', () => {
      const loaded = storageManager.loadEngine();
      expect(loaded).toEqual({});
    });

    it('should handle localStorage save errors gracefully', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      expect(() => storageManager.saveEngine(mockEngineState)).not.toThrow();
    });

    it('should handle corrupted data for loadEngine gracefully', () => {
      localStorage.setItem(STORAGE_KEY, 'invalid-json');

      const loaded = storageManager.loadEngine();

      expect(loaded).toEqual({});
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  describe('clearAll', () => {
    it('should remove the single storage key', () => {
      storageManager.saveApp({ players: [], numberOfCourts: 4, assignments: [] });
      localStorage.setItem('other-data', 'should remain');

      storageManager.clearAll();

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
    it('should migrate data from old keys to new key on first load', () => {
      const oldApp = { players: [{ id: 'p1', name: 'Alice', isPresent: true }], numberOfCourts: 4, assignments: [] };
      const oldEngine = { benchCountMap: { 'p1': 1 }, singleCountMap: {}, teammateCountMap: {}, opponentCountMap: {}, winCountMap: {}, lossCountMap: {} };

      localStorage.setItem(OLD_APP_KEY, JSON.stringify(oldApp));
      localStorage.setItem(OLD_ENGINE_KEY, JSON.stringify(oldEngine));

      const loadedApp = storageManager.loadApp();

      expect(loadedApp.players).toEqual(oldApp.players);
      expect(localStorage.getItem(OLD_APP_KEY)).toBeNull();
      expect(localStorage.getItem(OLD_ENGINE_KEY)).toBeNull();
    });

    it('should migrate engine data from old key', () => {
      const oldEngine = { benchCountMap: { 'p1': 2 }, singleCountMap: {}, teammateCountMap: {}, opponentCountMap: {}, winCountMap: {}, lossCountMap: {} };
      localStorage.setItem(OLD_ENGINE_KEY, JSON.stringify(oldEngine));

      const loadedEngine = storageManager.loadEngine();

      expect(loadedEngine.benchCountMap).toEqual({ 'p1': 2 });
      expect(localStorage.getItem(OLD_ENGINE_KEY)).toBeNull();
    });

    it('should handle corrupted old key values gracefully and still remove them', () => {
      localStorage.setItem(OLD_APP_KEY, 'invalid-json');
      localStorage.setItem(OLD_ENGINE_KEY, 'invalid-json');

      const loaded = storageManager.loadApp();

      expect(loaded).toEqual({});
      expect(localStorage.getItem(OLD_APP_KEY)).toBeNull();
      expect(localStorage.getItem(OLD_ENGINE_KEY)).toBeNull();
    });
  });

  describe('size-based pruning', () => {
    it('should trim levelHistory to last 10 entries when payload is too large', () => {
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

      storageManager.saveEngine(engineState);

      const raw = localStorage.getItem(STORAGE_KEY)!;
      const parsed = JSON.parse(raw);

      const histories = Object.values(parsed.engine.levelHistory as Record<string, number[]>);
      histories.forEach(h => {
        expect(h.length).toBeLessThanOrEqual(10);
      });

      expect(raw.length).toBeLessThanOrEqual(150_000);
    });

    it('should clear levelHistory entirely when trimming to 10 entries is still too large', () => {
      const levelHistory: Record<string, number[]> = {};
      for (let i = 0; i < 4000; i++) {
        levelHistory[`player-${i}`] = Array.from({ length: 50 }, (_, j) => 50 + j);
      }

      storageManager.saveEngine({
        benchCountMap: {},
        singleCountMap: {},
        teammateCountMap: {},
        opponentCountMap: {},
        winCountMap: {},
        lossCountMap: {},
        levelHistory,
      });

      const raw = localStorage.getItem(STORAGE_KEY)!;
      const parsed = JSON.parse(raw);

      expect(parsed.engine.levelHistory).toEqual({});
      expect(raw.length).toBeLessThanOrEqual(150_000);
    });

    it('should prune teammateCountMap and opponentCountMap to 200 keys when still too large', () => {
      const teammate: Record<string, number> = {};
      const opponent: Record<string, number> = {};
      for (let i = 0; i < 100; i++) {
        for (let j = i + 1; j < 100; j++) {
          teammate[`player-${i}|player-${j}`] = 1;
          opponent[`player-${i}|player-${j}`] = 1;
        }
      }

      storageManager.saveEngine({
        benchCountMap: {},
        singleCountMap: {},
        teammateCountMap: teammate,
        opponentCountMap: opponent,
        winCountMap: {},
        lossCountMap: {},
      });

      const raw = localStorage.getItem(STORAGE_KEY)!;
      const parsed = JSON.parse(raw);

      const allKeys = [
        ...new Set([
          ...Object.keys(parsed.engine.teammateCountMap as Record<string, number>),
          ...Object.keys(parsed.engine.opponentCountMap as Record<string, number>),
        ]),
      ];
      expect(allKeys.length).toBeLessThanOrEqual(200);
    });
  });
});
