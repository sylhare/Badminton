import { beforeEach, describe, expect, it } from 'vitest';

import {
  setEngine,
  engine,
  getEngineType,
  getEngineName,
  getEngineDescription,
} from '../../src/engines/engineSelector';
import { engineMC } from '../../src/engines/MonteCarloEngine';
import { engineSA } from '../../src/engines/SimulatedAnnealingEngine';
import { engineCG } from '../../src/engines/ConflictGraphEngine';
import type { Player } from '../../src/types';

function mockPlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `P${i}`,
    name: `Player ${i}`,
    isPresent: true,
  }));
}

describe('Engine Selector', () => {
  beforeEach(() => {
    setEngine('sa');
    engineMC.resetHistory();
    engineSA.resetHistory();
    engineCG.resetHistory();
  });

  describe('Engine Selection', () => {
    it('should default to Simulated Annealing engine', () => {
      expect(getEngineType()).toBe('sa');
      expect(engine()).toBe(engineSA);
    });

    it('should switch to Monte Carlo engine', () => {
      setEngine('mc');
      expect(getEngineType()).toBe('mc');
      expect(engine()).toBe(engineMC);
    });

    it('should switch to Conflict Graph engine', () => {
      setEngine('cg');
      expect(getEngineType()).toBe('cg');
      expect(engine()).toBe(engineCG);
    });

    it('should switch back to Simulated Annealing engine', () => {
      setEngine('cg');
      setEngine('sa');
      expect(getEngineType()).toBe('sa');
      expect(engine()).toBe(engineSA);
    });
  });

  describe('Engine Names and Descriptions', () => {
    it('should return correct name for Simulated Annealing', () => {
      setEngine('sa');
      expect(getEngineName()).toBe('Simulated Annealing');
    });

    it('should return correct name for Monte Carlo', () => {
      setEngine('mc');
      expect(getEngineName()).toBe('Monte Carlo');
    });

    it('should return correct name for Conflict Graph', () => {
      setEngine('cg');
      expect(getEngineName()).toBe('Conflict Graph');
    });

    it('should return description for Simulated Annealing', () => {
      setEngine('sa');
      const desc = getEngineDescription();
      expect(desc).toContain('Simulated Annealing');
      expect(desc).toContain('5000');
    });

    it('should return description for Monte Carlo', () => {
      setEngine('mc');
      const desc = getEngineDescription();
      expect(desc).toContain('Monte Carlo');
      expect(desc).toContain('300');
    });

    it('should return description for Conflict Graph', () => {
      setEngine('cg');
      const desc = getEngineDescription();
      expect(desc).toContain('greedy');
      expect(desc).toContain('conflict');
    });
  });

  describe('Unified API - Simulated Annealing', () => {
    beforeEach(() => {
      setEngine('sa');
      engine().resetHistory();
    });

    it('should generate court assignments', () => {
      const players = mockPlayers(8);
      const assignments = engine().generate(players, 2);

      expect(assignments).toHaveLength(2);
      expect(assignments[0].players).toHaveLength(4);
      expect(assignments[1].players).toHaveLength(4);
    });

    it('should get benched players', () => {
      const players = mockPlayers(10);
      const assignments = engine().generate(players, 2);
      const benched = engine().getBenchedPlayers(assignments, players);

      expect(benched).toHaveLength(2);
    });
  });

  describe('Unified API - Monte Carlo', () => {
    beforeEach(() => {
      setEngine('mc');
      engine().resetHistory();
    });

    it('should generate court assignments', () => {
      const players = mockPlayers(8);
      const assignments = engine().generate(players, 2);

      expect(assignments).toHaveLength(2);
      expect(assignments[0].players).toHaveLength(4);
      expect(assignments[1].players).toHaveLength(4);
    });

    it('should get benched players', () => {
      const players = mockPlayers(10);
      const assignments = engine().generate(players, 2);
      const benched = engine().getBenchedPlayers(assignments, players);

      expect(benched).toHaveLength(2);
    });
  });

  describe('Unified API - Conflict Graph', () => {
    beforeEach(() => {
      setEngine('cg');
      engine().resetHistory();
    });

    it('should generate court assignments', () => {
      const players = mockPlayers(8);
      const assignments = engine().generate(players, 2);

      expect(assignments).toHaveLength(2);
      expect(assignments[0].players).toHaveLength(4);
      expect(assignments[1].players).toHaveLength(4);
    });

    it('should get benched players', () => {
      const players = mockPlayers(10);
      const assignments = engine().generate(players, 2);
      const benched = engine().getBenchedPlayers(assignments, players);

      expect(benched).toHaveLength(2);
    });
  });

  describe('Engine Compatibility', () => {
    it('all engines should produce valid court assignments', () => {
      const players = mockPlayers(12);

      setEngine('sa');
      engineSA.resetHistory();
      const saAssignments = engine().generate(players, 3);

      expect(saAssignments).toHaveLength(3);
      expect(saAssignments.every(c => c.teams !== undefined)).toBe(true);
      expect(saAssignments.every(c => c.players.length === 4)).toBe(true);

      setEngine('mc');
      engineMC.resetHistory();
      const mcAssignments = engine().generate(players, 3);

      expect(mcAssignments).toHaveLength(3);
      expect(mcAssignments.every(c => c.teams !== undefined)).toBe(true);
      expect(mcAssignments.every(c => c.players.length === 4)).toBe(true);

      setEngine('cg');
      engineCG.resetHistory();
      const cgAssignments = engine().generate(players, 3);

      expect(cgAssignments).toHaveLength(3);
      expect(cgAssignments.every(c => c.teams !== undefined)).toBe(true);
      expect(cgAssignments.every(c => c.players.length === 4)).toBe(true);
    });

    it('all engines should handle edge cases the same way', () => {
      const players = mockPlayers(5);

      setEngine('sa');
      engineSA.resetHistory();
      const saAssignments = engine().generate(players, 2);
      const saBenched = engine().getBenchedPlayers(saAssignments, players);

      setEngine('mc');
      engineMC.resetHistory();
      const mcAssignments = engine().generate(players, 2);
      const mcBenched = engine().getBenchedPlayers(mcAssignments, players);

      setEngine('cg');
      engineCG.resetHistory();
      const cgAssignments = engine().generate(players, 2);
      const cgBenched = engine().getBenchedPlayers(cgAssignments, players);

      expect(saBenched.length).toBe(1);
      expect(mcBenched.length).toBe(1);
      expect(cgBenched.length).toBe(1);
    });

    it('all engines should handle empty player list', () => {
      const players: Player[] = [];

      setEngine('sa');
      expect(engine().generate(players, 2)).toEqual([]);

      setEngine('mc');
      expect(engine().generate(players, 2)).toEqual([]);

      setEngine('cg');
      expect(engine().generate(players, 2)).toEqual([]);
    });
  });
});
