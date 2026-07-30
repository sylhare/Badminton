import { describe, expect, it } from 'vitest';

import type { Player } from '../../src/types';
import type { TournamentTeam } from '../../src/tournament/types';
import { BracketKind } from '../../src/tournament/types';
import { RoundRobinTournament } from '../../src/tournament/RoundRobinTournament';
import { EliminationTournament } from '../../src/tournament/EliminationTournament';
import {
  DEFAULT_TOURNAMENT_WEIGHTS,
  resolveMatchImportance,
  tournamentLevelInputs,
} from '../../src/tournament/tournamentLevels';
import type { TournamentMatch } from '../../src/tournament/types';

function player(id: string, level: number): Player {
  return { id, name: `Player ${id}`, isPresent: true, level };
}

function team(id: string, players: Player[]): TournamentTeam {
  return { id, players };
}

describe('tournamentLevelInputs', () => {
  const teamA = team('a', [player('a1', 40), player('a2', 60)]);
  const teamB = team('b', [player('b1', 55), player('b2', 45)]);
  const teamC = team('c', [player('c1', 50), player('c2', 50)]);

  function startTournament() {
    return RoundRobinTournament.create('doubles', 2).start([teamA, teamB, teamC], 2);
  }

  it('baseline is every participant deduped, snapshotting start-of-play levels', () => {
    const { baseline } = tournamentLevelInputs(startTournament());
    expect(baseline.map(p => p.id).sort()).toEqual(['a1', 'a2', 'b1', 'b2', 'c1', 'c2']);
    expect(baseline.find(p => p.id === 'a1')?.level).toBe(40);
    expect(baseline.find(p => p.id === 'b1')?.level).toBe(55);
  });

  it('includes only decided matches, mapped to court shape', () => {
    const tournament = startTournament();
    const firstMatch = tournament.matches()[0];
    const decided = tournament.withMatchResult(firstMatch.id, 1, { team1: 21, team2: 15 });

    const { games } = tournamentLevelInputs(decided);

    expect(games).toHaveLength(1);
    expect(games[0].court.winner).toBe(1);
    expect(games[0].court.score).toEqual({ team1: 21, team2: 15 });
    expect(games[0].court.teams?.team1.map(p => p.id)).toEqual(firstMatch.team1.players.map(p => p.id));
    expect(games[0].court.teams?.team2.map(p => p.id)).toEqual(firstMatch.team2.players.map(p => p.id));
  });

  it('returns no games before any result is entered', () => {
    expect(tournamentLevelInputs(startTournament()).games).toHaveLength(0);
  });

  it('orders decided matches by round then court number', () => {
    let tournament = startTournament();
    for (const match of tournament.matches()) {
      tournament = tournament.withMatchResult(match.id, 1, { team1: 21, team2: 10 });
    }
    const { games } = tournamentLevelInputs(tournament);

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
    const { games } = tournamentLevelInputs(tournament);
    for (const g of games) {
      expect(g.options?.importance).toBe(DEFAULT_TOURNAMENT_WEIGHTS.base);
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
    expect(resolveMatchImportance(wbMatch(1), 3)).toBe(DEFAULT_TOURNAMENT_WEIGHTS.base);
  });

  it('does not boost consolation/third-place matches in the final round', () => {
    const cbFinal: TournamentMatch = { ...wbMatch(3), bracket: BracketKind.Consolation };
    expect(resolveMatchImportance(cbFinal, 3)).toBe(DEFAULT_TOURNAMENT_WEIGHTS.base);
  });

  it('does not boost bracketless (round-robin) matches', () => {
    const rrMatch: TournamentMatch = { ...wbMatch(3), bracket: undefined };
    expect(resolveMatchImportance(rrMatch, 3)).toBe(DEFAULT_TOURNAMENT_WEIGHTS.base);
  });

  it('honours a custom weight config override end-to-end', () => {
    const custom = { base: 2, finalMultiplier: 3, semifinalMultiplier: 1 };
    expect(resolveMatchImportance(wbMatch(3), 3, custom)).toBe(6);
    expect(resolveMatchImportance(wbMatch(1), 3, custom)).toBe(2);
  });

  it('applies per-bracket multipliers when configured', () => {
    const custom = {
      ...DEFAULT_TOURNAMENT_WEIGHTS,
      bracketMultipliers: { [BracketKind.Consolation]: 0.5 },
    };
    const cbMatch: TournamentMatch = { ...wbMatch(1), bracket: BracketKind.Consolation };
    expect(resolveMatchImportance(cbMatch, 3, custom)).toBe(DEFAULT_TOURNAMENT_WEIGHTS.base * 0.5);
  });
});

describe('tournamentLevelInputs — elimination final weighting', () => {
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

    const { games } = tournamentLevelInputs(tournament);
    const importances = new Set(games.map(g => g.options!.importance!));

    expect(importances.has(DEFAULT_TOURNAMENT_WEIGHTS.finalMultiplier)).toBe(true);
    expect(importances.has(DEFAULT_TOURNAMENT_WEIGHTS.semifinalMultiplier)).toBe(true);
    expect(importances.has(DEFAULT_TOURNAMENT_WEIGHTS.base)).toBe(true);
    expect(Math.max(...importances)).toBe(DEFAULT_TOURNAMENT_WEIGHTS.finalMultiplier);
  });
});
