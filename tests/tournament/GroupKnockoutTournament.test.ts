import { describe, expect, it } from 'vitest';

import { GroupKnockoutTournament } from '../../src/tournament/GroupKnockoutTournament';
import type { TournamentMatch } from '../../src/tournament/types';
import { createTournamentTeams } from '../data/testFactories';

/** Decide every currently-listed match, team1 winning by the given set score. */
function decideAll(
  tournament: GroupKnockoutTournament,
  score: { team1: number; team2: number } = { team1: 21, team2: 10 },
): GroupKnockoutTournament {
  let current = tournament;
  for (const id of current.matches().map(m => m.id)) {
    current = current.withMatchResult(id, 1, [score]);
  }
  return current;
}

/** Decide every match with the smaller-id team winning, giving each group a strict (tie-free) order. */
function decideStrict(tournament: GroupKnockoutTournament): GroupKnockoutTournament {
  let current = tournament;
  for (const { id, team1, team2 } of tournament.matches()) {
    const winner: 1 | 2 = team1.id < team2.id ? 1 : 2;
    const sets = winner === 1 ? [{ team1: 21, team2: 10 }] : [{ team1: 10, team2: 21 }];
    current = current.withMatchResult(id, winner, sets);
  }
  return current;
}

const start = (teamIds: string[], groupSize: number, qualifiersPerGroup: number) =>
  GroupKnockoutTournament
    .create({ format: 'doubles', numberOfCourts: 2, bestOf: 1, groupSize, qualifiersPerGroup })
    .start(createTournamentTeams(teamIds), 2);

