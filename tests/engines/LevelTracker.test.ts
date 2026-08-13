import { beforeEach, describe, expect, it } from 'vitest';

import { levelTracker as tracker } from '../../src/engines/LevelTracker';
import { resolveMatchImportance, tournamentToScoredGames } from '../../src/engines/levelAdapters';
import { LevelTrackerConfig } from '../../src/engines/levelTrackerConfig';
import { MatchScore } from '../../src/scoring/MatchScore';
import type { Court, Player } from '../../src/types';
import { BracketKind } from '../../src/tournament/types';
import type { TournamentMatch, TournamentTeam } from '../../src/tournament/types';
import { RoundRobinTournament } from '../../src/tournament/RoundRobinTournament';
import { EliminationTournament } from '../../src/tournament/EliminationTournament';
import { GroupKnockoutTournament } from '../../src/tournament/GroupKnockoutTournament';

function makePlayer(id: string, level?: number): Player {
  return { id, name: `Player ${id}`, isPresent: true, level };
}

function team(id: string, players: Player[]): TournamentTeam {
  return { id, players };
}

function makeCourt(
  team1: Player[],
  team2: Player[],
  winner: 1 | 2,
  score?: { team1: number; team2: number },
): Court {
  return { courtNumber: 1, teams: { team1, team2 }, winner, sets: score ? [score] : [] };
}

