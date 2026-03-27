import { describe, expect, it } from 'vitest';

import { EliminationTournament } from '../../src/tournament/EliminationTournament';
import { nextPowerOf2 } from '../../src/tournament/bracketTree';
import { createMockPlayer, createTournamentTeam, createTournamentTeams } from '../data/testFactories';
import { BracketKind } from '../../src/tournament/types';
import type { TournamentTeam } from '../../src/tournament/types';

describe('nextPowerOf2', () => {
  it.each([
    [1, 1],
    [2, 2],
    [3, 4],
    [4, 4],
    [5, 8],
    [7, 8],
    [8, 8],
    [9, 16],
  ])('nextPowerOf2(%i) === %i', (n, expected) => {
    expect(nextPowerOf2(n)).toBe(expected);
  });
});

describe('EliminationTournament', () => {
  describe('start', () => {
    it('2 teams → bracketSize=2, 1 WB match', () => {
      const [A, B] = createTournamentTeams(['A', 'B']);
      const t = EliminationTournament.create().start([A, B], 4);
      expect(t.bracketSize()).toBe(2);
      const wb = t.winners.matches();
      expect(wb).toHaveLength(1);
      expect(wb[0].round).toBe(1);
      expect(wb[0].bracket).toBe(BracketKind.Winners);
    });

    it('4 teams → bracketSize=4, 2 WB R1 matches', () => {
      const teams = createTournamentTeams(['A', 'B', 'C', 'D']);
      const t = EliminationTournament.create().start(teams, 4);
      expect(t.bracketSize()).toBe(4);
      expect(t.winners.matchesForRound(1)).toHaveLength(2);
    });

    it('8 teams → bracketSize=8, 4 WB R1 matches', () => {
      const teams = createTournamentTeams(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
      const t = EliminationTournament.create().start(teams, 4);
      expect(t.bracketSize()).toBe(8);
      expect(t.winners.matchesForRound(1)).toHaveLength(4);
    });

    it('5 teams → bracketSize=8, 2 WB R1 matches (3 byes at end)', () => {
      const teams = createTournamentTeams(['A', 'B', 'C', 'D', 'E']);
      const t = EliminationTournament.create().start(teams, 4);
      expect(t.bracketSize()).toBe(8);
      expect(t.winners.matchesForRound(1)).toHaveLength(2);
    });

    it('3 teams → bracketSize=4, 1 WB R1 match (A vs B; C gets bye-advance)', () => {
      const teams = createTournamentTeams(['A', 'B', 'C']);
      const t = EliminationTournament.create().start(teams, 4);
      expect(t.bracketSize()).toBe(4);
      expect(t.winners.matchesForRound(1)).toHaveLength(1);
    });

    it('seeding matches adjacent pairs from teams array', () => {
      const [A, B, C, D] = createTournamentTeams(['A', 'B', 'C', 'D']);
      const t = EliminationTournament.create().start([A, B, C, D], 4);
      const r1 = t.winners.matchesForRound(1);
      const pair0 = r1[0];
      const pair1 = r1[1];
      expect([pair0.team1.id, pair0.team2.id]).toContain(A.id);
      expect([pair0.team1.id, pair0.team2.id]).toContain(B.id);
      expect([pair1.team1.id, pair1.team2.id]).toContain(C.id);
      expect([pair1.team1.id, pair1.team2.id]).toContain(D.id);
    });

    it('starts in active phase', () => {
      const teams = createTournamentTeams(['A', 'B']);
      const t = EliminationTournament.create().start(teams, 2);
      expect(t.phase()).toBe('active');
    });
  });

  describe('totalRounds', () => {
    it('2 teams → 1 round', () => {
      const t = EliminationTournament.create().start(createTournamentTeams(['A', 'B']), 2);
      expect(t.totalRounds()).toBe(1);
    });

    it('4 teams → 2 rounds', () => {
      const t = EliminationTournament.create().start(createTournamentTeams(['A', 'B', 'C', 'D']), 2);
      expect(t.totalRounds()).toBe(2);
    });

    it('8 teams → 3 rounds', () => {
      const t = EliminationTournament.create().start(createTournamentTeams(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']), 2);
      expect(t.totalRounds()).toBe(3);
    });
  });

  describe('withMatchResult — WB round progression', () => {
    it('4 teams: completing WB R1 generates WB R2 and CB R1', () => {
      const [A, B, C, D] = createTournamentTeams(['A', 'B', 'C', 'D']);
      let t = EliminationTournament.create().start([A, B, C, D], 4);
      const [m0, m1] = t.winners.matchesForRound(1);

      t = t.withMatchResult(m0.id, 1);
      expect(t.winners.matchesForRound(2)).toHaveLength(0);
      expect(t.consolation.matchesForRound(1)).toHaveLength(0);

      t = t.withMatchResult(m1.id, 1);
      expect(t.winners.matchesForRound(2)).toHaveLength(1);
      expect(t.consolation.matchesForRound(1)).toHaveLength(1);
    });

    it('4 teams: completing WB final + CB final → completed phase', () => {
      const [A, B, C, D] = createTournamentTeams(['A', 'B', 'C', 'D']);
      let t = EliminationTournament.create().start([A, B, C, D], 4);
      const [m0, m1] = t.winners.matchesForRound(1);
      t = t.withMatchResult(m0.id, 1);
      t = t.withMatchResult(m1.id, 1);

      const [wbFinal] = t.winners.matchesForRound(2);
      const [cbFinal] = t.consolation.matchesForRound(1);

      t = t.withMatchResult(wbFinal.id, 1);
      t = t.withMatchResult(cbFinal.id, 1);

      expect(t.isComplete()).toBe(true);
    });

    it('8 teams: WB R1 complete → WB R2 (2 matches) + CB R1 (2 matches)', () => {
      const teams = createTournamentTeams(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
      let t = EliminationTournament.create().start(teams, 4);
      for (const m of t.winners.matchesForRound(1)) {
        t = t.withMatchResult(m.id, 1);
      }
      expect(t.winners.matchesForRound(2)).toHaveLength(2);
      expect(t.consolation.matchesForRound(1)).toHaveLength(2);
    });

    it('8 teams: WB R2 complete → WB R3 (1 match) + CB R2 (1 match)', () => {
      const teams = createTournamentTeams(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
      let t = EliminationTournament.create().start(teams, 4);
      for (const m of t.winners.matchesForRound(1)) t = t.withMatchResult(m.id, 1);
      for (const m of t.winners.matchesForRound(2)) t = t.withMatchResult(m.id, 1);
      for (const m of t.consolation.matchesForRound(1)) t = t.withMatchResult(m.id, 1);
      expect(t.winners.matchesForRound(3)).toHaveLength(1);
      expect(t.consolation.matchesForRound(2)).toHaveLength(1);
    });
  });

  describe('withMatchResult — bye handling', () => {
    it('5 teams: WB R1 produces 2 matches; bye-advance team skips to WB R2', () => {
      const teams = createTournamentTeams(['A', 'B', 'C', 'D', 'E']);
      let t = EliminationTournament.create().start(teams, 4);
      expect(t.winners.matchesForRound(1)).toHaveLength(2);

      const [m0, m1] = t.winners.matchesForRound(1);
      t = t.withMatchResult(m0.id, 1);
      t = t.withMatchResult(m1.id, 1);

      const r2 = t.winners.matchesForRound(2);
      expect(r2.length).toBeGreaterThanOrEqual(1);
    });

    it('5 teams: full play-through — CB has 2 rounds (R1 + Final fed by WB Semi-Final loser)', () => {
      const [A, B, C, D, E] = createTournamentTeams(['A', 'B', 'C', 'D', 'E']);
      let t = EliminationTournament.create().start([A, B, C, D, E], 4);
      expect(t.winners.matchesForRound(1)).toHaveLength(2);

      const [m0, m1] = t.winners.matchesForRound(1);
      t = t.withMatchResult(m0.id, 1);
      t = t.withMatchResult(m1.id, 1);

      expect(t.winners.matchesForRound(2)).toHaveLength(1);
      expect(t.consolation.matchesForRound(1)).toHaveLength(1);
      expect(t.consolation.matchesForRound(2)).toHaveLength(0);

      const [cbR1] = t.consolation.matchesForRound(1);
      t = t.withMatchResult(cbR1.id, 1);
      expect(t.consolation.matchesForRound(2)).toHaveLength(0);

      const [wbR2] = t.winners.matchesForRound(2);
      t = t.withMatchResult(wbR2.id, 1);
      expect(t.consolation.matchesForRound(2)).toHaveLength(1);

      const [cbFinal] = t.consolation.matchesForRound(2);
      t = t.withMatchResult(cbFinal.id, 1);

      expect(t.winners.matchesForRound(3)).toHaveLength(1);
      const [wbFinal] = t.winners.matchesForRound(3);
      t = t.withMatchResult(wbFinal.id, 1);

      expect(t.isComplete()).toBe(true);
      expect(t.phase()).toBe('completed');
      expect(t.calculateStandings()).toHaveLength(5);
    });

    it('3 teams: 1 WB R1 match; C (slot 2) gets bye-advance', () => {
      const [A, B, C] = createTournamentTeams(['A', 'B', 'C']);
      let t = EliminationTournament.create().start([A, B, C], 4);
      expect(t.winners.matchesForRound(1)).toHaveLength(1);

      const [m0] = t.winners.matchesForRound(1);
      t = t.withMatchResult(m0.id, 1);

      const r2 = t.winners.matchesForRound(2);
      expect(r2).toHaveLength(1);
      const teamIds = [r2[0].team1.id, r2[0].team2.id];
      expect(teamIds).toContain(A.id);
      expect(teamIds).toContain(C.id);
    });
  });

  describe('winners.firstRoundLosers', () => {
    it('returns empty before any results', () => {
      const t = EliminationTournament.create().start(createTournamentTeams(['A', 'B', 'C', 'D']), 4);
      expect(t.winners.firstRoundLosers()).toHaveLength(0);
    });

    it('returns losers in position order after WB R1 complete', () => {
      const [A, B, C, D] = createTournamentTeams(['A', 'B', 'C', 'D']);
      let t = EliminationTournament.create().start([A, B, C, D], 4);
      const [m0, m1] = t.winners.matchesForRound(1);
      t = t.withMatchResult(m0.id, 1);
      t = t.withMatchResult(m1.id, 1);
      const losers = t.winners.firstRoundLosers();
      expect(losers).toHaveLength(2);
      expect(losers[0].id).toBe(B.id);
      expect(losers[1].id).toBe(D.id);
    });
  });

  describe('calculateStandings', () => {
    it('all teams included even with no results', () => {
      const teams = createTournamentTeams(['A', 'B', 'C', 'D']);
      const t = EliminationTournament.create().start(teams, 4);
      const standings = t.calculateStandings();
      expect(standings).toHaveLength(4);
    });

    it('sorts by losses asc then wins desc', () => {
      const [A, B, C, D] = createTournamentTeams(['A', 'B', 'C', 'D']);
      let t = EliminationTournament.create().start([A, B, C, D], 4);
      const [m0, m1] = t.winners.matchesForRound(1);
      t = t.withMatchResult(m0.id, 1);
      t = t.withMatchResult(m1.id, 1);

      const standings = t.calculateStandings();
      const byId = Object.fromEntries(standings.map(r => [r.team.id, r]));

      expect(byId[A.id].lost).toBe(0);
      expect(byId[C.id].lost).toBe(0);
      expect(byId[B.id].lost).toBe(1);
      expect(byId[D.id].lost).toBe(1);

      const topTwo = standings.slice(0, 2).map(r => r.team.id);
      expect(topTwo).toContain(A.id);
      expect(topTwo).toContain(C.id);
    });
  });

  describe('completedRounds', () => {
    it('returns 0 when no matches have results', () => {
      const t = EliminationTournament.create().start(createTournamentTeams(['A', 'B', 'C', 'D']), 4);
      expect(t.completedRounds()).toBe(0);
    });

    it('returns 1 when WB R1 is fully done', () => {
      const teams = createTournamentTeams(['A', 'B', 'C', 'D']);
      let t = EliminationTournament.create().start(teams, 4);
      for (const m of t.winners.matchesForRound(1)) t = t.withMatchResult(m.id, 1);
      expect(t.completedRounds()).toBe(1);
    });

    it('does not advance past a partial round', () => {
      const [A, B, C, D] = createTournamentTeams(['A', 'B', 'C', 'D']);
      let t = EliminationTournament.create().start([A, B, C, D], 4);
      const [m0] = t.winners.matchesForRound(1);
      t = t.withMatchResult(m0.id, 1);
      expect(t.completedRounds()).toBe(0);
    });
  });

  describe('validate', () => {
    it('requires at least 2 teams', () => {
      const t = EliminationTournament.create();
      expect(t.validate([createTournamentTeam('a')], 'singles')).not.toBeNull();
    });

    it('accepts 2 or more teams for singles', () => {
      const t = EliminationTournament.create();
      expect(t.validate(createTournamentTeams(['A', 'B']), 'singles')).toBeNull();
    });

    it('requires exactly 2 players per team for doubles', () => {
      const t = EliminationTournament.create();
      const badTeam: TournamentTeam = {
        id: 'x',
        players: [createMockPlayer({ id: 'p1', name: 'P1' })],
      };
      expect(t.validate([badTeam, badTeam], 'doubles')).not.toBeNull();
    });
  });

  describe('fromState roundtrip', () => {
    it('restores an in-progress tournament from state', () => {
      const [A, B, C, D] = createTournamentTeams(['A', 'B', 'C', 'D']);
      let t = EliminationTournament.create().start([A, B, C, D], 4);
      const [m0] = t.winners.matchesForRound(1);
      t = t.withMatchResult(m0.id, 1);

      const restored = EliminationTournament.fromState(t.state());
      expect(restored.winners.matchesForRound(1)).toHaveLength(t.winners.matchesForRound(1).length);
      expect(restored.calculateStandings().map(r => r.team.id)).toEqual(
        t.calculateStandings().map(r => r.team.id),
      );
    });
  });
});