describe('GroupKnockoutTournament — group phase', () => {
  describe('start', () => {
    it('splits 8 teams into two groups of four and tags every match with its group', () => {
      const t = start(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], 4, 2);
      const groupMatches = t.groupMatches();
      expect(t.groups().map(g => g.length)).toEqual([4, 4]);
      expect(groupMatches).toHaveLength(12);
      expect(groupMatches.every((m: TournamentMatch) => m.group !== undefined)).toBe(true);
    });

    it('phase is active and matches carry the best-of set model', () => {
      const t = start(['a', 'b', 'c', 'd'], 2, 1);
      expect(t.phase()).toBe('active');
      expect(t.matches().every(m => Array.isArray(m.sets))).toBe(true);
    });
  });

  describe('groups', () => {
    it('assigns every team to exactly one group', () => {
      const t = start(['a', 'b', 'c', 'd', 'e', 'f'], 3, 2);
      const ids = t.groups().flat().map(team => team.id).sort();
      expect(ids).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
      expect(t.groups()).toHaveLength(2);
    });
  });

  describe('groupPhaseComplete', () => {
    it('is false until every group match is decided, then true', () => {
      const t = start(['a', 'b', 'c', 'd'], 2, 1);
      expect(t.groupPhaseComplete()).toBe(false);
      expect(decideAll(t).groupPhaseComplete()).toBe(true);
    });
  });

  describe('groupStandings', () => {
    it('ranks the group winner first', () => {
      const decided = decideAll(start(['a', 'b', 'c', 'd'], 2, 1));
      for (let g = 0; g < decided.groups().length; g++) {
        const standings = decided.groupStandings(g);
        expect(standings[0].won).toBe(1);
        expect(standings[0].points).toBe(2);
        expect(standings[1].lost).toBe(1);
      }
    });
  });

  describe('qualifiers', () => {
    it('is empty until the group phase completes', () => {
      expect(start(['a', 'b', 'c', 'd'], 2, 1).qualifiers()).toEqual([]);
    });

    it('returns one qualifier per group when qualifiersPerGroup is 1', () => {
      const decided = decideAll(start(['a', 'b', 'c', 'd'], 2, 1));
      const qualifiers = decided.qualifiers();
      expect(qualifiers).toHaveLength(2);
      const groupWinners = decided.groups().map((_, g) => decided.groupStandings(g)[0].team.id).sort();
      expect(qualifiers.map(t => t.id).sort()).toEqual(groupWinners);
    });

    it('returns qualifiersPerGroup teams from each group', () => {
      const decided = decideAll(start(['a', 'b', 'c', 'd', 'e', 'f'], 3, 2));
      expect(decided.qualifiers()).toHaveLength(4);
    });
  });

  describe('knockout phase', () => {
    it('auto-seeds the knockout bracket when the group phase completes', () => {
      const decided = decideAll(start(['a', 'b', 'c', 'd'], 2, 1));
      expect(decided.knockoutStarted()).toBe(true);
      expect(decided.knockoutMatches()).toHaveLength(1);
      expect(decided.isComplete()).toBe(false);
    });

    it('seeds the knockout final with the two group winners', () => {
      const decided = decideAll(start(['a', 'b', 'c', 'd'], 2, 1));
      const winners = decided.groups().map((_, g) => decided.groupStandings(g)[0].team.id).sort();
      const final = decided.knockoutMatches()[0];
      expect([final.team1.id, final.team2.id].sort()).toEqual(winners);
    });

    it('completes and marks the phase once the knockout final is decided', () => {
      let t = decideAll(start(['a', 'b', 'c', 'd'], 2, 1));
      const finalId = t.knockoutMatches()[0].id;
      t = t.withMatchResult(finalId, 1, [{ team1: 21, team2: 15 }]);
      expect(t.isComplete()).toBe(true);
      expect(t.phase()).toBe('completed');
    });

    it('builds a four-team knockout from two groups of four', () => {
      const decided = decideStrict(start(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], 4, 2));
      expect(decided.bracketSize()).toBe(4);
      expect(decided.knockoutMatches().filter(m => m.round === 1)).toHaveLength(2);
    });

    it('spans both phases in totalRounds once the knockout starts', () => {
      expect(decideAll(start(['a', 'b', 'c', 'd'], 2, 1)).totalRounds()).toBe(2);
    });

    it('never pairs two qualifiers from the same group in knockout round 1', () => {
      const t = decideStrict(start(
        ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'], 4, 2,
      ));
      expect(t.knockoutStarted()).toBe(true);
      const groups = t.groups();
      const groupOf = (id: string) => groups.findIndex(g => g.some(team => team.id === id));

      for (const m of t.knockoutMatches().filter(m => m.round === 1)) {
        expect(groupOf(m.team1.id)).not.toBe(groupOf(m.team2.id));
      }
    });

    it('gives knockout byes to group winners, not runners-up', () => {
      // 3 groups × top-2 = 6 qualifiers in an 8-bracket → 2 byes, which should go to top seeds.
      const t = decideStrict(start(
        ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'], 4, 2,
      ));
      const groups = t.groups();
      const isGroupWinner = (id: string) => groups.some((_, g) => t.groupStandings(g)[0]?.team.id === id);
      const r1Ids = new Set(t.knockoutMatches().filter(m => m.round === 1).flatMap(m => [m.team1.id, m.team2.id]));
      const byeTeams = t.qualifiers().filter(q => !r1Ids.has(q.id));

      expect(byeTeams.length).toBeGreaterThan(0);
      for (const bye of byeTeams) expect(isGroupWinner(bye.id)).toBe(true);
    });

    it('does not seed the knockout while the group phase is unfinished', () => {
      const t = start(['a', 'b', 'c', 'd', 'e', 'f'], 3, 2);
      expect(t.knockoutStarted()).toBe(false);
      expect(t.knockoutMatches()).toHaveLength(0);
    });

    it('completes at the group phase when fewer than two teams qualify', () => {
      const decided = decideAll(start(['a', 'b', 'c'], 4, 1));
      expect(decided.groupPhaseComplete()).toBe(true);
      expect(decided.knockoutStarted()).toBe(false);
      expect(decided.isComplete()).toBe(true);
      expect(decided.phase()).toBe('completed');
    });
  });

  describe('editing a group result after the knockout is seeded', () => {
    const groupAMatch = (t: GroupKnockoutTournament) => t.groupMatches().find(m => m.group === 0)!;

    it('rebuilds the bracket (dropping played knockout results) when the qualifier changes', () => {
      let t = decideAll(start(['a', 'b', 'c', 'd'], 2, 1));
      const finalId = t.knockoutMatches()[0].id;
      t = t.withMatchResult(finalId, 1, [{ team1: 21, team2: 15 }]);
      expect(t.isComplete()).toBe(true);

      const winnerBefore = t.groupStandings(0)[0].team.id;
      const reseeded = t.withMatchResult(groupAMatch(t).id, 2, [{ team1: 10, team2: 21 }]);

      expect(reseeded.groupStandings(0)[0].team.id).not.toBe(winnerBefore);
      expect(reseeded.knockoutMatches()).toHaveLength(1);
      expect(reseeded.knockoutMatches()[0].winner).toBeUndefined();
      expect([reseeded.knockoutMatches()[0].team1.id, reseeded.knockoutMatches()[0].team2.id])
        .not.toContain(winnerBefore);
      expect(reseeded.isComplete()).toBe(false);
    });

    it('preserves the played bracket when a group edit leaves the seeding unchanged', () => {
      let t = decideAll(start(['a', 'b', 'c', 'd'], 2, 1));
      const finalId = t.knockoutMatches()[0].id;
      t = t.withMatchResult(finalId, 1, [{ team1: 21, team2: 15 }]);

      const edited = t.withMatchResult(groupAMatch(t).id, 1, [{ team1: 21, team2: 3 }]);
      const finalAfter = edited.knockoutMatches().find(m => m.id === finalId);
      expect(finalAfter?.winner).toBe(1);
      expect(edited.isComplete()).toBe(true);
    });
  });
});

