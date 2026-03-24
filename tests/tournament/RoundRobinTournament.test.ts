import { describe, expect, it } from 'vitest';

import type { TournamentMatch, TournamentTeam } from '../../src/tournament/types';
import { RoundRobinTournament } from '../../src/tournament/RoundRobinTournament';
import { createMockPlayer } from '../data/testFactories';

function makeTeam(id: string, playerNames: string[]): TournamentTeam {
  return {
    id,
    players: playerNames.map((name, i) => createMockPlayer({ id: `${id}-p${i}`, name })),
  };
}

function makeMatch(
  id: string,
  round: number,
  team1: TournamentTeam,
  team2: TournamentTeam,
  winner?: 1 | 2,
  score?: { team1: number; team2: number },
): TournamentMatch {
  return { id, round, courtNumber: 1, team1, team2, winner, score };
}

describe('RoundRobinTournament.start (generateRoundRobinMatches)', () => {
  it('produces 1 match for 2 teams', () => {
    const teams = [makeTeam('a', ['A']), makeTeam('b', ['B'])];
    const tournament = RoundRobinTournament.create().start(teams, 2);
    expect(tournament.matches()).toHaveLength(1);
    expect(tournament.matches()[0].round).toBe(1);
  });

  it('produces 3 matches for 3 teams with no duplicate pairings', () => {
    const teams = [makeTeam('a', ['A']), makeTeam('b', ['B']), makeTeam('c', ['C'])];
    const matches = RoundRobinTournament.create().start(teams, 2).matches();
    expect(matches).toHaveLength(3);

    const pairings = matches.map(m => [m.team1.id, m.team2.id].sort().join('|'));
    const unique = new Set(pairings);
    expect(unique.size).toBe(3);
  });

  it('produces 6 matches for 4 teams', () => {
    const teams = [
      makeTeam('a', ['A']),
      makeTeam('b', ['B']),
      makeTeam('c', ['C']),
      makeTeam('d', ['D']),
    ];
    const matches = RoundRobinTournament.create().start(teams, 2).matches();
    expect(matches).toHaveLength(6);
  });

  it('has no duplicate pairings for 4 teams', () => {
    const teams = [
      makeTeam('a', ['A']),
      makeTeam('b', ['B']),
      makeTeam('c', ['C']),
      makeTeam('d', ['D']),
    ];
    const matches = RoundRobinTournament.create().start(teams, 4).matches();
    const pairings = matches.map(m => [m.team1.id, m.team2.id].sort().join('|'));
    expect(new Set(pairings).size).toBe(6);
  });

  it('cycles court numbers wrapping at numberOfCourts', () => {
    const teams = [
      makeTeam('a', ['A']),
      makeTeam('b', ['B']),
      makeTeam('c', ['C']),
      makeTeam('d', ['D']),
    ];
    const matches = RoundRobinTournament.create().start(teams, 2).matches();
    const courts = matches.map(m => m.courtNumber);
    expect(courts).toEqual([1, 2, 1, 2, 1, 2]);
  });

  it('assigns correct round numbers for 4 teams (3 rounds, 2 matches each)', () => {
    const teams = [
      makeTeam('a', ['A']),
      makeTeam('b', ['B']),
      makeTeam('c', ['C']),
      makeTeam('d', ['D']),
    ];
    const matches = RoundRobinTournament.create().start(teams, 4).matches();
    const rounds = matches.map(m => m.round);
    expect(rounds.filter(r => r === 1)).toHaveLength(2);
    expect(rounds.filter(r => r === 2)).toHaveLength(2);
    expect(rounds.filter(r => r === 3)).toHaveLength(2);
  });

  it('handles 3 teams with bye correctly (3 rounds, 1 match each)', () => {
    const teams = [makeTeam('a', ['A']), makeTeam('b', ['B']), makeTeam('c', ['C'])];
    const matches = RoundRobinTournament.create().start(teams, 1).matches();
    expect(matches).toHaveLength(3);
    for (const m of matches) {
      expect(m.team1.id).not.toBe('bye');
      expect(m.team2.id).not.toBe('bye');
    }
  });

  it('returns empty matches for fewer than 2 teams', () => {
    expect(RoundRobinTournament.create().start([], 2).matches()).toHaveLength(0);
    expect(RoundRobinTournament.create().start([makeTeam('a', ['A'])], 2).matches()).toHaveLength(0);
  });
});