describe('LevelTracker', () => {
  const update = (court: Court, players: Player[], importance?: number) =>
    tracker.updatePlayersLevels([{ court, importance }], players);

  describe('getKFactor', () => {
    it('returns K_DEFAULT when no score is provided', () => {
      expect(tracker.getKFactor()).toBe(LevelTrackerConfig.K_DEFAULT);
    });

    it('returns K_DEFAULT for a deuce win (winner score ≠ 21)', () => {
      expect(tracker.getKFactor({ team1: 23, team2: 21 }, 1)).toBe(LevelTrackerConfig.K_DEFAULT);
    });

    it('returns K_SCALE[0].k for a close win (loser 18–20)', () => {
      expect(tracker.getKFactor({ team1: 21, team2: 19 }, 1)).toBe(LevelTrackerConfig.K_SCALE[0].k);
    });

    it('returns K_SCALE[1].k for loser score 15–17', () => {
      expect(tracker.getKFactor({ team1: 21, team2: 16 }, 1)).toBe(LevelTrackerConfig.K_SCALE[1].k);
    });

    it('returns K_MAX for a dominant win (loser < 6)', () => {
      expect(tracker.getKFactor({ team1: 21, team2: 3 }, 1)).toBe(LevelTrackerConfig.K_MAX);
    });

    it('normalises a shorter match (15–13) so a close win scales like a game to 21', () => {
      expect(tracker.getKFactor({ team1: 15, team2: 13 }, 1)).toBe(LevelTrackerConfig.K_SCALE[0].k);
    });

    it('returns K_MAX for a dominant short match (15–2)', () => {
      expect(tracker.getKFactor({ team1: 15, team2: 2 }, 1)).toBe(LevelTrackerConfig.K_MAX);
    });

    it('normalises an 11-point match win (11–9)', () => {
      expect(tracker.getKFactor({ team1: 11, team2: 9 }, 1)).toBe(LevelTrackerConfig.K_SCALE[1].k);
    });

    it('scales K by balance factor for an unbalanced team', () => {
      const team = [makePlayer('a', 0), makePlayer('b', 100)];
      expect(tracker.getKFactor(undefined, undefined, team)).toBe(LevelTrackerConfig.K_DEFAULT * LevelTrackerConfig.BALANCE_FACTOR_FLOOR);
    });

    it('does not reduce K for a singles (1-player) team', () => {
      const team = [makePlayer('a', 80)];
      expect(tracker.getKFactor(undefined, undefined, team)).toBe(LevelTrackerConfig.K_DEFAULT);
    });
  });

  describe('max level swing', () => {
    it('equal teams, dominant win (21-0): |delta| < 10', () => {
      const p1 = makePlayer('p1', 50);
      const p2 = makePlayer('p2', 50);
      const court = makeCourt([p1], [p2], 1, { team1: 21, team2: 0 });
      const [updated] = update(court, [p1, p2]);
      const delta = Math.abs((updated.level ?? 50) - 50);
      expect(delta).toBeLessThan(10);
    });

    it('extreme mismatch upset (team1=[100] vs team2=[0], team2 wins 21-0): |delta| < 10', () => {
      const p1 = makePlayer('p1', 100);
      const p2 = makePlayer('p2', 0);
      const court = makeCourt([p1], [p2], 2, { team1: 0, team2: 21 });
      const result = update(court, [p1, p2]);
      const p1Updated = result.find(p => p.id === 'p1')!;
      const delta = Math.abs((p1Updated.level ?? 100) - 100);
      expect(delta).toBeLessThan(10);
    });

    it('no score, equal teams: |delta| ≤ 2', () => {
      const p1 = makePlayer('p1', 50);
      const p2 = makePlayer('p2', 50);
      const court = makeCourt([p1], [p2], 1);
      const [updated] = update(court, [p1, p2]);
      const delta = Math.abs((updated.level ?? 50) - 50);
      expect(delta).toBeLessThanOrEqual(2);
    });
  });

  describe('getLevelTrend', () => {
    it.each([
      ['no history',                    new Map(),                              null],
      ['single entry',                  new Map([['p1', [50]]]),                null],
      ['unchanged level',               new Map([['p1', [50, 50]]]),            null],
      ['level went up',                 new Map([['p1', [50, 51]]]),            'up'],
      ['level went down',               new Map([['p1', [50, 49]]]),            'down'],
      ['only last two entries matter',  new Map([['p1', [40, 60, 55]]]),        'down'],
    ] as const)('%s', (_label, history, expected) => {
      expect(tracker.getLevelTrend('p1', history)).toEqual(expected);
    });
  });

  describe('updatePlayersLevels — averageScore', () => {
    let p1: Player;
    let p2: Player;
    beforeEach(() => {
      p1 = makePlayer('p1', 50);
      p2 = makePlayer('p2', 50);
    });

    it('caps the winner score at 21', () => {
      const court = makeCourt([p1], [p2], 1, { team1: 23, team2: 21 });
      const [updated] = update(court, [p1, p2]);
      expect(updated.averageScore).toBe(21);
      expect(updated.scoredGames).toBe(1);
    });

    it('caps the loser score at 20 to prevent deuce inflation', () => {
      const court = makeCourt([p1], [p2], 1, { team1: 23, team2: 21 });
      const result = update(court, [p1, p2]);
      const p2Updated = result.find(p => p.id === 'p2')!;
      expect(p2Updated.averageScore).toBe(20);
      expect(p2Updated.scoredGames).toBe(1);
    });

    it('does not cap a normal loser score below 20', () => {
      const court = makeCourt([p1], [p2], 1, { team1: 21, team2: 15 });
      const result = update(court, [p1, p2]);
      const p2Updated = result.find(p => p.id === 'p2')!;
      expect(p2Updated.averageScore).toBe(15);
    });

    it('uses fresh player level, not court-snapshot level, for Elo calculation', () => {
      const p1 = makePlayer('p1', 50);
      const p2 = makePlayer('p2', 50);
      const court = makeCourt([p1], [p2], 1, { team1: 21, team2: 10 });

      const p1Edited = { ...p1, level: 90 };
      const result = update(court, [p1Edited, p2]);

      const p1Result = result.find(p => p.id === 'p1')!;
      const p2Result = result.find(p => p.id === 'p2')!;

      const p1Delta = (p1Result.level ?? 90) - 90;
      const p2Delta = (p2Result.level ?? 50) - 50;
      expect(p1Delta).toBeGreaterThan(0);
      expect(p1Delta).toBeLessThan(6);
      expect(p2Delta).toBeLessThan(0);
    });

    it('accumulates average score correctly across multiple games', () => {
      const c1 = makeCourt([p1], [p2], 1, { team1: 21, team2: 15 });
      const c2 = makeCourt([p1], [p2], 1, { team1: 23, team2: 21 });

      const after1 = update(c1, [p1, p2]);
      const after2 = update(c2, after1);

      const p2Final = after2.find(p => p.id === 'p2')!;
      expect(p2Final.averageScore).toBe(17.5);
      expect(p2Final.scoredGames).toBe(2);
    });

    it('normalises a larger set size to the reference length (a 30-point game reads like a 21)', () => {
      const court = makeCourt([p1], [p2], 1, { team1: 30, team2: 20 });
      const [winner, ...rest] = tracker.updatePlayersLevels([{ court, setSize: 30 }], [p1, p2]);
      const loser = rest.find(p => p.id === 'p2')!;
      expect(winner.averageScore).toBe(21);
      expect(loser.averageScore).toBe(14);
    });

    it('scales a shorter set size up to the reference length', () => {
      const court = makeCourt([p1], [p2], 1, { team1: 15, team2: 5 });
      const [winner] = tracker.updatePlayersLevels([{ court, setSize: 15 }], [p1, p2]);
      expect(winner.averageScore).toBe(21);
    });

    it('moves the winner level on a larger set size instead of collapsing to the deuce K-factor', () => {
      const p1Base = makePlayer('p1', 50);
      const p2Base = makePlayer('p2', 50);
      const scaled = tracker.updatePlayersLevels(
        [{ court: makeCourt([p1Base], [p2Base], 1, { team1: 30, team2: 4 }), setSize: 30 }],
        [p1Base, p2Base],
      );
      const reference = tracker.updatePlayersLevels(
        [{ court: makeCourt([p1Base], [p2Base], 1, { team1: 21, team2: 3 }) }],
        [p1Base, p2Base],
      );
      const delta = (list: Player[]) => (list.find(p => p.id === 'p1')!.level ?? 50) - 50;
      expect(delta(scaled)).toBeCloseTo(delta(reference), 5);
    });
  });

  describe('updatePlayersLevels — importance weighting', () => {
    const winnerDeltaFor = (importance?: number): number => {
      const p1 = makePlayer('p1', 50);
      const p2 = makePlayer('p2', 50);
      const court = makeCourt([p1], [p2], 1, { team1: 21, team2: 15 });
      const result = update(court, [p1, p2], importance);
      return (result.find(p => p.id === 'p1')!.level ?? 50) - 50;
    };

    it('importance 1 matches the unweighted (default) result — regression lock', () => {
      expect(winnerDeltaFor(1)).toBeCloseTo(winnerDeltaFor(undefined), 5);
    });

    it('scales the rating change linearly with importance', () => {
      expect(winnerDeltaFor(2)).toBeCloseTo(winnerDeltaFor(1) * 2, 5);
      expect(winnerDeltaFor(1.5)).toBeCloseTo(winnerDeltaFor(1) * 1.5, 5);
    });

    it('importance 0 freezes levels', () => {
      expect(winnerDeltaFor(0)).toBe(0);
    });
  });
});

