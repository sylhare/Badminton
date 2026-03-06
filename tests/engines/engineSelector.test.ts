import { beforeEach, describe, expect, it } from 'vitest';

import { engine, getEngineType, setEngine } from '../../src/engines/engineSelector';
import { engineSA } from '../../src/engines/SimulatedAnnealingEngine';
import { engineSL } from '../../src/engines/SmartEngine';
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
    engineSA.resetHistory();
    engineSL.resetHistory();
  });

  describe('Engine Selection', () => {
    it('should default to Simulated Annealing engine', () => {
      expect(getEngineType()).toBe('sa');
      expect(engine()).toBe(engineSA);
    });

    it('should switch to Smart engine', () => {
      setEngine('sl');
      expect(getEngineType()).toBe('sl');
      expect(engine()).toBe(engineSL);
    });

    it('should switch back to Simulated Annealing engine', () => {
      setEngine('sl');
      setEngine('sa');
      expect(getEngineType()).toBe('sa');
      expect(engine()).toBe(engineSA);
    });
  });

  describe('Engine Names and Descriptions', () => {
    it('should return correct name for Simulated Annealing', () => {
      setEngine('sa');
      expect(engine().getName()).toBe('Simulated Annealing');
    });

    it('should return correct name for Smart engine', () => {
      setEngine('sl');
      expect(engine().getName()).toBeDefined();
    });

    it('should return description for Simulated Annealing', () => {
      setEngine('sa');
      const desc = engine().getDescription();
      expect(desc).toContain('Simulated Annealing');
      expect(desc).toContain('5000');
    });

    it('should return description for Smart engine', () => {
      setEngine('sl');
      const desc = engine().getDescription();
      expect(desc).toBeDefined();
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

  describe('Unified API - Smart Engine', () => {
    beforeEach(() => {
      setEngine('sl');
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

      setEngine('sl');
      engineSL.resetHistory();
      const slAssignments = engine().generate(players, 3);

      expect(slAssignments).toHaveLength(3);
      expect(slAssignments.every(c => c.teams !== undefined)).toBe(true);
      expect(slAssignments.every(c => c.players.length === 4)).toBe(true);
    });

    it('all engines should handle edge cases the same way', () => {
      const players = mockPlayers(5);

      setEngine('sa');
      engineSA.resetHistory();
      const saAssignments = engine().generate(players, 2);
      const saBenched = engine().getBenchedPlayers(saAssignments, players);

      setEngine('sl');
      engineSL.resetHistory();
      const slAssignments = engine().generate(players, 2);
      const slBenched = engine().getBenchedPlayers(slAssignments, players);

      expect(saBenched.length).toBe(1);
      expect(slBenched.length).toBe(1);
    });

    it('all engines should handle empty player list', () => {
      const players: Player[] = [];

      setEngine('sa');
      expect(engine().generate(players, 2)).toEqual([]);

      setEngine('sl');
      expect(engine().generate(players, 2)).toEqual([]);
    });
  });
});