describe('RoundRobinTournament.calculateStandings', () => {
  const teamA = makeTeam('a', ['Alice']);
  const teamB = makeTeam('b', ['Bob']);
  const teamC = makeTeam('c', ['Charlie']);

  function makeTournamentWithMatches(matches: TournamentMatch[], teams: TournamentTeam[]) {
    return RoundRobinTournament.fromState({
      phase: 'active',
      format: 'singles',
      type: 'round-robin',
      numberOfCourts: 1,
      teams,
      matches,
    });
  }

  it('returns all zeros when no results', () => {
    const matches = [makeMatch('m1', 1, teamA, teamB)];
    const standings = makeTournamentWithMatches(matches, [teamA, teamB]).calculateStandings();
    for (const row of standings) {
      expect(row.played).toBe(0);
      expect(row.won).toBe(0);
      expect(row.points).toBe(0);
      expect(row.scoreDiff).toBe(0);
    }
  });

  it('correctly counts wins and losses from partial results', () => {
    const matches = [
      makeMatch('m1', 1, teamA, teamB, 1, { team1: 21, team2: 15 }),
    ];
    const standings = makeTournamentWithMatches(matches, [teamA, teamB]).calculateStandings();
    const rowA = standings.find(r => r.team.id === 'a')!;
    const rowB = standings.find(r => r.team.id === 'b')!;
    expect(rowA.won).toBe(1);
    expect(rowA.points).toBe(2);
    expect(rowA.scoreDiff).toBe(6);
    expect(rowB.lost).toBe(1);
    expect(rowB.points).toBe(0);
    expect(rowB.scoreDiff).toBe(-6);
  });

  it('sorts by points descending', () => {
    const matches = [
      makeMatch('m1', 1, teamA, teamB, 1),
      makeMatch('m2', 1, teamA, teamC, 1),
    ];
    const standings = makeTournamentWithMatches(matches, [teamA, teamB, teamC]).calculateStandings();
    expect(standings[0].team.id).toBe('a');
  });

  it('breaks ties by scoreDiff', () => {
    const matches = [
      makeMatch('m1', 1, teamA, teamB, 1, { team1: 21, team2: 10 }),
      makeMatch('m2', 2, teamC, teamB, 1, { team1: 21, team2: 15 }),
    ];
    const standings = makeTournamentWithMatches(matches, [teamA, teamB, teamC]).calculateStandings();
    expect(standings[0].team.id).toBe('a');
    expect(standings[1].team.id).toBe('c');
  });

  it('breaks ties by name when points and scoreDiff equal', () => {
    const matches = [
      makeMatch('m1', 1, teamA, teamB, 1),
      makeMatch('m2', 1, teamC, teamB, 2),
    ];
    const standings = makeTournamentWithMatches(matches, [teamA, teamB, teamC]).calculateStandings();
    const names = standings.map(r => r.team.players[0].name);
    expect(names[0]).toBe('Alice');
    expect(names[1]).toBe('Bob');
  });
});

describe('RoundRobinTournament.completedRounds', () => {
  const teamA = makeTeam('a', ['A']);
  const teamB = makeTeam('b', ['B']);
  const teamC = makeTeam('c', ['C']);

  function makeTournamentWithMatches(matches: TournamentMatch[]) {
    return RoundRobinTournament.fromState({
      phase: 'active',
      format: 'singles',
      type: 'round-robin',
      numberOfCourts: 1,
      teams: [teamA, teamB, teamC],
      matches,
    });
  }

  it('returns 0 when no matches', () => {
    expect(makeTournamentWithMatches([]).completedRounds()).toBe(0);
  });

  it('returns 0 when no winners set', () => {
    const matches = [makeMatch('m1', 1, teamA, teamB)];
    expect(makeTournamentWithMatches(matches).completedRounds()).toBe(0);
  });

  it('returns 1 when round 1 is fully done but round 2 has unfinished matches', () => {
    const matches = [
      makeMatch('m1', 1, teamA, teamB, 1),
      makeMatch('m2', 2, teamA, teamC),
    ];
    expect(makeTournamentWithMatches(matches).completedRounds()).toBe(1);
  });

  it('does not advance past a partial round', () => {
    const matches = [
      makeMatch('m1', 1, teamA, teamB, 1),
      makeMatch('m2', 1, teamA, teamC),
      makeMatch('m3', 2, teamB, teamC, 2),
    ];
    expect(makeTournamentWithMatches(matches).completedRounds()).toBe(0);
  });

  it('returns total rounds when all complete', () => {
    const matches = [
      makeMatch('m1', 1, teamA, teamB, 1),
      makeMatch('m2', 2, teamA, teamC, 2),
      makeMatch('m3', 3, teamB, teamC, 1),
    ];
    expect(makeTournamentWithMatches(matches).completedRounds()).toBe(3);
  });
});

