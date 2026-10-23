import { describe, expect, it } from 'vitest';

import { rotateCourtTeams } from '../../src/App';
import type { Court, Player } from '../../src/types';

const p = (id: string, name: string): Player => ({ id, name, isPresent: true });

const A = p('1', 'Alice');
const B = p('2', 'Bob');
const C = p('3', 'Charlie');
const D = p('4', 'Diana');

describe('rotateCourtTeams', () => {
  describe('doubles (4 players)', () => {
    it.each([
      ['config 0 ([A,B] vs [C,D]) to config 1 ([A,C] vs [B,D])', [A, B], [C, D], [A, C], [B, D]],
      ['config 1 ([A,C] vs [B,D]) to config 2 ([A,D] vs [B,C])', [A, C], [B, D], [A, D], [B, C]],
      ['config 2 ([A,D] vs [B,C]) back to config 0 ([A,B] vs [C,D])', [A, D], [B, C], [A, B], [C, D]],
    ] as Array<[string, Player[], Player[], Player[], Player[]]>)('rotates from %s', (_label, team1, team2, expected1, expected2) => {
      const court: Court = {
        courtNumber: 1,
        players: [A, B, C, D],
        teams: { team1, team2 },
      };

      const rotated = rotateCourtTeams(court);

      expect(rotated.teams!.team1.map(p => p.id)).toEqual(expected1.map(p => p.id));
      expect(rotated.teams!.team2.map(p => p.id)).toEqual(expected2.map(p => p.id));
    });

    it('cycles through all 3 configurations and returns to start', () => {
      let court: Court = {
        courtNumber: 1,
        players: [A, B, C, D],
        teams: { team1: [A, B], team2: [C, D] },
      };

      const initial = court.teams!.team1.map(p => p.id);
      court = rotateCourtTeams(court);
      court = rotateCourtTeams(court);
      court = rotateCourtTeams(court);

      expect(court.teams!.team1.map(p => p.id)).toEqual(initial);
    });

    it('clears winner on rotation', () => {
      const court: Court = {
        courtNumber: 1,
        players: [A, B, C, D],
        teams: { team1: [A, B], team2: [C, D] },
        winner: 1,
      };

      const rotated = rotateCourtTeams(court);

      expect(rotated.winner).toBeUndefined();
    });

    it('clears score on rotation', () => {
      const court: Court = {
        courtNumber: 1,
        players: [A, B, C, D],
        teams: { team1: [A, B], team2: [C, D] },
        winner: 1,
        sets: [{ team1: 21, team2: 15 }],
      };

      const rotated = rotateCourtTeams(court);

      expect(rotated.sets).toBeUndefined();
    });

    it('preserves court number and players array', () => {
      const court: Court = {
        courtNumber: 3,
        players: [A, B, C, D],
        teams: { team1: [A, B], team2: [C, D] },
      };

      const rotated = rotateCourtTeams(court);

      expect(rotated.courtNumber).toBe(3);
      expect(rotated.players).toEqual([A, B, C, D]);
    });

    it('normalises non-canonical team (team not containing first player) to config 0', () => {
      const court: Court = {
        courtNumber: 1,
        players: [A, B, C, D],
        teams: { team1: [C, D], team2: [A, B] },
      };

      const rotated = rotateCourtTeams(court);

      expect(rotated.teams!.team1.map(p => p.id)).toEqual([A.id, B.id]);
      expect(rotated.teams!.team2.map(p => p.id)).toEqual([C.id, D.id]);
    });
  });

  describe('singles (2 players)', () => {
    it('clears score on rotation', () => {
      const court: Court = {
        courtNumber: 1,
        players: [A, B],
        teams: { team1: [A], team2: [B] },
        winner: 1,
        sets: [{ team1: 21, team2: 12 }],
      };

      const rotated = rotateCourtTeams(court);

      expect(rotated.sets).toBeUndefined();
    });

    it('swaps team1 and team2', () => {
      const court: Court = {
        courtNumber: 1,
        players: [A, B],
        teams: { team1: [A], team2: [B] },
      };

      const rotated = rotateCourtTeams(court);

      expect(rotated.teams!.team1.map(p => p.id)).toEqual([B.id]);
      expect(rotated.teams!.team2.map(p => p.id)).toEqual([A.id]);
    });

    it('clears winner on rotation', () => {
      const court: Court = {
        courtNumber: 1,
        players: [A, B],
        teams: { team1: [A], team2: [B] },
        winner: 1,
      };

      const rotated = rotateCourtTeams(court);

      expect(rotated.winner).toBeUndefined();
    });
  });

  describe('no teams', () => {
    it('returns court unchanged when no teams are set', () => {
      const court: Court = {
        courtNumber: 1,
        players: [A, B],
      };

      const result = rotateCourtTeams(court);

      expect(result).toBe(court);
    });
  });
});