describe('tournamentToScoredGames', () => {
  const teamA = team('a', [makePlayer('a1', 40), makePlayer('a2', 60)]);
  const teamB = team('b', [makePlayer('b1', 55), makePlayer('b2', 45)]);
  const teamC = team('c', [makePlayer('c1', 50), makePlayer('c2', 50)]);

  function startTournament() {
    return RoundRobinTournament.create({ format: 'doubles', numberOfCourts: 2 }).start([teamA, teamB, teamC], 2);
  }

  it('feeds the average set score (not the sum) so best-of-N keeps a meaningful K-factor', () => {
    const tournament = startTournament();
    const first = tournament.matches()[0];
    const decided = tournament.withMatchResult(first.id, 1, [
      { team1: 21, team2: 15 }, { team1: 21, team2: 18 },
    ]);
    const { games } = tournamentToScoredGames(decided);
    expect(MatchScore.of(games[0].court.sets ?? [], games[0].court.winner).eloScore())
      .toEqual({ team1: 21, team2: 17 });
  });

  it('replays group matches before the knockout and boosts the knockout final', () => {
    let t = GroupKnockoutTournament.create({ format: 'doubles', numberOfCourts: 2, bestOf: 1, groupSize: 2, qualifiersPerGroup: 1 })
      .start([teamA, teamB, teamC, team('d', [makePlayer('d1'), makePlayer('d2')])], 2);
    for (const id of t.groupMatches().map(m => m.id)) {
      t = t.withMatchResult(id, 1, [{ team1: 21, team2: 10 }]);
    }
    t = t.withMatchResult(t.knockoutMatches()[0].id, 1, [{ team1: 21, team2: 15 }]);

    const { games } = tournamentToScoredGames(t);
    expect(games).toHaveLength(3);
    expect(games[games.length - 1].importance).toBe(LevelTrackerConfig.WB_FINAL_IMPORTANCE);
    expect(games[0].importance).toBe(LevelTrackerConfig.ELO_DEFAULT_IMPORTANCE);
  });

  it('baseline is every participant deduped, snapshotting start-of-play levels', () => {
    const { baseline } = tournamentToScoredGames(startTournament());
    expect(baseline.map(p => p.id).sort()).toEqual(['a1', 'a2', 'b1', 'b2', 'c1', 'c2']);
    expect(baseline.find(p => p.id === 'a1')?.level).toBe(40);
    expect(baseline.find(p => p.id === 'b1')?.level).toBe(55);
  });

  it('includes only decided matches, mapped to court shape', () => {
    const tournament = startTournament();
    const firstMatch = tournament.matches()[0];
    const decided = tournament.withMatchResult(firstMatch.id, 1, [{ team1: 21, team2: 15 }]);

    const { games } = tournamentToScoredGames(decided);

    expect(games).toHaveLength(1);
    expect(games[0].court.winner).toBe(1);
    expect(games[0].court.sets).toEqual([{ team1: 21, team2: 15 }]);
    expect(games[0].court.teams?.team1.map(p => p.id)).toEqual(firstMatch.team1.players.map(p => p.id));
    expect(games[0].court.teams?.team2.map(p => p.id)).toEqual(firstMatch.team2.players.map(p => p.id));
  });

  it('returns no games before any result is entered', () => {
    expect(tournamentToScoredGames(startTournament()).games).toHaveLength(0);
  });

  it('orders decided matches by round then court number', () => {
    let tournament = startTournament();
    for (const match of tournament.matches()) {
      tournament = tournament.withMatchResult(match.id, 1, [{ team1: 21, team2: 10 }]);
    }
    const { games } = tournamentToScoredGames(tournament);

    const sig = (team1Ids: string[], team2Ids: string[]) => `${team1Ids.join()}|${team2Ids.join()}`;
    const expected = tournament.matches()
      .slice()
      .sort((a, b) => a.round - b.round || a.courtNumber - b.courtNumber)
      .map(m => sig(m.team1.players.map(p => p.id), m.team2.players.map(p => p.id)));
    const actual = games.map(g => sig(g.court.teams!.team1.map(p => p.id), g.court.teams!.team2.map(p => p.id)));

    expect(actual).toEqual(expected);
  });

  it('replays winners-bracket matches before consolation within the same round', () => {
    const decided = (id: string, courtNumber: number, bracket: BracketKind): TournamentMatch => ({
      id, round: 1, courtNumber, bracket, winner: 1, sets: [],
      team1: team(`${id}-a`, [makePlayer(`${id}-a`)]), team2: team(`${id}-b`, [makePlayer(`${id}-b`)]),
    });
    const cb = decided('cb', 1, BracketKind.Consolation);
    const wb = decided('wb', 2, BracketKind.Winners);
    const { games } = tournamentToScoredGames({
      teams: () => [cb.team1, cb.team2, wb.team1, wb.team2],
      totalRounds: () => 2,
      matches: () => [cb, wb],
      setSize: () => 21,
      state: () => ({ bracketSize: 4 }),
    } as never);

    expect(games.map(g => g.court.courtNumber)).toEqual([2, 1]);
  });

  it('orders winners, then consolation, then third-place within a round', () => {
    const decided = (id: string, bracket: BracketKind): TournamentMatch => ({
      id, round: 2, courtNumber: 1, bracket, winner: 1, sets: [],
      team1: team(`${id}-a`, [makePlayer(`${id}-a`)]), team2: team(`${id}-b`, [makePlayer(`${id}-b`)]),
    });
    const third = decided('tp', BracketKind.ThirdPlace);
    const cons = decided('cb', BracketKind.Consolation);
    const win = decided('wb', BracketKind.Winners);
    const { games } = tournamentToScoredGames({
      teams: () => [third, cons, win].flatMap(m => [m.team1, m.team2]),
      totalRounds: () => 2,
      matches: () => [third, cons, win],
      setSize: () => 21,
      state: () => ({ bracketSize: 4 }),
    } as never);

    expect(games.map(g => g.court.players[0].name)).toEqual(['Player wb-a', 'Player cb-a', 'Player tp-a']);
  });

  it('round-robin matches all keep the base weight (no bracket, no final boost)', () => {
    let tournament = startTournament();
    for (const match of tournament.matches()) {
      tournament = tournament.withMatchResult(match.id, 1, [{ team1: 21, team2: 10 }]);
    }
    const { games } = tournamentToScoredGames(tournament);
    for (const g of games) {
      expect(g.importance).toBe(LevelTrackerConfig.ELO_DEFAULT_IMPORTANCE);
    }
  });
});

