import { describe, expect, it } from 'vitest';

import type { TournamentMatch, TournamentTeam } from '../../src/types/tournament';
import {
  autoCreateDoubleTeams,
  autoCreateSingleTeams,
  calculateStandings,
  generateRoundRobinMatches,
  getCompletedRounds,
  getTotalRounds,
  validateTeams,
} from '../../src/utils/tournamentUtils';
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

describe('generateRoundRobinMatches', () => {
  it('produces 1 match for 2 teams', () => {
    const teams = [makeTeam('a', ['A']), makeTeam('b', ['B'])];
    const matches = generateRoundRobinMatches(teams, 2);
    expect(matches).toHaveLength(1);
    expect(matches[0].round).toBe(1);
  });

  it('produces 3 matches for 3 teams with no duplicate pairings', () => {
    const teams = [makeTeam('a', ['A']), makeTeam('b', ['B']), makeTeam('c', ['C'])];
    const matches = generateRoundRobinMatches(teams, 2);
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
    const matches = generateRoundRobinMatches(teams, 2);
    expect(matches).toHaveLength(6);
  });

  it('has no duplicate pairings for 4 teams', () => {
    const teams = [
      makeTeam('a', ['A']),
      makeTeam('b', ['B']),
      makeTeam('c', ['C']),
      makeTeam('d', ['D']),
    ];
    const matches = generateRoundRobinMatches(teams, 4);
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
    const matches = generateRoundRobinMatches(teams, 2);
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
    const matches = generateRoundRobinMatches(teams, 4);
    const rounds = matches.map(m => m.round);
    expect(rounds.filter(r => r === 1)).toHaveLength(2);
    expect(rounds.filter(r => r === 2)).toHaveLength(2);
    expect(rounds.filter(r => r === 3)).toHaveLength(2);
  });

  it('handles 3 teams with bye correctly (3 rounds, 1 match each)', () => {
    const teams = [makeTeam('a', ['A']), makeTeam('b', ['B']), makeTeam('c', ['C'])];
    const matches = generateRoundRobinMatches(teams, 1);
    expect(matches).toHaveLength(3);
    for (const m of matches) {
      expect(m.team1.id).not.toBe('bye');
      expect(m.team2.id).not.toBe('bye');
    }
  });

  it('returns empty array for fewer than 2 teams', () => {
    expect(generateRoundRobinMatches([], 2)).toHaveLength(0);
    expect(generateRoundRobinMatches([makeTeam('a', ['A'])], 2)).toHaveLength(0);
  });
});

describe('calculateStandings', () => {
  const teamA = makeTeam('a', ['Alice']);
  const teamB = makeTeam('b', ['Bob']);
  const teamC = makeTeam('c', ['Charlie']);

  it('returns all zeros when no results', () => {
    const matches = [makeMatch('m1', 1, teamA, teamB)];
    const standings = calculateStandings([teamA, teamB], matches);
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
    const standings = calculateStandings([teamA, teamB], matches);
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
    const standings = calculateStandings([teamA, teamB, teamC], matches);
    expect(standings[0].team.id).toBe('a');
  });

  it('breaks ties by scoreDiff', () => {
    const matches = [
      makeMatch('m1', 1, teamA, teamB, 1, { team1: 21, team2: 10 }),
      makeMatch('m2', 2, teamC, teamB, 1, { team1: 21, team2: 15 }),
    ];
    const standings = calculateStandings([teamA, teamB, teamC], matches);
    expect(standings[0].team.id).toBe('a');
    expect(standings[1].team.id).toBe('c');
  });

  it('breaks ties by name when points and scoreDiff equal', () => {
    const matches = [
      makeMatch('m1', 1, teamA, teamB, 1),
      makeMatch('m2', 1, teamC, teamB, 2),
    ];
    const standings = calculateStandings([teamA, teamB, teamC], matches);
    const names = standings.map(r => r.team.players[0].name);
    expect(names[0]).toBe('Alice');
    expect(names[1]).toBe('Bob');
  });
});

