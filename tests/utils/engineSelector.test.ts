import { beforeEach, describe, expect, it } from 'vitest';

import {
  setEngine,
  getEngine,
  getEngineType,
  getEngineName,
  getEngineDescription,
  generateCourtAssignments,
  getBenchedPlayers,
  resetHistory,
} from '../../src/utils/engineSelector';
import { CourtAssignmentEngine } from '../../src/utils/CourtAssignmentEngine';
import { CourtAssignmentEngineSA } from '../../src/utils/CourtAssignmentEngineSA';
import { ConflictGraphEngine } from '../../src/utils/ConflictGraphEngine';
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
    CourtAssignmentEngine.resetHistory();
    CourtAssignmentEngineSA.resetHistory();
    ConflictGraphEngine.resetHistory();
  });

  describe('Engine Selection', () => {
    it('should default to Simulated Annealing engine', () => {
      expect(getEngineType()).toBe('sa');
      expect(getEngine()).toBe(CourtAssignmentEngineSA);
    });

    it('should switch to Monte Carlo engine', () => {
      setEngine('mc');
      expect(getEngineType()).toBe('mc');
      expect(getEngine()).toBe(CourtAssignmentEngine);
    });

    it('should switch to Conflict Graph engine', () => {
      setEngine('cg');
      expect(getEngineType()).toBe('cg');
      expect(getEngine()).toBe(ConflictGraphEngine);
    });

    it('should switch back to Simulated Annealing engine', () => {
      setEngine('cg');
      setEngine('sa');
      expect(getEngineType()).toBe('sa');
      expect(getEngine()).toBe(CourtAssignmentEngineSA);
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
      resetHistory();
    });

    it('should generate court assignments', () => {
      const players = mockPlayers(8);
      const assignments = generateCourtAssignments(players, 2);

      expect(assignments).toHaveLength(2);
      expect(assignments[0].players).toHaveLength(4);
      expect(assignments[1].players).toHaveLength(4);
    });

    it('should get benched players', () => {
      const players = mockPlayers(10);
      const assignments = generateCourtAssignments(players, 2);
      const benched = getBenchedPlayers(assignments, players);

      expect(benched).toHaveLength(2);
    });
  });

  describe('Unified API - Monte Carlo', () => {
    beforeEach(() => {
      setEngine('mc');
      resetHistory();
    });

    it('should generate court assignments', () => {
      const players = mockPlayers(8);
      const assignments = generateCourtAssignments(players, 2);

      expect(assignments).toHaveLength(2);
      expect(assignments[0].players).toHaveLength(4);
      expect(assignments[1].players).toHaveLength(4);
    });

    it('should get benched players', () => {
      const players = mockPlayers(10);
      const assignments = generateCourtAssignments(players, 2);
      const benched = getBenchedPlayers(assignments, players);

      expect(benched).toHaveLength(2);
    });
  });

  describe('Unified API - Conflict Graph', () => {
    beforeEach(() => {
      setEngine('cg');
      resetHistory();
    });

    it('should generate court assignments', () => {
      const players = mockPlayers(8);
      const assignments = generateCourtAssignments(players, 2);

      expect(assignments).toHaveLength(2);
      expect(assignments[0].players).toHaveLength(4);
      expect(assignments[1].players).toHaveLength(4);
    });

    it('should get benched players', () => {
      const players = mockPlayers(10);
      const assignments = generateCourtAssignments(players, 2);
      const benched = getBenchedPlayers(assignments, players);

      expect(benched).toHaveLength(2);
    });
  });

  describe('Engine Compatibility', () => {
    it('all engines should produce valid court assignments', () => {
      const players = mockPlayers(12);

      setEngine('sa');
      CourtAssignmentEngineSA.resetHistory();
      const saAssignments = generateCourtAssignments(players, 3);

      expect(saAssignments).toHaveLength(3);
      expect(saAssignments.every(c => c.teams !== undefined)).toBe(true);
      expect(saAssignments.every(c => c.players.length === 4)).toBe(true);

      setEngine('mc');
      CourtAssignmentEngine.resetHistory();
      const mcAssignments = generateCourtAssignments(players, 3);

      expect(mcAssignments).toHaveLength(3);
      expect(mcAssignments.every(c => c.teams !== undefined)).toBe(true);
      expect(mcAssignments.every(c => c.players.length === 4)).toBe(true);

      setEngine('cg');
      ConflictGraphEngine.resetHistory();
      const cgAssignments = generateCourtAssignments(players, 3);

      expect(cgAssignments).toHaveLength(3);
      expect(cgAssignments.every(c => c.teams !== undefined)).toBe(true);
      expect(cgAssignments.every(c => c.players.length === 4)).toBe(true);
    });

    it('all engines should handle edge cases the same way', () => {
      const players = mockPlayers(5);

      setEngine('sa');
      CourtAssignmentEngineSA.resetHistory();
      const saAssignments = generateCourtAssignments(players, 2);
      const saBenched = getBenchedPlayers(saAssignments, players);

      setEngine('mc');
      CourtAssignmentEngine.resetHistory();
      const mcAssignments = generateCourtAssignments(players, 2);
      const mcBenched = getBenchedPlayers(mcAssignments, players);

      setEngine('cg');
      ConflictGraphEngine.resetHistory();
      const cgAssignments = generateCourtAssignments(players, 2);
      const cgBenched = getBenchedPlayers(cgAssignments, players);

      expect(saBenched.length).toBe(1);
      expect(mcBenched.length).toBe(1);
      expect(cgBenched.length).toBe(1);
    });

    it('all engines should handle empty player list', () => {
      const players: Player[] = [];

      setEngine('sa');
      expect(generateCourtAssignments(players, 2)).toEqual([]);

      setEngine('mc');
      expect(generateCourtAssignments(players, 2)).toEqual([]);

      setEngine('cg');
      expect(generateCourtAssignments(players, 2)).toEqual([]);
    });
  });
});
