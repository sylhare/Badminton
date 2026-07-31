import { beforeEach, describe, expect, it } from 'vitest';

import { LevelTracker } from '../../src/engines/LevelTracker';
import {
  DEFAULT_TOURNAMENT_WEIGHTS,
  resolveMatchImportance,
  tournamentToScoredGames,
} from '../../src/engines/levelAdapters';
import { LevelTrackerConfig } from '../../src/engines/levelTrackerConfig';
import type { Court, Player } from '../../src/types';
import { BracketKind } from '../../src/tournament/types';
import type { TournamentMatch, TournamentTeam } from '../../src/tournament/types';
import { RoundRobinTournament } from '../../src/tournament/RoundRobinTournament';
import { EliminationTournament } from '../../src/tournament/EliminationTournament';

function makePlayer(id: string, level?: number): Player {
  return { id, name: `Player ${id}`, isPresent: true, level };
}

function player(id: string, level: number): Player {
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
  return { courtNumber: 1, teams: { team1, team2 }, winner, score };
}

describe('LevelTracker', () => {
  let tracker: LevelTracker;
  beforeEach(() => { tracker = new LevelTracker(); });

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
      const [updated] = tracker.updatePlayersLevels([{ court }],[p1, p2]);
      const delta = Math.abs((updated.level ?? 50) - 50);
      expect(delta).toBeLessThan(10);
    });

    it('extreme mismatch upset (team1=[100] vs team2=[0], team2 wins 21-0): |delta| < 10', () => {
      const p1 = makePlayer('p1', 100);
      const p2 = makePlayer('p2', 0);
      const court = makeCourt([p1], [p2], 2, { team1: 0, team2: 21 });
      const result = tracker.updatePlayersLevels([{ court }],[p1, p2]);
      const p1Updated = result.find(p => p.id === 'p1')!;
      const delta = Math.abs((p1Updated.level ?? 100) - 100);
      expect(delta).toBeLessThan(10);
    });

    it('no score, equal teams: |delta| ≤ 2', () => {
      const p1 = makePlayer('p1', 50);
      const p2 = makePlayer('p2', 50);
      const court = makeCourt([p1], [p2], 1);
      const [updated] = tracker.updatePlayersLevels([{ court }],[p1, p2]);
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
      const [updated] = tracker.updatePlayersLevels([{ court }],[p1, p2]);
      expect(updated.averageScore).toBe(21);
      expect(updated.scoredGames).toBe(1);
    });

    it('caps the loser score at 20 to prevent deuce inflation', () => {
      const court = makeCourt([p1], [p2], 1, { team1: 23, team2: 21 });
      const result = tracker.updatePlayersLevels([{ court }],[p1, p2]);
      const p2Updated = result.find(p => p.id === 'p2')!;
      expect(p2Updated.averageScore).toBe(20);
      expect(p2Updated.scoredGames).toBe(1);
    });

    it('does not cap a normal loser score below 20', () => {
      const court = makeCourt([p1], [p2], 1, { team1: 21, team2: 15 });
      const result = tracker.updatePlayersLevels([{ court }],[p1, p2]);
      const p2Updated = result.find(p => p.id === 'p2')!;
      expect(p2Updated.averageScore).toBe(15);
    });

    it('uses fresh player level, not court-snapshot level, for Elo calculation', () => {
      const p1 = makePlayer('p1', 50);
      const p2 = makePlayer('p2', 50);
      const court = makeCourt([p1], [p2], 1, { team1: 21, team2: 10 });

      const p1Edited = { ...p1, level: 90 };
      const result = tracker.updatePlayersLevels([{ court }],[p1Edited, p2]);

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

      const after1 = tracker.updatePlayersLevels([{ court: c1 }], [p1, p2]);
      const after2 = tracker.updatePlayersLevels([{ court: c2 }], after1);

      const p2Final = after2.find(p => p.id === 'p2')!;
      expect(p2Final.averageScore).toBe(17.5);
      expect(p2Final.scoredGames).toBe(2);
    });
  });

  describe('updatePlayersLevels — importance weighting', () => {
    const winnerDeltaFor = (importance?: number): number => {
      const p1 = makePlayer('p1', 50);
      const p2 = makePlayer('p2', 50);
      const court = makeCourt([p1], [p2], 1, { team1: 21, team2: 15 });
      const result = tracker.updatePlayersLevels([{ court, importance }], [p1, p2]);
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
  const teamA = team('a', [player('a1', 40), player('a2', 60)]);
  const teamB = team('b', [player('b1', 55), player('b2', 45)]);
  const teamC = team('c', [player('c1', 50), player('c2', 50)]);

  function startTournament() {
    return RoundRobinTournament.create('doubles', 2).start([teamA, teamB, teamC], 2);
  }

  it('baseline is every participant deduped, snapshotting start-of-play levels', () => {
    const { baseline } = tournamentToScoredGames(startTournament());
    expect(baseline.map(p => p.id).sort()).toEqual(['a1', 'a2', 'b1', 'b2', 'c1', 'c2']);
    expect(baseline.find(p => p.id === 'a1')?.level).toBe(40);
    expect(baseline.find(p => p.id === 'b1')?.level).toBe(55);
  });

  it('includes only decided matches, mapped to court shape', () => {
    const tournament = startTournament();
    const firstMatch = tournament.matches()[0];
    const decided = tournament.withMatchResult(firstMatch.id, 1, { team1: 21, team2: 15 });

    const { games } = tournamentToScoredGames(decided);

    expect(games).toHaveLength(1);
    expect(games[0].court.winner).toBe(1);
    expect(games[0].court.score).toEqual({ team1: 21, team2: 15 });
    expect(games[0].court.teams?.team1.map(p => p.id)).toEqual(firstMatch.team1.players.map(p => p.id));
    expect(games[0].court.teams?.team2.map(p => p.id)).toEqual(firstMatch.team2.players.map(p => p.id));
  });

  it('returns no games before any result is entered', () => {
    expect(tournamentToScoredGames(startTournament()).games).toHaveLength(0);
  });

  it('orders decided matches by round then court number', () => {
    let tournament = startTournament();
    for (const match of tournament.matches()) {
      tournament = tournament.withMatchResult(match.id, 1, { team1: 21, team2: 10 });
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

  it('round-robin matches all keep the base weight (no bracket, no final boost)', () => {
    let tournament = startTournament();
    for (const match of tournament.matches()) {
      tournament = tournament.withMatchResult(match.id, 1, { team1: 21, team2: 10 });
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
    team1: team('t1', [player('a', 50)]), team2: team('t2', [player('b', 50)]),
    bracket: BracketKind.Winners,
  });

  it('boosts the winners-bracket final (last round)', () => {
    expect(resolveMatchImportance(wbMatch(3), 3)).toBe(DEFAULT_TOURNAMENT_WEIGHTS.finalMultiplier);
  });

  it('boosts the winners-bracket semi-final (second-to-last round)', () => {
    expect(resolveMatchImportance(wbMatch(2), 3)).toBe(DEFAULT_TOURNAMENT_WEIGHTS.semifinalMultiplier);
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
      team(`t${i}`, [player(`p${i}`, 50)]));
    let tournament = EliminationTournament.create('singles', 4).start(teams, 4);

    // Decide the whole bracket so every round (incl. the final) is present and decided.
    let guard = 0;
    while (!tournament.isComplete() && guard++ < 40) {
      const pending = tournament.matches().find(m => m.winner === undefined);
      if (!pending) break;
      tournament = tournament.withMatchResult(pending.id, 1, { team1: 21, team2: 10 });
    }

    const { games } = tournamentToScoredGames(tournament);
    const importances = new Set(games.map(g => g.importance!));

    expect(importances.has(DEFAULT_TOURNAMENT_WEIGHTS.finalMultiplier)).toBe(true);
    expect(importances.has(DEFAULT_TOURNAMENT_WEIGHTS.semifinalMultiplier)).toBe(true);
    expect(importances.has(LevelTrackerConfig.ELO_DEFAULT_IMPORTANCE)).toBe(true);
    expect(Math.max(...importances)).toBe(DEFAULT_TOURNAMENT_WEIGHTS.finalMultiplier);
  });
});
