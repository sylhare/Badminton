import { describe, expect, it } from 'vitest';

import { RoundRobinTournament } from '../../src/tournament/RoundRobinTournament';
import { createRoundRobinTournament, createTournamentMatch, createTournamentTeam } from '../data/testFactories';
import type { TournamentMatch, TournamentTeam } from '../../src/tournament/types.ts';

describe('Tournament', () => {
  const teamA = createTournamentTeam('a', ['Alice']);
  const teamB = createTournamentTeam('b', ['Bob']);
  const teamC = createTournamentTeam('c', ['Carl']);

  function makeTournament(
    matches: TournamentMatch[] = [{ id: 'm1', round: 1, courtNumber: 1, team1: teamA, team2: teamB, sets: [] }],
    teams: TournamentTeam[] = [teamA, teamB, teamC],
    ): RoundRobinTournament {
    return createRoundRobinTournament(matches, teams);
  }

  describe('withMatchResult', () => {
    it('returns a new instance with the match updated', () => {
      const updated = makeTournament().withMatchResult('m1', 1, [{ team1: 21, team2: 15 }]);
      expect(updated).not.toBe(makeTournament());
      expect(updated).toBeInstanceOf(RoundRobinTournament);
      expect(updated.matches()[0].winner).toBe(1);
      expect(updated.matches()[0].sets).toEqual([{ team1: 21, team2: 15 }]);
    });

    it('preserves existing sets when no new sets are given', () => {
      const updated = makeTournament([
        { id: 'm1', round: 1, courtNumber: 1, team1: teamA, team2: teamB, sets: [{ team1: 21, team2: 10 }] },
      ]).withMatchResult('m1', 2);
      expect(updated.matches()[0].sets).toEqual([{ team1: 21, team2: 10 }]);
    });

    it('drops the stale sets when a decided winner is flipped without new scores', () => {
      const decided = makeTournament().withMatchResult('m1', 1, [{ team1: 21, team2: 10 }]);
      const flipped = decided.withMatchResult('m1', 2);
      expect(flipped.matches()[0].winner).toBe(2);
      expect(flipped.matches()[0].sets).toEqual([]);
    });

    it('does not mutate the original instance', () => {
      const tournament = makeTournament();
      tournament.withMatchResult('m1', 1, [{ team1: 21, team2: 15 }]);
      expect(tournament.matches()[0].winner).toBeUndefined();
    });
  });

  describe('tieGroups — flags only ties not yet ordered by hand', () => {
    const teamC = createTournamentTeam('c', ['Charlie']);

    function threeTiedTeams(manualPoints?: Record<string, number>) {
      return RoundRobinTournament.fromState({
        format: 'singles',
        type: 'round-robin',
        numberOfCourts: 1,
        bestOf: 1,
        teams: [teamA, teamB, teamC],
        matches: [],
        manualPoints,
      });
    }

    it('groups adjacent rows the metrics cannot separate', () => {
      const t = threeTiedTeams();
      expect(t.tieGroups(t.calculateStandings())).toEqual([[0, 1, 2]]);
    });

    it('drops a run once a saved order gives every team a distinct tie-break point', () => {
      const resolved = threeTiedTeams().withManualOrder(['a', 'b', 'c']);
      expect(resolved.tieGroups(resolved.calculateStandings())).toEqual([]);
    });

    it('keeps flagging a run that is only partly ordered', () => {
      const partial = threeTiedTeams({ a: 2, b: 1 });
      expect(partial.tieGroups(partial.calculateStandings())).toHaveLength(1);
    });
  });

  describe('Tournament match, completion and rounds', () => {
    it('returns 0 when no matches', () => {
      const tournament = makeTournament([]);
      expect(tournament.completedRounds()).toBe(0);
      expect(tournament.totalRounds()).toBe(0);
      expect(tournament.isComplete()).toBe(false);
    });

    it('returns 0 when no winners set', () => {
      expect(makeTournament([createTournamentMatch('m1', 1, teamA, teamB)]).completedRounds()).toBe(0);
    });

    it('returns 1 when round 1 is fully done but round 2 has unfinished matches', () => {
      const tournament = makeTournament([
        createTournamentMatch('m1', 1, teamA, teamB, 1),
        createTournamentMatch('m2', 2, teamA, teamC),
      ]);
      expect(tournament.completedRounds()).toEqual(1);
      expect(tournament.currentRound()).toEqual(2);
      expect(tournament.isComplete()).toBe(false);
    });

    it('does not advance past a partial round', () => {
      expect(makeTournament([
        createTournamentMatch('m1', 1, teamA, teamB, 1),
        createTournamentMatch('m2', 1, teamA, teamC),
        createTournamentMatch('m3', 2, teamB, teamC, 2),
      ]).completedRounds()).toBe(0);
    });

    it('returns total rounds when all complete', () => {
      const tournament = makeTournament([
        createTournamentMatch('m1', 1, teamA, teamB, 1),
        createTournamentMatch('m2', 2, teamA, teamC, 2),
        createTournamentMatch('m3', 3, teamB, teamC, 1),
      ], [teamA, teamB, teamC]);
      expect(tournament.completedRounds()).toBe(3);
      expect(tournament.isComplete()).toBe(true);
      expect(tournament.currentRound()).toEqual(3);
      expect(tournament.totalRounds()).toEqual(3);
    });
  });
});