describe('RoundRobinTournament.totalRounds', () => {
  it('returns 0 for empty matches', () => {
    expect(RoundRobinTournament.fromState({
      phase: 'active',
      format: 'singles',
      type: 'round-robin',
      numberOfCourts: 1,
      teams: [],
      matches: [],
    }).totalRounds()).toBe(0);
  });

  it('returns max round number', () => {
    const teamA = makeTeam('a', ['A']);
    const teamB = makeTeam('b', ['B']);
    const matches = [
      makeMatch('m1', 1, teamA, teamB),
      makeMatch('m2', 2, teamA, teamB),
      makeMatch('m3', 3, teamA, teamB),
    ];
    expect(RoundRobinTournament.fromState({
      phase: 'active',
      format: 'singles',
      type: 'round-robin',
      numberOfCourts: 1,
      teams: [teamA, teamB],
      matches,
    }).totalRounds()).toBe(3);
  });
});

describe('RoundRobinTournament.validate', () => {
  it('returns error for fewer than 2 teams', () => {
    const tournament = RoundRobinTournament.create();
    expect(tournament.validate([], 'singles')).not.toBeNull();
    expect(tournament.validate([makeTeam('a', ['A'])], 'doubles')).not.toBeNull();
  });

  it('returns error for doubles team with 1 player', () => {
    const tournament = RoundRobinTournament.create();
    const teams = [makeTeam('a', ['A']), makeTeam('b', ['B'])];
    expect(tournament.validate(teams, 'doubles')).not.toBeNull();
  });

  it('returns null for valid singles setup', () => {
    const tournament = RoundRobinTournament.create();
    const teams = [makeTeam('a', ['A']), makeTeam('b', ['B'])];
    expect(tournament.validate(teams, 'singles')).toBeNull();
  });

  it('returns null for valid doubles setup', () => {
    const tournament = RoundRobinTournament.create();
    const teams = [
      makeTeam('a', ['A', 'B']),
      makeTeam('b', ['C', 'D']),
    ];
    expect(tournament.validate(teams, 'doubles')).toBeNull();
  });

  it('allows singles teams with any player count', () => {
    const tournament = RoundRobinTournament.create();
    const teams = [makeTeam('a', ['A']), makeTeam('b', ['B']), makeTeam('c', ['C'])];
    expect(tournament.validate(teams, 'singles')).toBeNull();
  });
});

describe('RoundRobinTournament.createTeams (doubles)', () => {
  it('creates correct pairs for even count', () => {
    const players = [
      createMockPlayer({ id: 'p1', name: 'Alice' }),
      createMockPlayer({ id: 'p2', name: 'Bob' }),
      createMockPlayer({ id: 'p3', name: 'Carol' }),
      createMockPlayer({ id: 'p4', name: 'Dave' }),
    ];
    const teams = RoundRobinTournament.createTeams(players, 'doubles');
    expect(teams).toHaveLength(2);
    expect(teams[0].players.map(p => p.name)).toEqual(['Alice', 'Bob']);
    expect(teams[1].players.map(p => p.name)).toEqual(['Carol', 'Dave']);
  });

  it('creates incomplete last team for odd count', () => {
    const players = [
      createMockPlayer({ id: 'p1', name: 'Alice' }),
      createMockPlayer({ id: 'p2', name: 'Bob' }),
      createMockPlayer({ id: 'p3', name: 'Carol' }),
    ];
    const teams = RoundRobinTournament.createTeams(players, 'doubles');
    expect(teams).toHaveLength(2);
    expect(teams[0].players).toHaveLength(2);
    expect(teams[1].players).toHaveLength(1);
  });
});

describe('RoundRobinTournament.createTeams (singles)', () => {
  it('wraps each player in their own team', () => {
    const players = [
      createMockPlayer({ id: 'p1', name: 'Alice' }),
      createMockPlayer({ id: 'p2', name: 'Bob' }),
    ];
    const teams = RoundRobinTournament.createTeams(players, 'singles');
    expect(teams).toHaveLength(2);
    expect(teams[0].players[0].name).toBe('Alice');
    expect(teams[1].players[0].name).toBe('Bob');
  });
});

