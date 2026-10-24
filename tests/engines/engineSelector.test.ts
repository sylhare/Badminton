import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { engine, EnginePersistence, EngineType, getEngineType, setEngine } from '../../src/engines/engineSelector';
import type { Player } from '../../src/types';
import { storageManager } from '../../src/utils/StorageManager';
import { benchedPlayers } from '../../src/utils/playerUtils';
import { createSequentialPlayers as mockPlayers } from '../data/testFactories';

describe('Engine Selector', () => {
  describe.each([
    ['sa', 'Simulated Annealing'],
    ['sl', 'Smart Matching v2'],
  ])('Unified API - %s', (type, name) => {
    beforeEach(() => {
      setEngine(type as EngineType);
      engine().resetHistory();
    });

    it('should set the engine correctly', () => {
      expect(engine().name).toEqual(name);
      expect(engine().description).toBeTruthy();
      expect(getEngineType()).toEqual(type);
    });

    it('should generate court assignments', () => {
      const players = mockPlayers(8);
      const { courts: assignments } = engine().generate(players, 2);

      expect(assignments).toHaveLength(2);
      expect(assignments[0].players).toHaveLength(4);
      expect(assignments[1].players).toHaveLength(4);
    });

    it('should get benched players', () => {
      const players = mockPlayers(10);
      const { courts: assignments } = engine().generate(players, 2);
      const benched = benchedPlayers(assignments, players);

      expect(benched).toHaveLength(2);
    });

    it('engine should produce valid court assignments', () => {
      const players = mockPlayers(12);
      const { courts: saAssignments } = engine().generate(players, 3);

      expect(saAssignments).toHaveLength(3);
      expect(saAssignments.every(c => c.teams !== undefined)).toBe(true);
      expect(saAssignments.every(c => c.players.length === 4)).toBe(true);
    });

    it('engine should handle bench', () => {
      const players = mockPlayers(5);
      const { courts: saAssignments } = engine().generate(players, 2);
      const benched = benchedPlayers(saAssignments, players);
      expect(benched.length).toBe(1);
    });

    it('engine should handle empty player list', () => {
      const players: Player[] = [];
      expect(engine().generate(players, 2).courts).toHaveLength(0);

    });
  });

  describe('Engine Persistence', () => {
    let persistence: EnginePersistence;

    beforeEach(() => {
      persistence = new EnginePersistence();
    });

    afterEach(() => {
      persistence.stop();
      vi.restoreAllMocks();
    });

    it('saves engine state on change while running, and stops after teardown', async () => {
      const saveSpy = vi.spyOn(storageManager, 'saveEngine').mockResolvedValue();

      const stop = persistence.start();
      engine().recordLevelSnapshot(mockPlayers(2));
      await vi.waitFor(() => expect(saveSpy).toHaveBeenCalled());

      stop();
      saveSpy.mockClear();
      engine().recordLevelSnapshot(mockPlayers(2));
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(saveSpy).not.toHaveBeenCalled();
    });
  });
});
