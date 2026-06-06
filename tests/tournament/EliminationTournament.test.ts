import { describe, expect, it } from 'vitest';

import { EliminationTournament } from '../../src/tournament/EliminationTournament';
import { nextPowerOf2 } from '../../src/tournament/bracketTree';
import { createMockPlayer, createTournamentTeam, createTournamentTeams } from '../data/testFactories';
import { BracketKind } from '../../src/tournament/types';
import type { TournamentTeam } from '../../src/tournament/types';
import { playAllCBRounds, playFullTournament, playWBRound } from '../data/tournamentTestHelpers';

const NAMES = Array.from({ length: 32 }, (_, i) => `T${i + 1}`);

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

    it('all teams appear in first round matches with no duplicates', () => {
      const [A, B, C, D] = createTournamentTeams(['A', 'B', 'C', 'D']);
      const t = EliminationTournament.create().start([A, B, C, D], 4);
      const r1 = t.winners.matchesForRound(1);
      const allTeamIds = r1.flatMap(m => [m.team1.id, m.team2.id]);
      expect(new Set(allTeamIds)).toEqual(new Set([A.id, B.id, C.id, D.id]));
    });

    it('starts in active phase', () => {
      const teams = createTournamentTeams(['A', 'B']);
      const t = EliminationTournament.create().start(teams, 2);
      expect(t.phase()).toBe('active');
    });

    it('shuffles team order so repeated starts can produce different brackets', () => {
      const teams = createTournamentTeams(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
      const brackets = new Set<string>();
      for (let i = 0; i < 20; i++) {
        const t = EliminationTournament.create().start(teams, 4);
        brackets.add(t.winners.matchesForRound(1).map(m => `${m.team1.id}-${m.team2.id}`).join(','));
      }
      expect(brackets.size).toBeGreaterThan(1);
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

      expect(t.thirdPlaceMatch).toBeUndefined();
      expect(t.isComplete()).toBe(true);
      expect(t.phase()).toBe('completed');
      expect(t.calculateStandings()).toHaveLength(5);
    });

    it('3 teams: 1 WB R1 match; bye team advances to R2', () => {
      const [A, B, C] = createTournamentTeams(['A', 'B', 'C']);
      let t = EliminationTournament.create().start([A, B, C], 4);
      expect(t.winners.matchesForRound(1)).toHaveLength(1);

      const [m0] = t.winners.matchesForRound(1);
      const r1TeamIds = new Set([m0.team1.id, m0.team2.id]);
      const byeTeam = [A, B, C].find(team => !r1TeamIds.has(team.id))!;
      t = t.withMatchResult(m0.id, 1);

      const r2 = t.winners.matchesForRound(2);
      expect(r2).toHaveLength(1);
      const r2TeamIds = [r2[0].team1.id, r2[0].team2.id];
      expect(r2TeamIds).toContain(m0.team1.id);
      expect(r2TeamIds).toContain(byeTeam.id);
    });
  });

  describe('winners.firstRoundLosers', () => {
    it('returns empty before any results', () => {
      const t = EliminationTournament.create().start(createTournamentTeams(['A', 'B', 'C', 'D']), 4);
      expect(t.winners.firstRoundLosers()).toHaveLength(0);
    });

    it('returns losers after WB R1 complete', () => {
      const [A, B, C, D] = createTournamentTeams(['A', 'B', 'C', 'D']);
      let t = EliminationTournament.create().start([A, B, C, D], 4);
      const [m0, m1] = t.winners.matchesForRound(1);
      t = t.withMatchResult(m0.id, 1);
      t = t.withMatchResult(m1.id, 1);
      const losers = t.winners.firstRoundLosers();
      expect(losers).toHaveLength(2);
      const loserIds = new Set(losers.map(l => l.id));
      expect(loserIds).toEqual(new Set([m0.team2.id, m1.team2.id]));
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
      const winnerIds = new Set([m0.team1.id, m1.team1.id]);
      const loserIds = new Set([m0.team2.id, m1.team2.id]);

      for (const row of standings) {
        if (winnerIds.has(row.team.id)) expect(row.lost).toBe(0);
        if (loserIds.has(row.team.id)) expect(row.lost).toBe(1);
      }

      const topTwoIds = new Set(standings.slice(0, 2).map(r => r.team.id));
      expect(topTwoIds).toEqual(winnerIds);
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

  describe('3rd-place match', () => {
    it('3 teams (Case B): no 3rd-place match', () => {
      const [A, B, C] = createTournamentTeams(['A', 'B', 'C']);
      const t = playFullTournament(EliminationTournament.create().start([A, B, C], 4));
      expect(t.thirdPlaceMatch).toBeUndefined();
      expect(t.isComplete()).toBe(true);
    });

    it('4 teams (Case B): no 3rd-place match, CB winner is 3rd', () => {
      const teams = createTournamentTeams(['A', 'B', 'C', 'D']);
      const t = playFullTournament(EliminationTournament.create().start(teams, 4));

      expect(t.thirdPlaceMatch).toBeUndefined();
      expect(t.isComplete()).toBe(true);
      const standings = t.calculateStandings();
      const wbFinal = t.winners.matchesForRound(2)[0];
      const cbFinal = t.consolation.matchesForRound(1)[0];
      expect(standings[0].team.id).toBe(wbFinal.team1.id);
      expect(standings[1].team.id).toBe(wbFinal.team2.id);
      expect(standings[2].team.id).toBe(cbFinal.team1.id);
    });

    it('6 teams (Case E): single semi-final loser is 3rd, no 3rd-place match', () => {
      const teams = createTournamentTeams(['A', 'B', 'C', 'D', 'E', 'F']);
      let t = EliminationTournament.create().start(teams, 4);

      t = playWBRound(t, 1);
      t = playAllCBRounds(t);
      t = playWBRound(t, 2);
      t = playAllCBRounds(t);

      const semiFinal = t.winners.matchesForRound(t.totalRounds() - 1);
      expect(semiFinal).toHaveLength(1);
      const sfLoser = semiFinal[0].winner === 1 ? semiFinal[0].team2 : semiFinal[0].team1;

      t = playWBRound(t, 3);
      t = playAllCBRounds(t);

      expect(t.thirdPlaceMatch).toBeUndefined();
      expect(t.isComplete()).toBe(true);

      const standings = t.calculateStandings();
      const wbFinal = t.winners.matchesForRound(t.totalRounds())[0];
      expect(standings[0].team.id).toBe(wbFinal.team1.id);
      expect(standings[1].team.id).toBe(wbFinal.team2.id);
      expect(standings[2].team.id).toBe(sfLoser.id);
    });

    it.each(Array.from({ length: 28 }, (_, i) => i + 5))(
      '%i teams (size >= 8 has a real semi-final): finalists outrank eliminated semi-final losers before the final is played',
      (teamCount) => {
        const teams = createTournamentTeams(NAMES.slice(0, teamCount));
        let t = EliminationTournament.create().start(teams, 4);
        for (let r = 1; r < t.totalRounds(); r++) {
          t = playWBRound(t, r);
          t = playAllCBRounds(t);
        }

        const final = t.winners.matchesForRound(t.totalRounds())[0];
        expect(final.winner).toBeUndefined();

        const cbTeamIds = new Set(t.consolation.matches().flatMap(m => [m.team1.id, m.team2.id]));
        const eliminatedSfLosers = t.winners
          .matchesForRound(t.totalRounds() - 1)
          .map(m => (m.winner === 1 ? m.team2 : m.team1))
          .filter(team => !cbTeamIds.has(team.id));

        const standings = t.calculateStandings();
        const rank = (id: string) => standings.findIndex(r => r.team.id === id);
        const worstFinalist = Math.max(rank(final.team1.id), rank(final.team2.id));
        expect(eliminatedSfLosers.every(team => rank(team.id) > worstFinalist)).toBe(true);
      },
    );

    it('8 teams (Case F): two semi-final losers play for 3rd, CB winner is 5th', () => {
      const teams = createTournamentTeams(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
      let t = EliminationTournament.create().start(teams, 4);

      t = playWBRound(t, 1);
      t = playAllCBRounds(t);
      t = playWBRound(t, 2);
      t = playAllCBRounds(t);

      expect(t.thirdPlaceMatch).toBeDefined();
      expect(t.thirdPlaceMatch!.bracket).toBe(BracketKind.ThirdPlace);

      t = t.withMatchResult(t.thirdPlaceMatch!.id, 1);
      t = playWBRound(t, 3);
      t = playAllCBRounds(t);

      expect(t.isComplete()).toBe(true);
      const standings = t.calculateStandings();
      const wbFinal = t.winners.matchesForRound(t.totalRounds())[0];
      const tpWinner = t.thirdPlaceMatch!.team1;
      const tpLoser = t.thirdPlaceMatch!.team2;

      expect(standings[0].team.id).toBe(wbFinal.team1.id);
      expect(standings[1].team.id).toBe(wbFinal.team2.id);
      expect(standings[2].team.id).toBe(tpWinner.id);
      expect(standings[3].team.id).toBe(tpLoser.id);
    });

    it('10 teams: single semi-final loser is 3rd, no 3rd-place match for CB winner', () => {
      const teams = createTournamentTeams(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']);
      let t = EliminationTournament.create().start(teams, 4);

      t = playWBRound(t, 1);
      t = playAllCBRounds(t);
      t = playWBRound(t, 2);
      t = playAllCBRounds(t);
      t = playWBRound(t, 3);
      t = playAllCBRounds(t);

      expect(t.winners.matchesForRound(t.totalRounds() - 1)).toHaveLength(1);
      const semiFinal = t.winners.matchesForRound(t.totalRounds() - 1)[0];
      const sfLoser = semiFinal.winner === 1 ? semiFinal.team2 : semiFinal.team1;

      t = playWBRound(t, 4);
      t = playAllCBRounds(t);

      expect(t.thirdPlaceMatch).toBeUndefined();
      expect(t.isComplete()).toBe(true);

      const standings = t.calculateStandings();
      const wbFinal = t.winners.matchesForRound(t.totalRounds())[0];
      expect(standings[0].team.id).toBe(wbFinal.team1.id);
      expect(standings[1].team.id).toBe(wbFinal.team2.id);
      expect(standings[2].team.id).toBe(sfLoser.id);
    });
  });

  describe('3rd-place invariant across bracket sizes', () => {
    const COURT_COUNTS = [1, 2, 3, 4];
    const CASES = Array.from({ length: 31 }, (_, i) => i + 2)
      .flatMap(teamCount => COURT_COUNTS.map(courts => [teamCount, courts] as const));

    it.each(CASES)(
      '%i teams on %i courts: a 3rd-place match exists iff the semi-final round has two matches',
      (teamCount, courts) => {
        const teams = createTournamentTeams(NAMES.slice(0, teamCount));
        const t = playFullTournament(EliminationTournament.create().start(teams, courts));

        expect(t.isComplete()).toBe(true);
        const standings = t.calculateStandings();
        expect(standings).toHaveLength(teamCount);

        for (const m of t.matches()) {
          expect(m.courtNumber).toBeGreaterThanOrEqual(1);
          expect(m.courtNumber).toBeLessThanOrEqual(courts);
        }

        const semiFinalRound = t.totalRounds() - 1;
        const sfMatches = semiFinalRound >= 1 ? t.winners.matchesForRound(semiFinalRound) : [];

        const expectThirdPlace = semiFinalRound >= 2 && sfMatches.length === 2;
        expect(t.thirdPlaceMatch !== undefined).toBe(expectThirdPlace);

        const wbFinal = t.winners.matchesForRound(t.totalRounds())[0];
        if (wbFinal?.winner !== undefined) {
          const champion = wbFinal.winner === 1 ? wbFinal.team1 : wbFinal.team2;
          const runnerUp = wbFinal.winner === 1 ? wbFinal.team2 : wbFinal.team1;
          expect(standings[0].team.id).toBe(champion.id);
          expect(standings[1].team.id).toBe(runnerUp.id);
        }

        if (semiFinalRound >= 2 && sfMatches.length === 1) {
          const sf = sfMatches[0];
          const sfLoser = sf.winner === 1 ? sf.team2 : sf.team1;
          expect(standings[2].team.id).toBe(sfLoser.id);
        }
      },
    );
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

  describe('10-team tournament — CB final (odd CB seeds: 5 losers)', () => {
    function setup10Teams() {
      const teams = createTournamentTeams(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']);
      let t = EliminationTournament.create().start(teams, 4);
      t = playWBRound(t, 1);
      return t;
    }

    it('CB R1 seeds 2 matches leaving one bye-passer (L4)', () => {
      const t = setup10Teams();
      expect(t.consolation.matchesForRound(1)).toHaveLength(2);
      const cbR1Ids = new Set(
        t.consolation.matchesForRound(1).flatMap(m => [m.team1.id, m.team2.id]),
      );
      const byePasser = t.winners.firstRoundLosers().find(l => !cbR1Ids.has(l.id));
      expect(byePasser).toBeDefined();
    });

    it('CB R3 final pairs the CB R2 winner with the CB R1 bye-passer (not the WB SF loser)', () => {
      let t = setup10Teams();
      for (const m of t.consolation.matchesForRound(1)) t = t.withMatchResult(m.id, 1);
      for (const m of t.consolation.matchesForRound(2)) t = t.withMatchResult(m.id, 1);
      t = playWBRound(t, 2);
      t = playWBRound(t, 3);

      const cbR1Ids = new Set(
        t.consolation.matchesForRound(1).flatMap(m => [m.team1.id, m.team2.id]),
      );
      const byePasser = t.winners.firstRoundLosers().find(l => !cbR1Ids.has(l.id))!;
      const sfLoser = t.winners
        .matchesForRound(3)
        .map(m => (m.winner === 1 ? m.team2 : m.team1))[0];

      const cbR3 = t.consolation.matchesForRound(3);
      expect(cbR3).toHaveLength(1);

      const cbR3TeamIds = [cbR3[0].team1.id, cbR3[0].team2.id];
      expect(cbR3TeamIds).toContain(byePasser.id);
      expect(cbR3TeamIds).not.toContain(sfLoser.id);
    });

    it('10-team tournament completes correctly via normal play-through', () => {
      const teams = createTournamentTeams(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']);
      const t = playFullTournament(EliminationTournament.create().start(teams, 4));
      expect(t.isComplete()).toBe(true);
      expect(t.calculateStandings()).toHaveLength(10);
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
