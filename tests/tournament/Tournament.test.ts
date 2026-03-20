import { describe, expect, it } from 'vitest';

import Tournament from '../../src/tournament/Tournament';
import { createMockPlayer } from '../data/testFactories';
import { makeMatch, makeTeam } from '../data/tournamentFactories';

describe('tournament', () => {
  describe('getTotalRounds', () => {
    const teamA = makeTeam('a', ['A']);
    const teamB = makeTeam('b', ['B']);

    it('returns 0 for a RR tournament with no matches', () => {
      expect(Tournament.from({
        phase: 'active', format: 'singles', type: 'round-robin',
        numberOfCourts: 2, teams: [], matches: [],
      }).getTotalRounds()).toBe(0);
    });

    it('returns max round number for RR', () => {
      expect(Tournament.from({
        phase: 'active', format: 'singles', type: 'round-robin',
        numberOfCourts: 2, teams: [teamA, teamB],
        matches: [
          makeMatch('m1', 1, teamA, teamB),
          makeMatch('m2', 2, teamA, teamB),
          makeMatch('m3', 3, teamA, teamB),
        ],
      }).getTotalRounds()).toBe(3);
    });

    it('returns log2(size) for SE regardless of matches generated', () => {
      const teams = [makeTeam('a', ['A']), makeTeam('b', ['B']), makeTeam('c', ['C']), makeTeam('d', ['D'])];
      const t = Tournament.start(teams, 2, 'singles', 'elimination');
      expect(t.getTotalRounds()).toBe(2);
    });
  });

  describe('validate', () => {
    it('returns error for fewer than 2 teams', () => {
      expect(Tournament.validate([], 'singles')).not.toBeNull();
      expect(Tournament.validate([makeTeam('a', ['A'])], 'doubles')).not.toBeNull();
    });

    it('returns error for doubles team with 1 player', () => {
      const teams = [makeTeam('a', ['A']), makeTeam('b', ['B'])];
      expect(Tournament.validate(teams, 'doubles')).not.toBeNull();
    });

    it('returns null for valid singles setup', () => {
      const teams = [makeTeam('a', ['A']), makeTeam('b', ['B'])];
      expect(Tournament.validate(teams, 'singles')).toBeNull();
    });

    it('returns null for valid doubles setup', () => {
      const teams = [makeTeam('a', ['A', 'B']), makeTeam('b', ['C', 'D'])];
      expect(Tournament.validate(teams, 'doubles')).toBeNull();
    });

    it('allows singles teams with any player count', () => {
      const teams = [makeTeam('a', ['A']), makeTeam('b', ['B']), makeTeam('c', ['C'])];
      expect(Tournament.validate(teams, 'singles')).toBeNull();
    });
  });

  describe('createDoubleTeams', () => {
    it('creates correct pairs for even count', () => {
      const testPlayers = [
        createMockPlayer({ id: 'p1', name: 'Alice' }),
        createMockPlayer({ id: 'p2', name: 'Bob' }),
        createMockPlayer({ id: 'p3', name: 'Carol' }),
        createMockPlayer({ id: 'p4', name: 'Dave' }),
      ];
      const teams = Tournament.createDoubleTeams(testPlayers);
      expect(teams).toHaveLength(2);
      expect(teams[0].playerIds).toEqual(['p1', 'p2']);
      expect(teams[1].playerIds).toEqual(['p3', 'p4']);
    });

    it('creates incomplete last team for odd count', () => {
      const testPlayers = [
        createMockPlayer({ id: 'p1', name: 'Alice' }),
        createMockPlayer({ id: 'p2', name: 'Bob' }),
        createMockPlayer({ id: 'p3', name: 'Carol' }),
      ];
      const teams = Tournament.createDoubleTeams(testPlayers);
      expect(teams).toHaveLength(2);
      expect(teams[0].playerIds).toHaveLength(2);
      expect(teams[1].playerIds).toHaveLength(1);
    });
  });

  describe('createSingleTeams', () => {
    it('wraps each player in their own team', () => {
      const testPlayers = [
        createMockPlayer({ id: 'p1', name: 'Alice' }),
        createMockPlayer({ id: 'p2', name: 'Bob' }),
      ];
      const teams = Tournament.createSingleTeams(testPlayers);
      expect(teams).toHaveLength(2);
      expect(teams[0].playerIds).toEqual(['p1']);
      expect(teams[1].playerIds).toEqual(['p2']);
    });
  });

  describe('isComplete', () => {
    const teamA = makeTeam('a', ['A']);
    const teamB = makeTeam('b', ['B']);

    it('SE: returns false when no matches', () => {
      const t = Tournament.from({
        phase: 'active', format: 'singles', type: 'elimination',
        numberOfCourts: 2, teams: [teamA, teamB],
        matches: [],
        seBracket: { size: 2, seeding: ['a', 'b'] },
      });
      expect(t.isComplete()).toBe(false);
    });

    it('SE: returns false when final match has no winner yet', () => {
      const t = Tournament.from({
        phase: 'active', format: 'singles', type: 'elimination',
        numberOfCourts: 2, teams: [teamA, teamB],
        matches: [makeMatch('m1', 1, teamA, teamB)],
        seBracket: { size: 2, seeding: ['a', 'b'] },
      });
      expect(t.isComplete()).toBe(false);
    });

    it('SE: returns true when final match has a winner', () => {
      const t = Tournament.from({
        phase: 'active', format: 'singles', type: 'elimination',
        numberOfCourts: 2, teams: [teamA, teamB],
        matches: [makeMatch('m1', 1, teamA, teamB, 1)],
        seBracket: { size: 2, seeding: ['a', 'b'] },
      });
      expect(t.isComplete()).toBe(true);
    });

    it('RR: returns false when not all rounds complete', () => {
      const t = Tournament.from({
        phase: 'active', format: 'singles', type: 'round-robin',
        numberOfCourts: 2, teams: [teamA, teamB],
        matches: [makeMatch('m1', 1, teamA, teamB)],
      });
      expect(t.isComplete()).toBe(false);
    });

    it('RR: returns true when all rounds complete', () => {
      const t = Tournament.from({
        phase: 'active', format: 'singles', type: 'round-robin',
        numberOfCourts: 2, teams: [teamA, teamB],
        matches: [makeMatch('m1', 1, teamA, teamB, 1)],
      });
      expect(t.isComplete()).toBe(true);
    });
  });

  describe('recordResult', () => {
    const teamA = makeTeam('a', ['Alice']);
    const teamB = makeTeam('b', ['Bob']);

    function makeSinglesRR() {
      return Tournament.from({
        phase: 'active', format: 'singles', type: 'round-robin',
        numberOfCourts: 1, teams: [teamA, teamB],
        matches: [makeMatch('m1', 1, teamA, teamB)],
      });
    }

    it('returns a Tournament instance', () => {
      const t = makeSinglesRR();
      const result = t.recordResult('m1', 1);
      expect(result).toBeInstanceOf(Tournament);
    });

    it('records the winner on the returned tournament', () => {
      const t = makeSinglesRR();
      const next = t.recordResult('m1', 1);
      const match = next.toState().matches.find(m => m.id === 'm1')!;
      expect(match.winner).toBe(1);
    });

    it('records the score on the returned tournament', () => {
      const t = makeSinglesRR();
      const next = t.recordResult('m1', 1, { team1: 21, team2: 15 });
      const match = next.toState().matches.find(m => m.id === 'm1')!;
      expect(match.score).toEqual({ team1: 21, team2: 15 });
    });

    it('unknown matchId leaves all matches unchanged', () => {
      const t = makeSinglesRR();
      const next = t.recordResult('no-such-match', 1);
      expect(next.toState().matches.every(m => m.winner === undefined)).toBe(true);
    });
  });
});
