import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createPlayersFromNames, validatePlayerNames } from '../../src/utils/playerUtils';

describe('Player Utils', () => {
  describe('createPlayersFromNames', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should create players with unique IDs and default prefix', () => {
      const names = ['John Doe', 'Jane Smith', 'Bob Wilson'];
      const result = createPlayersFromNames(names);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        id: 'player-1704067200000-0',
        name: 'John Doe',
        isPresent: true,
      });
      expect(result[1]).toEqual({
        id: 'player-1704067200000-1',
        name: 'Jane Smith',
        isPresent: true,
      });
      expect(result[2]).toEqual({
        id: 'player-1704067200000-2',
        name: 'Bob Wilson',
        isPresent: true,
      });
    });

    it('should create players with custom prefix', () => {
      const names = ['Alice Brown'];
      const result = createPlayersFromNames(names, 'manual');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'manual-1704067200000-0',
        name: 'Alice Brown',
        isPresent: true,
      });
    });

    it('should trim whitespace from player names', () => {
      const names = ['  John Doe  ', '\tJane Smith\n', ' Bob Wilson '];
      const result = createPlayersFromNames(names);

      expect(result[0].name).toBe('John Doe');
      expect(result[1].name).toBe('Jane Smith');
      expect(result[2].name).toBe('Bob Wilson');
    });

    it('should handle empty array', () => {
      const result = createPlayersFromNames([]);
      expect(result).toEqual([]);
    });

    it('should generate unique IDs for each call', () => {
      const firstCall = createPlayersFromNames(['Player 1']);
      vi.advanceTimersByTime(1000);
      const secondCall = createPlayersFromNames(['Player 2']);

      expect(firstCall[0].id).not.toBe(secondCall[0].id);
    });
  });

  describe('validatePlayerNames', () => {
    const testCases = [
      {
        description: 'should filter out empty names',
        input: ['John Doe', '', 'Jane Smith', '   ', 'Bob Wilson'],
        expected: ['John Doe', 'Jane Smith', 'Bob Wilson'],
      },
      {
        description: 'should trim whitespace from names',
        input: ['  John Doe  ', '\tJane Smith\n', ' Bob Wilson '],
        expected: ['John Doe', 'Jane Smith', 'Bob Wilson'],
      },
      {
        description: 'should handle array with only empty strings',
        input: ['', '   ', '\t\n', ''],
        expected: [],
      },
      {
        description: 'should handle empty array',
        input: [],
        expected: [],
      },
      {
        description: 'should preserve names that are just single characters after trimming',
        input: [' A ', 'B', '  C  '],
        expected: ['A', 'B', 'C'],
      },
    ];

    testCases.forEach(({ description, input, expected }) => {
      it(description, () => {
        const result = validatePlayerNames(input);
        expect(result).toEqual(expected);
      });
    });
  });
});