describe('GroupKnockoutTournament.validateConfig', () => {
  const teams = (n: number) =>
    createTournamentTeams(Array.from({ length: n }, (_, i) => String.fromCharCode(97 + i)));

  it('allows 3 qualifiers from a group of 4 (the reported false positive)', () => {
    expect(GroupKnockoutTournament.validateConfig(teams(4), 4, 3)).toBeNull();
  });

  it('allows uneven groups where a smaller group sends everyone but a larger one still cuts', () => {
    expect(GroupKnockoutTournament.validateConfig(teams(7), 4, 3)).toBeNull();
  });

  it('warns only when every team would advance', () => {
    expect(GroupKnockoutTournament.validateConfig(teams(6), 3, 3)).toMatch(/every team/i);
  });

  it('warns when too few teams would qualify for a knockout', () => {
    expect(GroupKnockoutTournament.validateConfig(teams(2), 2, 1)).toMatch(/too few/i);
  });
});

describe('GroupKnockoutTournament — final standings & manual order', () => {
  it('ranks the knockout champion first and tallies points across both phases', () => {
    let t = decideAll(start(['a', 'b', 'c', 'd'], 2, 1));
    const final = t.knockoutMatches()[0];
    t = t.withMatchResult(final.id, 1, [{ team1: 21, team2: 15 }]);

    const standings = t.overallStandings();
    expect(t.isComplete()).toBe(true);
    expect(standings).toHaveLength(4);
    expect(standings[0].team.id).toBe(final.team1.id);
    expect(standings[0].points).toBe(4);
  });

  it('holds the knockout while a boundary tie is unresolved, then seeds it once broken by hand', () => {
    const decided = decideAll(start(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], 4, 2));
    expect(decided.knockoutStarted()).toBe(false);
    expect(decided.qualifiers()).toEqual([]);

    const tie0 = decided.groupStandings(0).slice(1).map(r => r.team.id);
    const promoted = tie0[tie0.length - 1];
    let resolved = decided.withManualOrder([promoted, ...tie0.slice(0, -1)]);
    expect(resolved.knockoutStarted()).toBe(false);

    const tie1 = resolved.groupStandings(1).slice(1).map(r => r.team.id);
    resolved = resolved.withManualOrder(tie1);

    expect(resolved.knockoutStarted()).toBe(true);
    expect(resolved.bracketSize()).toBe(4);
    expect(resolved.qualifiers().map(q => q.id)).toContain(promoted);
    expect(resolved.knockoutMatches().every(m => m.winner === undefined)).toBe(true);
  });

  it('clears a hand-set tie order when a group result later changes, but keeps it on a re-confirm', () => {
    let t = decideAll(start(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], 4, 2));
    t = t.withManualOrder(t.groupStandings(0).slice(1).map(r => r.team.id));
    expect(t.state().manualPoints).toBeDefined();

    const groupMatch = t.groupMatches().find(m => m.group === 0)!;
    const reconfirmed = t.withMatchResult(groupMatch.id, groupMatch.winner!, [{ team1: 21, team2: 10 }]);
    expect(reconfirmed.state().manualPoints).toBeDefined();

    const flipped = t.withMatchResult(groupMatch.id, groupMatch.winner === 1 ? 2 : 1, [{ team1: 10, team2: 21 }]);
    expect(flipped.state().manualPoints).toBeUndefined();
  });

  it('clears only the edited group’s manual order, preserving another group’s', () => {
    let t = decideAll(start(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], 4, 2));
    const groupATeamIds = new Set(t.groups()[0].map(team => team.id));
    t = t.withManualOrder(t.groupStandings(0).slice(1).map(r => r.team.id));
    t = t.withManualOrder(t.groupStandings(1).slice(1).map(r => r.team.id));

    const groupAMatch = t.groupMatches().find(m => m.group === 0)!;
    const edited = t.withMatchResult(groupAMatch.id, groupAMatch.winner === 1 ? 2 : 1, [{ team1: 10, team2: 21 }]);

    const remaining = edited.state().manualPoints ?? {};
    expect(Object.keys(remaining).length).toBeGreaterThan(0);
    expect(Object.keys(remaining).some(id => groupATeamIds.has(id))).toBe(false);
  });

  it('records a manual order and keeps the played bracket when qualifiers are unchanged', () => {
    const t = decideAll(start(['a', 'b', 'c', 'd'], 2, 1));
    const before = t.qualifiers().map(q => q.id);

    const reordered = t.withManualOrder(['unrelated-id']);
    expect(reordered.state().manualPoints).toEqual({ 'unrelated-id': 1 });
    expect(reordered.qualifiers().map(q => q.id)).toEqual(before);
    expect(reordered.knockoutMatches()).toHaveLength(t.knockoutMatches().length);
  });
});