describe('resolveMatchImportance', () => {
  const wbMatch = (round: number): TournamentMatch => ({
    id: `m${round}`, round, courtNumber: 1,
    team1: team('t1', [makePlayer('a', 50)]), team2: team('t2', [makePlayer('b', 50)]),
    bracket: BracketKind.Winners,
  });

  it('boosts the winners-bracket final (last round)', () => {
    expect(resolveMatchImportance(wbMatch(3), 3)).toBe(LevelTrackerConfig.WB_FINAL_IMPORTANCE);
  });

  it('boosts the winners-bracket semi-final (second-to-last round)', () => {
    expect(resolveMatchImportance(wbMatch(2), 3)).toBe(LevelTrackerConfig.WB_SEMIFINAL_IMPORTANCE);
  });

  it('leaves earlier winners rounds at the base weight', () => {
    expect(resolveMatchImportance(wbMatch(1), 3)).toBe(LevelTrackerConfig.ELO_DEFAULT_IMPORTANCE);
  });

  it('does not boost consolation/third-place matches in the final round', () => {
    const cbFinal: TournamentMatch = { ...wbMatch(3), bracket: BracketKind.Consolation };
    expect(resolveMatchImportance(cbFinal, 3)).toBe(LevelTrackerConfig.ELO_DEFAULT_IMPORTANCE);
  });

  it('does not boost bracketless (round-robin) matches', () => {
    const rrMatch: TournamentMatch = { ...wbMatch(3), bracket: undefined };
    expect(resolveMatchImportance(rrMatch, 3)).toBe(LevelTrackerConfig.ELO_DEFAULT_IMPORTANCE);
  });
});

