import { describe, expect, it } from 'vitest';

import { EliminationTournament } from '../../src/tournament/EliminationTournament';
import { nextPowerOf2 } from '../../src/tournament/bracketTree';
import { createMockPlayer, createTournamentTeam, createTournamentTeams } from '../data/testFactories';
import { BracketKind } from '../../src/tournament/types';
import type { TournamentTeam } from '../../src/tournament/types';
import { playAllCBRounds, playFullTournament, playWBRound } from '../data/tournamentTestHelpers';

const NAMES = Array.from({ length: 32 }, (_, i) => `T${i + 1}`);

/** The decided consolation seeds (WB first-round losers), dropping slots still pending. */
const knownSeeds = (t: EliminationTournament): TournamentTeam[] =>
  t.consolation.seeds().filter((s): s is TournamentTeam => s !== null);

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

    it('5 teams → bracketSize=8, 1 WB R1 match (top 3 seeds get byes)', () => {
      const teams = createTournamentTeams(['A', 'B', 'C', 'D', 'E']);
      const t = EliminationTournament.create().start(teams, 4);
      expect(t.bracketSize()).toBe(8);
      expect(t.winners.matchesForRound(1)).toHaveLength(1);
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

    it('8 teams: a semi-final appears as soon as both of its feeder matches are decided', () => {
      const teams = createTournamentTeams(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
      let t = EliminationTournament.create().start(teams, 4);
      const [m0, m1, m2, m3] = t.winners.matchesForRound(1);

      t = t.withMatchResult(m0.id, 1);
      expect(t.winners.matchesForRound(2)).toHaveLength(0);

      t = t.withMatchResult(m1.id, 1);
      const r2 = t.winners.matchesForRound(2);
      expect(r2).toHaveLength(1);
      expect(new Set([r2[0].team1.id, r2[0].team2.id])).toEqual(new Set([m0.team1.id, m1.team1.id]));
      expect(t.consolation.matchesForRound(1)).toHaveLength(1);

      t = t.withMatchResult(m2.id, 1);
      expect(t.winners.matchesForRound(2)).toHaveLength(1);

      t = t.withMatchResult(m3.id, 1);
      expect(t.winners.matchesForRound(2)).toHaveLength(2);
      expect(t.consolation.matchesForRound(1)).toHaveLength(2);
    });

    it('8 teams: a decided semi-final does not duplicate when later results come in', () => {
      const teams = createTournamentTeams(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
      let t = EliminationTournament.create().start(teams, 4);
      const [m0, m1, m2, m3] = t.winners.matchesForRound(1);

      t = t.withMatchResult(m0.id, 1);
      t = t.withMatchResult(m1.id, 1);
      const [sf0] = t.winners.matchesForRound(2);
      t = t.withMatchResult(sf0.id, 1);

      t = t.withMatchResult(m2.id, 1);
      t = t.withMatchResult(m3.id, 1);

      const r2 = t.winners.matchesForRound(2);
      expect(r2).toHaveLength(2);
      expect(r2.filter(m => m.id === sf0.id)).toHaveLength(1);
      expect(t.winners.matchesForRound(3)).toHaveLength(0);
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
    it('5 teams: 1 WB R1 match; the seeded byes advance into WB R2', () => {
      const teams = createTournamentTeams(['A', 'B', 'C', 'D', 'E']);
      let t = EliminationTournament.create().start(teams, 4);
      expect(t.winners.matchesForRound(1)).toHaveLength(1);

      const [m0] = t.winners.matchesForRound(1);
      t = t.withMatchResult(m0.id, 1);

      expect(t.winners.matchesForRound(2).length).toBeGreaterThanOrEqual(1);
    });

    it('5 teams: full play-through completes with all five ranked', () => {
      const t = playFullTournament(EliminationTournament.create().start(createTournamentTeams(['A', 'B', 'C', 'D', 'E']), 4));
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

  describe('consolation bracket — per-pair seeding and stable tree', () => {
    function start8() {
      return EliminationTournament.create().start(
        createTournamentTeams(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']), 4,
      );
    }

    it('8 teams: a CB R1 match appears as soon as both paired WB R1 losers are known', () => {
      let t = start8();
      const [m0, m1, m2] = t.winners.matchesForRound(1);

      t = t.withMatchResult(m0.id, 1);
      expect(t.consolation.matchesForRound(1)).toHaveLength(0);

      t = t.withMatchResult(m1.id, 1);
      const cb1 = t.consolation.matchesForRound(1);
      expect(cb1).toHaveLength(1);
      expect(new Set([cb1[0].team1.id, cb1[0].team2.id])).toEqual(new Set([m0.team2.id, m1.team2.id]));

      t = t.withMatchResult(m2.id, 1);
      expect(t.consolation.matchesForRound(1)).toHaveLength(1);
    });

    it('8 teams: CB does not advance to R2 before WB R1 is fully decided', () => {
      let t = start8();
      const [m0, m1] = t.winners.matchesForRound(1);
      t = t.withMatchResult(m0.id, 1);
      t = t.withMatchResult(m1.id, 1);

      const [cb0] = t.consolation.matchesForRound(1);
      t = t.withMatchResult(cb0.id, 1);

      expect(t.consolation.matchesForRound(2)).toHaveLength(0);
    });

    it('8 teams: finishing WB R1 after early CB play completes CB R1 and unlocks CB R2', () => {
      let t = start8();
      const [m0, m1, m2, m3] = t.winners.matchesForRound(1);
      t = t.withMatchResult(m0.id, 1);
      t = t.withMatchResult(m1.id, 1);
      t = t.withMatchResult(t.consolation.matchesForRound(1)[0].id, 1);

      t = t.withMatchResult(m2.id, 1);
      t = t.withMatchResult(m3.id, 1);
      expect(t.consolation.matchesForRound(1)).toHaveLength(2);

      const pending = t.consolation.matchesForRound(1).find(m => m.winner === undefined)!;
      t = t.withMatchResult(pending.id, 1);
      const cb2 = t.consolation.matchesForRound(2);
      expect(cb2).toHaveLength(1);
      const cb1Winners = t.consolation.matchesForRound(1).map(m => m.winner === 1 ? m.team1.id : m.team2.id);
      expect(new Set([cb2[0].team1.id, cb2[0].team2.id])).toEqual(new Set(cb1Winners));
    });

    it('8 teams: CB tree keeps its final 2-round shape while WB R1 is partially decided', () => {
      let t = start8();
      const [m0, m1, m2] = t.winners.matchesForRound(1);

      t = t.withMatchResult(m0.id, 1);
      let tree = t.consolation.computeTree();
      expect(tree).toHaveLength(2);
      expect(tree[0].every(n => n.type === 'tbd')).toBe(true);

      t = t.withMatchResult(m1.id, 1);
      t = t.withMatchResult(m2.id, 1);
      tree = t.consolation.computeTree();
      expect(tree).toHaveLength(2);
      expect(tree[0][0].type).toBe('match');
      expect(tree[0][1].type).toBe('tbd');
    });
  });

  describe('consolation.seeds', () => {
    it('has no decided seeds before any results', () => {
      const t = EliminationTournament.create().start(createTournamentTeams(['A', 'B', 'C', 'D']), 4);
      expect(knownSeeds(t)).toHaveLength(0);
    });

    it('seeds the WB first-round losers after WB R1 completes', () => {
      const [A, B, C, D] = createTournamentTeams(['A', 'B', 'C', 'D']);
      let t = EliminationTournament.create().start([A, B, C, D], 4);
      const [m0, m1] = t.winners.matchesForRound(1);
      t = t.withMatchResult(m0.id, 1);
      t = t.withMatchResult(m1.id, 1);
      const losers = knownSeeds(t);
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

    it('6 teams: two semi-final losers play for 3rd, ahead of the consolation winner', () => {
      const teams = createTournamentTeams(['A', 'B', 'C', 'D', 'E', 'F']);
      const t = playFullTournament(EliminationTournament.create().start(teams, 4));

      expect(t.winners.matchesForRound(t.totalRounds() - 1)).toHaveLength(2);
      expect(t.thirdPlaceMatch).toBeDefined();
      expect(t.isComplete()).toBe(true);

      const standings = t.calculateStandings();
      const wbFinal = t.winners.matchesForRound(t.totalRounds())[0];
      const tp = t.thirdPlaceMatch!;
      const tpWinner = tp.winner === 1 ? tp.team1 : tp.team2;
      expect(standings[0].team.id).toBe(wbFinal.team1.id);
      expect(standings[1].team.id).toBe(wbFinal.team2.id);
      expect(standings[2].team.id).toBe(tpWinner.id);
      expect(standings).toHaveLength(6);
    });

    it('6 teams: semi-final losers go to the 3rd-place match, never the consolation bracket', () => {
      const teams = createTournamentTeams(['A', 'B', 'C', 'D', 'E', 'F']);
      const t = playFullTournament(EliminationTournament.create().start(teams, 4));

      const sfLoserIds = t.winners
        .matchesForRound(t.totalRounds() - 1)
        .map(m => (m.winner === 1 ? m.team2 : m.team1).id);
      expect(sfLoserIds).toHaveLength(2);
      expect(t.thirdPlaceMatch).toBeDefined();

      const cbTeamIds = new Set(t.consolation.matches().flatMap(m => [m.team1.id, m.team2.id]));
      for (const id of sfLoserIds) expect(cbTeamIds.has(id)).toBe(false);
    });

    it('6 teams: the consolation bracket is a single final, with no phantom TBD round', () => {
      const teams = createTournamentTeams(['A', 'B', 'C', 'D', 'E', 'F']);
      const t = playFullTournament(EliminationTournament.create().start(teams, 4));

      expect(t.consolation.totalRounds()).toBe(1);
      expect(t.consolation.computeTree()).toHaveLength(1);
      expect(t.consolation.matchesForRound(1)).toHaveLength(1);
      expect(t.consolation.matchesForRound(2)).toHaveLength(0);
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

    it('10 teams: two semi-final losers play for 3rd place', () => {
      const teams = createTournamentTeams(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']);
      const t = playFullTournament(EliminationTournament.create().start(teams, 4));

      expect(t.winners.matchesForRound(t.totalRounds() - 1)).toHaveLength(2);
      expect(t.thirdPlaceMatch).toBeDefined();
      expect(t.isComplete()).toBe(true);

      const standings = t.calculateStandings();
      const wbFinal = t.winners.matchesForRound(t.totalRounds())[0];
      const tp = t.thirdPlaceMatch!;
      const tpWinner = tp.winner === 1 ? tp.team1 : tp.team2;
      expect(standings[0].team.id).toBe(wbFinal.team1.id);
      expect(standings[1].team.id).toBe(wbFinal.team2.id);
      expect(standings[2].team.id).toBe(tpWinner.id);
      expect(standings).toHaveLength(10);
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

  describe('leaderboard ordering by elimination depth', () => {
    /** The winners-bracket round a team lost in; totalRounds + 1 for the never-beaten champion. */
    const wbLossRound = (t: EliminationTournament, teamId: string): number => {
      const lost = t.winners.matches().find(
        m => m.winner !== undefined && (m.winner === 1 ? m.team2.id : m.team1.id) === teamId,
      );
      return lost ? lost.round : t.totalRounds() + 1;
    };

    const cbChampion = (t: EliminationTournament): TournamentTeam => {
      const cbFinal = t.consolation.matches().reduce((p, c) => (c.round > p.round ? c : p));
      return cbFinal.winner === 1 ? cbFinal.team1 : cbFinal.team2;
    };

    it.each(Array.from({ length: 17 }, (_, i) => i + 4))(
      '%i teams: never ranks an earlier-eliminated team above a later-eliminated one',
      (teamCount) => {
        const teams = createTournamentTeams(NAMES.slice(0, teamCount));
        const t = playFullTournament(EliminationTournament.create().start(teams, 4));
        expect(t.isComplete()).toBe(true);

        const standings = t.calculateStandings();
        expect(standings).toHaveLength(teamCount);
        expect(new Set(standings.map(r => r.team.id)).size).toBe(teamCount);

        const depths = standings.map(r => wbLossRound(t, r.team.id));
        for (let i = 1; i < depths.length; i++) {
          expect(depths[i]).toBeLessThanOrEqual(depths[i - 1]);
        }
      },
    );

    it('16 teams: a quarter-final loser outranks the consolation-bracket champion', () => {
      const teams = createTournamentTeams(NAMES.slice(0, 16));
      const t = playFullTournament(EliminationTournament.create().start(teams, 4));
      expect(t.totalRounds()).toBe(4);

      const standings = t.calculateStandings();
      const rank = (id: string) => standings.findIndex(r => r.team.id === id);
      const champion = cbChampion(t);
      const quarterFinalLosers = t.winners.matchesForRound(2).map(m => (m.winner === 1 ? m.team2 : m.team1));

      expect(quarterFinalLosers.length).toBeGreaterThan(0);
      for (const loser of quarterFinalLosers) {
        expect(rank(loser.id)).toBeLessThan(rank(champion.id));
      }
    });

    it('16 teams: the consolation champion is the top-ranked first-round loser', () => {
      const teams = createTournamentTeams(NAMES.slice(0, 16));
      const t = playFullTournament(EliminationTournament.create().start(teams, 4));

      const standings = t.calculateStandings();
      const firstRoundLoserIds = new Set(
        t.winners.matchesForRound(1).map(m => (m.winner === 1 ? m.team2.id : m.team1.id)),
      );
      const topFirstRoundLoser = standings.find(r => firstRoundLoserIds.has(r.team.id))!;
      expect(topFirstRoundLoser.team.id).toBe(cbChampion(t).id);
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

  describe('10-team tournament — consolation bracket', () => {
    function setup10Teams() {
      const teams = createTournamentTeams(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']);
      let t = EliminationTournament.create().start(teams, 4);
      t = playWBRound(t, 1);
      return t;
    }

    it('seeds consolation round 1 from the two WB first-round losers', () => {
      const t = setup10Teams();
      const cbR1 = t.consolation.matchesForRound(1);
      expect(cbR1).toHaveLength(1);
      const loserIds = new Set(knownSeeds(t).map(l => l.id));
      for (const id of [cbR1[0].team1.id, cbR1[0].team2.id]) expect(loserIds.has(id)).toBe(true);
    });

    it('pulls deeper WB losers so the consolation bracket still runs to a single final', () => {
      const teams = createTournamentTeams(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']);
      const t = playFullTournament(EliminationTournament.create().start(teams, 4));
      expect(t.consolation.totalRounds()).toBe(3);
      expect(t.consolation.matches().every(m => m.winner !== undefined)).toBe(true);
      expect(t.consolation.matchesForRound(3)).toHaveLength(1);
    });

    it('10-team tournament completes correctly via normal play-through', () => {
      const teams = createTournamentTeams(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']);
      const t = playFullTournament(EliminationTournament.create().start(teams, 4));
      expect(t.isComplete()).toBe(true);
      expect(t.calculateStandings()).toHaveLength(10);
    });
  });

  describe('withMatchResult — changing a decided result', () => {
    function playWBRound1(teams: TournamentTeam[]) {
      let t = EliminationTournament.create().start(teams, 4);
      const [m0, m1] = t.winners.matchesForRound(1);
      t = t.withMatchResult(m0.id, 1);
      t = t.withMatchResult(m1.id, 1);
      return { t, m0, m1 };
    }

    it('regenerates the next WB round with the corrected winner', () => {
      const { t: played, m0 } = playWBRound1(createTournamentTeams(['A', 'B', 'C', 'D']));
      expect(played.winners.matchesForRound(2)).toHaveLength(1);

      const t = played.withMatchResult(m0.id, 2);

      const r2 = t.winners.matchesForRound(2);
      expect(r2).toHaveLength(1);
      const r2TeamIds = [r2[0].team1.id, r2[0].team2.id];
      expect(r2TeamIds).toContain(m0.team2.id);
      expect(r2TeamIds).not.toContain(m0.team1.id);
    });

    it('moves the new loser into the consolation bracket', () => {
      const { t: played, m0 } = playWBRound1(createTournamentTeams(['A', 'B', 'C', 'D']));

      const t = played.withMatchResult(m0.id, 2);

      const cb1 = t.consolation.matchesForRound(1);
      expect(cb1).toHaveLength(1);
      const cbTeamIds = [cb1[0].team1.id, cb1[0].team2.id];
      expect(cbTeamIds).toContain(m0.team1.id);
      expect(cbTeamIds).not.toContain(m0.team2.id);
    });

    it('discards dependent results so the tournament is no longer complete', () => {
      const { t: played, m0 } = playWBRound1(createTournamentTeams(['A', 'B', 'C', 'D']));
      let t = playAllCBRounds(playWBRound(played, 2));
      expect(t.isComplete()).toBe(true);

      t = t.withMatchResult(m0.id, 2);

      expect(t.isComplete()).toBe(false);
      expect(t.phase()).toBe('active');
      expect(t.winners.matchesForRound(2)[0].winner).toBeUndefined();
      expect(t.calculateStandings()).toHaveLength(4);
    });

    it('re-confirming the same winner keeps downstream matches intact', () => {
      const { t: played, m0 } = playWBRound1(createTournamentTeams(['A', 'B', 'C', 'D']));
      let t = playWBRound(played, 2);
      const r2Before = t.winners.matchesForRound(2)[0];

      t = t.withMatchResult(m0.id, 1);

      const r2After = t.winners.matchesForRound(2)[0];
      expect(r2After.id).toBe(r2Before.id);
      expect(r2After.winner).toBe(r2Before.winner);
    });

    it('changing a WB R2 result in an 8-team bracket keeps CB R1 results but resets later rounds', () => {
      const teams = createTournamentTeams(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
      let t = EliminationTournament.create().start(teams, 4);
      t = playWBRound(t, 1);
      t = playAllCBRounds(t);
      const cb1Before = t.consolation.matchesForRound(1);
      t = playWBRound(t, 2);
      const [sf0] = t.winners.matchesForRound(2);
      t = playWBRound(t, 3);
      expect(t.winners.matchesForRound(3)).toHaveLength(1);

      t = t.withMatchResult(sf0.id, 2);

      const cb1After = t.consolation.matchesForRound(1);
      expect(cb1After.map(m => m.winner)).toEqual(cb1Before.map(m => m.winner));
      const final = t.winners.matchesForRound(3);
      expect(final).toHaveLength(1);
      const finalTeamIds = [final[0].team1.id, final[0].team2.id];
      expect(finalTeamIds).toContain(sf0.team2.id);
      expect(finalTeamIds).not.toContain(sf0.team1.id);
      expect(final[0].winner).toBeUndefined();
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
