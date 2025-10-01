import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  saveAppState,
  loadAppState,
  saveCourtEngineState,
  loadCourtEngineState,
  clearAllStoredState,
} from '../../src/utils/storageUtils';
import type { Player, Court } from '../../src/App';

describe('StorageUtils', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  describe('saveAppState and loadAppState', () => {
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
      collapsedSteps: new Set([1, 2]),
    };

    it('should save app state to localStorage', () => {
      saveAppState(mockAppState);

      const savedData = localStorage.getItem('badminton-app-state');
      expect(savedData).toBeTruthy();

      const parsed = JSON.parse(savedData!);
      expect(parsed.players).toEqual(mockPlayers);
      expect(parsed.numberOfCourts).toBe(6);
      expect(parsed.assignments).toEqual(mockAssignments);
      expect(parsed.collapsedSteps).toEqual([1, 2]);
    });

    it('should load app state from localStorage', () => {

      saveAppState(mockAppState);

      const loaded = loadAppState();

      expect(loaded.players).toEqual(mockPlayers);
      expect(loaded.numberOfCourts).toBe(6);
      expect(loaded.assignments).toEqual(mockAssignments);
      expect(loaded.collapsedSteps).toEqual(new Set([1, 2]));
    });

    it('should return empty object when no saved state exists', () => {
      const loaded = loadAppState();
      expect(loaded).toEqual({});
    });

    it('should handle corrupted localStorage data gracefully', () => {
      localStorage.setItem('badminton-app-state', 'invalid-json');

      const loaded = loadAppState();
      expect(loaded).toEqual({});
      expect(localStorage.getItem('badminton-app-state')).toBeNull();
    });

    it('should handle app state save errors gracefully', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      expect(() => saveAppState(mockAppState)).not.toThrow();
      expect(localStorage.getItem('badminton-app-state')).toBeNull();
    });
  });

  describe('saveCourtEngineState and loadCourtEngineState', () => {
    const mockCourtEngineState = {
      benchCountMap: new Map([['player-1', 2], ['player-2', 1]]),
      teammateCountMap: new Map([['player-1|player-2', 3]]),
      opponentCountMap: new Map([['player-1|player-3', 2]]),
      winCountMap: new Map([['player-1', 5], ['player-2', 3]]),
      lossCountMap: new Map([['player-1', 2], ['player-2', 4]]),
    };

    it('should save court engine state to localStorage', () => {
      saveCourtEngineState(mockCourtEngineState);

      const savedData = localStorage.getItem('badminton-court-engine-state');
      expect(savedData).toBeTruthy();

      const parsed = JSON.parse(savedData!);
      expect(parsed.benchCountMap).toEqual({ 'player-1': 2, 'player-2': 1 });
      expect(parsed.teammateCountMap).toEqual({ 'player-1|player-2': 3 });
      expect(parsed.opponentCountMap).toEqual({ 'player-1|player-3': 2 });
      expect(parsed.winCountMap).toEqual({ 'player-1': 5, 'player-2': 3 });
      expect(parsed.lossCountMap).toEqual({ 'player-1': 2, 'player-2': 4 });
    });

    it('should load court engine state from localStorage', () => {

      saveCourtEngineState(mockCourtEngineState);

      const loaded = loadCourtEngineState();

      expect(loaded.benchCountMap).toEqual({ 'player-1': 2, 'player-2': 1 });
      expect(loaded.teammateCountMap).toEqual({ 'player-1|player-2': 3 });
      expect(loaded.opponentCountMap).toEqual({ 'player-1|player-3': 2 });
      expect(loaded.winCountMap).toEqual({ 'player-1': 5, 'player-2': 3 });
      expect(loaded.lossCountMap).toEqual({ 'player-1': 2, 'player-2': 4 });
    });

    it('should return empty object when no saved court engine state exists', () => {
      const loaded = loadCourtEngineState();
      expect(loaded).toEqual({});
    });

    it('should handle corrupted court engine data gracefully', () => {
      localStorage.setItem('badminton-court-engine-state', 'invalid-json');

      const loaded = loadCourtEngineState();
      expect(loaded).toEqual({});
      expect(localStorage.getItem('badminton-court-engine-state')).toBeNull();
    });

    it('should handle court engine save errors gracefully', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      expect(() => saveCourtEngineState(mockCourtEngineState)).not.toThrow();
      expect(localStorage.getItem('badminton-court-engine-state')).toBeNull();
    });
  });

  describe('clearAllStoredState', () => {
    it('should remove all stored state from localStorage', () => {

      localStorage.setItem('badminton-app-state', '{"test": "data"}');
      localStorage.setItem('badminton-court-engine-state', '{"test": "data"}');
      localStorage.setItem('other-data', 'should remain');

      expect(localStorage.getItem('badminton-app-state')).toBeTruthy();
      expect(localStorage.getItem('badminton-court-engine-state')).toBeTruthy();
      expect(localStorage.getItem('other-data')).toBeTruthy();

      clearAllStoredState();

      expect(localStorage.getItem('badminton-app-state')).toBeNull();
      expect(localStorage.getItem('badminton-court-engine-state')).toBeNull();
      expect(localStorage.getItem('other-data')).toBe('should remain'); // Should not affect other data
    });

    it('should handle clear errors gracefully', () => {
      localStorage.setItem('badminton-app-state', '{"test": "data"}');
      localStorage.setItem('badminton-court-engine-state', '{"test": "data"}');

      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('Cannot remove item');
      });

      expect(() => clearAllStoredState()).not.toThrow();
    });
  });
});