describe('tournamentToScoredGames — elimination final weighting', () => {
  it('weights final > semi-final > early rounds across a full 8-team bracket', () => {
    const teams = Array.from({ length: 8 }, (_, i) =>
      team(`t${i}`, [makePlayer(`p${i}`, 50)]));
    let tournament = EliminationTournament.create({ format: 'singles', numberOfCourts: 4 }).start(teams, 4);

    let guard = 0;
    while (!tournament.isComplete() && guard++ < 40) {
      const pending = tournament.matches().find(m => m.winner === undefined);
      if (!pending) break;
      tournament = tournament.withMatchResult(pending.id, 1, [{ team1: 21, team2: 10 }]);
    }

    const { games } = tournamentToScoredGames(tournament);
    const importances = new Set(games.map(g => g.importance!));

    expect(importances.has(LevelTrackerConfig.WB_FINAL_IMPORTANCE)).toBe(true);
    expect(importances.has(LevelTrackerConfig.WB_SEMIFINAL_IMPORTANCE)).toBe(true);
    expect(importances.has(LevelTrackerConfig.ELO_DEFAULT_IMPORTANCE)).toBe(true);
    expect(Math.max(...importances)).toBe(LevelTrackerConfig.WB_FINAL_IMPORTANCE);
  });

  it('weights an incomplete bracket by its true final round, not the deepest played round', () => {
    const teams = Array.from({ length: 8 }, (_, i) => team(`t${i}`, [makePlayer(`p${i}`, 50)]));
    let tournament = EliminationTournament.create({ format: 'singles', numberOfCourts: 4 }).start(teams, 4);
    for (const m of tournament.winners.matchesForRound(1)) {
      tournament = tournament.withMatchResult(m.id, 1, [{ team1: 21, team2: 10 }]);
    }

    const { games } = tournamentToScoredGames(tournament);
    expect(games).toHaveLength(4);
    expect(games.every(g => g.importance === LevelTrackerConfig.ELO_DEFAULT_IMPORTANCE)).toBe(true);
  });
});