describe('RoundRobinTournament.withMatchResult', () => {
  it('returns a new instance with the match updated', () => {
    const teamA = makeTeam('a', ['Alice']);
    const teamB = makeTeam('b', ['Bob']);
    const match = makeMatch('m1', 1, teamA, teamB);
    const tournament = RoundRobinTournament.fromState({
      phase: 'active',
      format: 'singles',
      type: 'round-robin',
      numberOfCourts: 1,
      teams: [teamA, teamB],
      matches: [match],
    });

    const updated = tournament.withMatchResult('m1', 1, { team1: 21, team2: 15 });
    expect(updated).not.toBe(tournament);
    expect(updated).toBeInstanceOf(RoundRobinTournament);
    expect(updated.matches()[0].winner).toBe(1);
    expect(updated.matches()[0].score).toEqual({ team1: 21, team2: 15 });
    expect(tournament.matches()[0].winner).toBeUndefined();
  });
});

describe('RoundRobinTournament.roundNumbers / matchesForRound / isRoundComplete / isComplete / currentRound', () => {
  const teamA = makeTeam('a', ['A']);
  const teamB = makeTeam('b', ['B']);
  const teamC = makeTeam('c', ['C']);

  function makeTournament(matches: TournamentMatch[]) {
    return RoundRobinTournament.fromState({
      phase: 'active',
      format: 'singles',
      type: 'round-robin',
      numberOfCourts: 1,
      teams: [teamA, teamB, teamC],
      matches,
    });
  }

  it('roundNumbers returns sorted unique round numbers', () => {
    const t = makeTournament([
      makeMatch('m1', 1, teamA, teamB),
      makeMatch('m2', 3, teamA, teamC),
      makeMatch('m3', 2, teamB, teamC),
    ]);
    expect(t.roundNumbers()).toEqual([1, 2, 3]);
  });

  it('matchesForRound filters by round', () => {
    const t = makeTournament([
      makeMatch('m1', 1, teamA, teamB),
      makeMatch('m2', 1, teamA, teamC),
      makeMatch('m3', 2, teamB, teamC),
    ]);
    expect(t.matchesForRound(1)).toHaveLength(2);
    expect(t.matchesForRound(2)).toHaveLength(1);
    expect(t.matchesForRound(99)).toHaveLength(0);
  });

  it('isRoundComplete returns true when all matches in round have a winner', () => {
    const t = makeTournament([
      makeMatch('m1', 1, teamA, teamB, 1),
      makeMatch('m2', 2, teamA, teamC),
    ]);
    expect(t.isRoundComplete(1)).toBe(true);
    expect(t.isRoundComplete(2)).toBe(false);
  });

  it('isComplete returns false when some matches have no winner', () => {
    const t = makeTournament([
      makeMatch('m1', 1, teamA, teamB, 1),
      makeMatch('m2', 2, teamA, teamC),
    ]);
    expect(t.isComplete()).toBe(false);
  });

  it('isComplete returns true when all matches have a winner', () => {
    const t = makeTournament([
      makeMatch('m1', 1, teamA, teamB, 1),
      makeMatch('m2', 2, teamA, teamC, 2),
      makeMatch('m3', 3, teamB, teamC, 1),
    ]);
    expect(t.isComplete()).toBe(true);
  });

  it('isComplete returns false for empty matches', () => {
    expect(makeTournament([]).isComplete()).toBe(false);
  });

  it('currentRound returns first round with unfinished matches', () => {
    const t = makeTournament([
      makeMatch('m1', 1, teamA, teamB, 1),
      makeMatch('m2', 2, teamA, teamC),
      makeMatch('m3', 3, teamB, teamC),
    ]);
    expect(t.currentRound()).toBe(2);
  });

  it('currentRound returns last round when all complete', () => {
    const t = makeTournament([
      makeMatch('m1', 1, teamA, teamB, 1),
      makeMatch('m2', 2, teamA, teamC, 2),
      makeMatch('m3', 3, teamB, teamC, 1),
    ]);
    expect(t.currentRound()).toBe(3);
  });
});

describe('RoundRobinTournament.matchesPerRound', () => {
  it('returns floor of teams / 2', () => {
    const teams2 = [makeTeam('a', ['A']), makeTeam('b', ['B'])];
    const teams3 = [makeTeam('a', ['A']), makeTeam('b', ['B']), makeTeam('c', ['C'])];
    const teams4 = [makeTeam('a', ['A']), makeTeam('b', ['B']), makeTeam('c', ['C']), makeTeam('d', ['D'])];
    expect(RoundRobinTournament.matchesPerRound(teams2)).toBe(1);
    expect(RoundRobinTournament.matchesPerRound(teams3)).toBe(1);
    expect(RoundRobinTournament.matchesPerRound(teams4)).toBe(2);
  });
});