describe('getCompletedRounds', () => {
  const teamA = makeTeam('a', ['A']);
  const teamB = makeTeam('b', ['B']);
  const teamC = makeTeam('c', ['C']);

  it('returns 0 when no matches', () => {
    expect(getCompletedRounds([])).toBe(0);
  });

  it('returns 0 when no winners set', () => {
    const matches = [makeMatch('m1', 1, teamA, teamB)];
    expect(getCompletedRounds(matches)).toBe(0);
  });

  it('returns 1 when round 1 is fully done but round 2 has unfinished matches', () => {
    const matches = [
      makeMatch('m1', 1, teamA, teamB, 1),
      makeMatch('m2', 2, teamA, teamC),
    ];
    expect(getCompletedRounds(matches)).toBe(1);
  });

  it('does not advance past a partial round', () => {
    const matches = [
      makeMatch('m1', 1, teamA, teamB, 1),
      makeMatch('m2', 1, teamA, teamC),
      makeMatch('m3', 2, teamB, teamC, 2),
    ];
    expect(getCompletedRounds(matches)).toBe(0);
  });

  it('returns total rounds when all complete', () => {
    const matches = [
      makeMatch('m1', 1, teamA, teamB, 1),
      makeMatch('m2', 2, teamA, teamC, 2),
      makeMatch('m3', 3, teamB, teamC, 1),
    ];
    expect(getCompletedRounds(matches)).toBe(3);
  });
});

describe('getTotalRounds', () => {
  it('returns 0 for empty matches', () => {
    expect(getTotalRounds([])).toBe(0);
  });

  it('returns max round number', () => {
    const teamA = makeTeam('a', ['A']);
    const teamB = makeTeam('b', ['B']);
    const matches = [
      makeMatch('m1', 1, teamA, teamB),
      makeMatch('m2', 2, teamA, teamB),
      makeMatch('m3', 3, teamA, teamB),
    ];
    expect(getTotalRounds(matches)).toBe(3);
  });
});

describe('validateTeams', () => {
  it('returns error for fewer than 2 teams', () => {
    expect(validateTeams([], 'singles')).not.toBeNull();
    expect(validateTeams([makeTeam('a', ['A'])], 'doubles')).not.toBeNull();
  });

  it('returns error for doubles team with 1 player', () => {
    const teams = [makeTeam('a', ['A']), makeTeam('b', ['B'])];
    expect(validateTeams(teams, 'doubles')).not.toBeNull();
  });

  it('returns null for valid singles setup', () => {
    const teams = [makeTeam('a', ['A']), makeTeam('b', ['B'])];
    expect(validateTeams(teams, 'singles')).toBeNull();
  });

  it('returns null for valid doubles setup', () => {
    const teams = [
      makeTeam('a', ['A', 'B']),
      makeTeam('b', ['C', 'D']),
    ];
    expect(validateTeams(teams, 'doubles')).toBeNull();
  });

  it('allows singles teams with any player count', () => {
    const teams = [makeTeam('a', ['A']), makeTeam('b', ['B']), makeTeam('c', ['C'])];
    expect(validateTeams(teams, 'singles')).toBeNull();
  });
});

describe('autoCreateDoubleTeams', () => {
  it('creates correct pairs for even count', () => {
    const players = [
      createMockPlayer({ id: 'p1', name: 'Alice' }),
      createMockPlayer({ id: 'p2', name: 'Bob' }),
      createMockPlayer({ id: 'p3', name: 'Carol' }),
      createMockPlayer({ id: 'p4', name: 'Dave' }),
    ];
    const teams = autoCreateDoubleTeams(players);
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
    const teams = autoCreateDoubleTeams(players);
    expect(teams).toHaveLength(2);
    expect(teams[0].players).toHaveLength(2);
    expect(teams[1].players).toHaveLength(1);
  });
});

describe('autoCreateSingleTeams', () => {
  it('wraps each player in their own team', () => {
    const players = [
      createMockPlayer({ id: 'p1', name: 'Alice' }),
      createMockPlayer({ id: 'p2', name: 'Bob' }),
    ];
    const teams = autoCreateSingleTeams(players);
    expect(teams).toHaveLength(2);
    expect(teams[0].players[0].name).toBe('Alice');
    expect(teams[1].players[0].name).toBe('Bob');
  });
});
