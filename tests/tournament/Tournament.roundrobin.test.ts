import { describe, expect, it } from 'vitest';

import type { TournamentMatch, TournamentTeam } from '../../src/tournament/types.ts';
import Tournament from '../../src/tournament/Tournament';
import { makeMatch, makeTeam, makeTeamPlayers } from '../data/tournamentFactories';

describe('round-robin', () => {
  describe('match generation', () => {
    it('produces 1 match for 2 teams', () => {
      const teams = [makeTeam('a', ['A']), makeTeam('b', ['B'])];
      const { matches } = Tournament.start(teams, 2, 'singles', 'round-robin').toState();
      expect(matches).toHaveLength(1);
      expect(matches[0].round).toBe(1);
    });

    it('produces 3 matches for 3 teams with no duplicate pairings', () => {
      const teams = [makeTeam('a', ['A']), makeTeam('b', ['B']), makeTeam('c', ['C'])];
      const { matches } = Tournament.start(teams, 2, 'singles', 'round-robin').toState();
      expect(matches).toHaveLength(3);

      const pairings = matches.map(m => [m.team1.id, m.team2.id].sort().join('|'));
      expect(new Set(pairings).size).toBe(3);
    });

    it('produces 6 matches for 4 teams', () => {
      const teams = [makeTeam('a', ['A']), makeTeam('b', ['B']), makeTeam('c', ['C']), makeTeam('d', ['D'])];
      const { matches } = Tournament.start(teams, 2, 'singles', 'round-robin').toState();
      expect(matches).toHaveLength(6);
    });

    it('has no duplicate pairings for 4 teams', () => {
      const teams = [makeTeam('a', ['A']), makeTeam('b', ['B']), makeTeam('c', ['C']), makeTeam('d', ['D'])];
      const { matches } = Tournament.start(teams, 4, 'singles', 'round-robin').toState();
      const pairings = matches.map(m => [m.team1.id, m.team2.id].sort().join('|'));
      expect(new Set(pairings).size).toBe(6);
    });

    it('resets court numbers per round (5 teams, 4 courts)', () => {
      const teams = ['a', 'b', 'c', 'd', 'e'].map(id => makeTeam(id, [id]));
      const { matches } = Tournament.start(teams, 4, 'singles', 'round-robin').toState();
      const courtsByRound = [1, 2, 3, 4, 5].map(r =>
        matches.filter(m => m.round === r).map(m => m.courtNumber),
      );
      courtsByRound.forEach(courts => expect(courts).toEqual([1, 2]));
    });

    it('cycles court numbers wrapping at numberOfCourts', () => {
      const teams = [makeTeam('a', ['A']), makeTeam('b', ['B']), makeTeam('c', ['C']), makeTeam('d', ['D'])];
      const { matches } = Tournament.start(teams, 2, 'singles', 'round-robin').toState();
      expect(matches.map(m => m.courtNumber)).toEqual([1, 2, 1, 2, 1, 2]);
    });

    it('assigns correct round numbers for 4 teams (3 rounds, 2 matches each)', () => {
      const teams = [makeTeam('a', ['A']), makeTeam('b', ['B']), makeTeam('c', ['C']), makeTeam('d', ['D'])];
      const { matches } = Tournament.start(teams, 4, 'singles', 'round-robin').toState();
      expect(matches.filter(m => m.round === 1)).toHaveLength(2);
      expect(matches.filter(m => m.round === 2)).toHaveLength(2);
      expect(matches.filter(m => m.round === 3)).toHaveLength(2);
    });

    it('handles 3 teams with bye correctly (3 rounds, 1 match each)', () => {
      const teams = [makeTeam('a', ['A']), makeTeam('b', ['B']), makeTeam('c', ['C'])];
      const { matches } = Tournament.start(teams, 1, 'singles', 'round-robin').toState();
      expect(matches).toHaveLength(3);
      for (const m of matches) {
        expect(m.team1.id).not.toBe('bye');
        expect(m.team2.id).not.toBe('bye');
      }
    });

    it('returns no matches for fewer than 2 teams', () => {
      expect(Tournament.start([], 2, 'singles', 'round-robin').toState().matches).toHaveLength(0);
      expect(
        Tournament.start([makeTeam('a', ['A'])], 2, 'singles', 'round-robin').toState().matches,
      ).toHaveLength(0);
    });
  });

  describe('getStandings', () => {
    const teamA = makeTeam('a', ['Alice']);
    const teamB = makeTeam('b', ['Bob']);
    const teamC = makeTeam('c', ['Charlie']);
    const players = [
      ...makeTeamPlayers('a', ['Alice']),
      ...makeTeamPlayers('b', ['Bob']),
      ...makeTeamPlayers('c', ['Charlie']),
    ];

    function standings(teams: TournamentTeam[], matches: TournamentMatch[]) {
      return Tournament.from({
        phase: 'active', format: 'singles', type: 'round-robin',
        numberOfCourts: 2, teams, matches,
      }).getStandings(players);
    }

    it('returns all zeros when no results', () => {
      const rows = standings([teamA, teamB], [makeMatch('m1', 1, teamA, teamB)]);
      for (const row of rows) {
        expect(row.played).toBe(0);
        expect(row.won).toBe(0);
        expect(row.points).toBe(0);
        expect(row.scoreDiff).toBe(0);
      }
    });

    it('correctly counts wins and losses from partial results', () => {
      const rows = standings(
        [teamA, teamB],
        [makeMatch('m1', 1, teamA, teamB, 1, { team1: 21, team2: 15 })],
      );
      const rowA = rows.find(r => r.team.id === 'a')!;
      const rowB = rows.find(r => r.team.id === 'b')!;
      expect(rowA.won).toBe(1);
      expect(rowA.points).toBe(2);
      expect(rowA.scoreDiff).toBe(6);
      expect(rowB.lost).toBe(1);
      expect(rowB.points).toBe(0);
      expect(rowB.scoreDiff).toBe(-6);
    });

    it('sorts by points descending', () => {
      const rows = standings(
        [teamA, teamB, teamC],
        [makeMatch('m1', 1, teamA, teamB, 1), makeMatch('m2', 1, teamA, teamC, 1)],
      );
      expect(rows[0].team.id).toBe('a');
    });

    it('breaks ties by scoreDiff', () => {
      const rows = standings(
        [teamA, teamB, teamC],
        [
          makeMatch('m1', 1, teamA, teamB, 1, { team1: 21, team2: 10 }),
          makeMatch('m2', 2, teamC, teamB, 1, { team1: 21, team2: 15 }),
        ],
      );
      expect(rows[0].team.id).toBe('a');
      expect(rows[1].team.id).toBe('c');
    });

    it('breaks ties by name when points and scoreDiff equal', () => {
      const rows = standings(
        [teamA, teamB, teamC],
        [makeMatch('m1', 1, teamA, teamB, 1), makeMatch('m2', 1, teamC, teamB, 2)],
      );
      const names = rows.map(r => players.find(p => p.id === r.team.playerIds[0])?.name);
      expect(names[0]).toBe('Alice');
      expect(names[1]).toBe('Bob');
    });
  });

  describe('roundInfo', () => {
    const teamA = makeTeam('a', ['A']);
    const teamB = makeTeam('b', ['B']);
    const teamC = makeTeam('c', ['C']);

    function roundInfo(matches: TournamentMatch[]) {
      return Tournament.from({
        phase: 'active', format: 'singles', type: 'round-robin',
        numberOfCourts: 2, teams: [teamA, teamB, teamC], matches,
      }).roundInfo();
    }

    it('returns round 1 and empty roundNums when no matches', () => {
      expect(roundInfo([])).toEqual({ currentRound: 1, roundNums: [] });
    });

    it('returns the first round with an unfinished match as currentRound', () => {
      expect(roundInfo([
        makeMatch('m1', 1, teamA, teamB),
        makeMatch('m2', 2, teamA, teamC),
      ])).toEqual({ currentRound: 1, roundNums: [1, 2] });
    });

    it('advances to next round once previous round is complete', () => {
      expect(roundInfo([
        makeMatch('m1', 1, teamA, teamB, 1),
        makeMatch('m2', 2, teamA, teamC),
      ])).toEqual({ currentRound: 2, roundNums: [1, 2] });
    });

    it('returns last round as currentRound when all matches are complete', () => {
      expect(roundInfo([
        makeMatch('m1', 1, teamA, teamB, 1),
        makeMatch('m2', 2, teamA, teamC, 2),
        makeMatch('m3', 3, teamB, teamC, 1),
      ])).toEqual({ currentRound: 3, roundNums: [1, 2, 3] });
    });
  });

  describe('getCompletedRounds', () => {
    const teamA = makeTeam('a', ['A']);
    const teamB = makeTeam('b', ['B']);
    const teamC = makeTeam('c', ['C']);

    function completedRounds(matches: TournamentMatch[]) {
      return Tournament.from({
        phase: 'active', format: 'singles', type: 'round-robin',
        numberOfCourts: 2, teams: [teamA, teamB, teamC], matches,
      }).getCompletedRounds();
    }

    it('returns 0 when no matches', () => {
      expect(Tournament.from({
        phase: 'active', format: 'singles', type: 'round-robin',
        numberOfCourts: 2, teams: [], matches: [],
      }).getCompletedRounds()).toBe(0);
    });

    it('returns 0 when no winners set', () => {
      expect(completedRounds([makeMatch('m1', 1, teamA, teamB)])).toBe(0);
    });

    it('returns 1 when round 1 is fully done but round 2 has unfinished matches', () => {
      expect(completedRounds([
        makeMatch('m1', 1, teamA, teamB, 1),
        makeMatch('m2', 2, teamA, teamC),
      ])).toBe(1);
    });

    it('does not advance past a partial round', () => {
      expect(completedRounds([
        makeMatch('m1', 1, teamA, teamB, 1),
        makeMatch('m2', 1, teamA, teamC),
        makeMatch('m3', 2, teamB, teamC, 2),
      ])).toBe(0);
    });

    it('returns total rounds when all complete', () => {
      expect(completedRounds([
        makeMatch('m1', 1, teamA, teamB, 1),
        makeMatch('m2', 2, teamA, teamC, 2),
        makeMatch('m3', 3, teamB, teamC, 1),
      ])).toBe(3);
    });
  });
});
