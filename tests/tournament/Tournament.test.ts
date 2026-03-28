import { describe, expect, it } from 'vitest';

import { RoundRobinTournament } from '../../src/tournament/RoundRobinTournament';
import { createTournamentTeam } from '../data/testFactories';

describe('Tournament', () => {
  const teamA = createTournamentTeam('a', ['Alice']);
  const teamB = createTournamentTeam('b', ['Bob']);

  function makeTournament(score?: { team1: number; team2: number }) {
    return RoundRobinTournament.fromState({
      phase: 'active',
      format: 'singles',
      type: 'round-robin',
      numberOfCourts: 1,
      teams: [teamA, teamB],
      matches: [{ id: 'm1', round: 1, courtNumber: 1, team1: teamA, team2: teamB, score }],
    });
  }

  describe('withMatchResult', () => {
    it('returns a new instance with the match updated', () => {
      const updated = makeTournament().withMatchResult('m1', 1, { team1: 21, team2: 15 });
      expect(updated).not.toBe(makeTournament());
      expect(updated).toBeInstanceOf(RoundRobinTournament);
      expect(updated.matches()[0].winner).toBe(1);
      expect(updated.matches()[0].score).toEqual({ team1: 21, team2: 15 });
    });

    it('preserves existing score when no new score is given', () => {
      const updated = makeTournament({ team1: 21, team2: 10 }).withMatchResult('m1', 2);
      expect(updated.matches()[0].score).toEqual({ team1: 21, team2: 10 });
    });

    it('does not mutate the original instance', () => {
      const tournament = makeTournament();
      tournament.withMatchResult('m1', 1, { team1: 21, team2: 15 });
      expect(tournament.matches()[0].winner).toBeUndefined();
    });
  });
});
