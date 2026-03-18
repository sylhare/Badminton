import { describe, expect, it } from 'vitest';

import type { TournamentMatch, TournamentTeam } from '../../src/types/tournament';
import Tournament from '../../src/utils/Tournament';
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
  bracket?: TournamentMatch['bracket'],
): TournamentMatch {
  return { id, round, courtNumber: 1, team1, team2, winner, score, bracket };
}

// ---------------------------------------------------------------------------
// generateRoundRobinMatches (via Tournament.start)
// ---------------------------------------------------------------------------

describe('Tournament RR match generation', () => {
  it('produces 1 match for 2 teams', () => {
    const teams = [makeTeam('a', ['A']), makeTeam('b', ['B'])];
    const { matches } = Tournament.start(teams, 2, 'singles', 'round-robin').toState();
    expect(matches).toHaveLength(1);
    expect(matches[0].round).toBe(1);
  });

  it('produces 3 matches for 3 teams with no duplicate pairings', () => {
    const teams = [makeTeam('a', ['A']), makeTeam('b', ['B']), makeTeam('c', ['C'])];
    const { matches } = Tournament.start(teams, 2, 'singles', 'round-robin').toState();
    expect(matches).toHaveLength(3);

    const pairings = matches.map(m => [m.team1.id, m.team2.id].sort().join('|'));
    expect(new Set(pairings).size).toBe(3);
  });

  it('produces 6 matches for 4 teams', () => {
    const teams = [makeTeam('a', ['A']), makeTeam('b', ['B']), makeTeam('c', ['C']), makeTeam('d', ['D'])];
    const { matches } = Tournament.start(teams, 2, 'singles', 'round-robin').toState();
    expect(matches).toHaveLength(6);
  });

  it('has no duplicate pairings for 4 teams', () => {
    const teams = [makeTeam('a', ['A']), makeTeam('b', ['B']), makeTeam('c', ['C']), makeTeam('d', ['D'])];
    const { matches } = Tournament.start(teams, 4, 'singles', 'round-robin').toState();
    const pairings = matches.map(m => [m.team1.id, m.team2.id].sort().join('|'));
    expect(new Set(pairings).size).toBe(6);
  });

  it('cycles court numbers wrapping at numberOfCourts', () => {
    const teams = [makeTeam('a', ['A']), makeTeam('b', ['B']), makeTeam('c', ['C']), makeTeam('d', ['D'])];
    const { matches } = Tournament.start(teams, 2, 'singles', 'round-robin').toState();
    expect(matches.map(m => m.courtNumber)).toEqual([1, 2, 1, 2, 1, 2]);
  });

  it('assigns correct round numbers for 4 teams (3 rounds, 2 matches each)', () => {
    const teams = [makeTeam('a', ['A']), makeTeam('b', ['B']), makeTeam('c', ['C']), makeTeam('d', ['D'])];
    const { matches } = Tournament.start(teams, 4, 'singles', 'round-robin').toState();
    expect(matches.filter(m => m.round === 1)).toHaveLength(2);
    expect(matches.filter(m => m.round === 2)).toHaveLength(2);
    expect(matches.filter(m => m.round === 3)).toHaveLength(2);
  });

  it('handles 3 teams with bye correctly (3 rounds, 1 match each)', () => {
    const teams = [makeTeam('a', ['A']), makeTeam('b', ['B']), makeTeam('c', ['C'])];
    const { matches } = Tournament.start(teams, 1, 'singles', 'round-robin').toState();
    expect(matches).toHaveLength(3);
    for (const m of matches) {
      expect(m.team1.id).not.toBe('bye');
      expect(m.team2.id).not.toBe('bye');
    }
  });

  it('returns no matches for fewer than 2 teams', () => {
    expect(Tournament.start([], 2, 'singles', 'round-robin').toState().matches).toHaveLength(0);
    expect(
      Tournament.start([makeTeam('a', ['A'])], 2, 'singles', 'round-robin').toState().matches,
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getStandings (RR)
// ---------------------------------------------------------------------------

describe('Tournament.getStandings (round-robin)', () => {
  const teamA = makeTeam('a', ['Alice']);
  const teamB = makeTeam('b', ['Bob']);
  const teamC = makeTeam('c', ['Charlie']);

  function standings(
    teams: TournamentTeam[],
    matches: TournamentMatch[],
  ) {
    return Tournament.from({
      phase: 'active', format: 'singles', type: 'round-robin',
      numberOfCourts: 2, teams, matches,
    }).getStandings();
  }

  it('returns all zeros when no results', () => {
    const rows = standings([teamA, teamB], [makeMatch('m1', 1, teamA, teamB)]);
    for (const row of rows) {
      expect(row.played).toBe(0);
      expect(row.won).toBe(0);
      expect(row.points).toBe(0);
      expect(row.scoreDiff).toBe(0);
    }
  });

  it('correctly counts wins and losses from partial results', () => {
    const rows = standings(
      [teamA, teamB],
      [makeMatch('m1', 1, teamA, teamB, 1, { team1: 21, team2: 15 })],
    );
    const rowA = rows.find(r => r.team.id === 'a')!;
    const rowB = rows.find(r => r.team.id === 'b')!;
    expect(rowA.won).toBe(1);
    expect(rowA.points).toBe(2);
    expect(rowA.scoreDiff).toBe(6);
    expect(rowB.lost).toBe(1);
    expect(rowB.points).toBe(0);
    expect(rowB.scoreDiff).toBe(-6);
  });

  it('sorts by points descending', () => {
    const rows = standings(
      [teamA, teamB, teamC],
      [makeMatch('m1', 1, teamA, teamB, 1), makeMatch('m2', 1, teamA, teamC, 1)],
    );
    expect(rows[0].team.id).toBe('a');
  });

  it('breaks ties by scoreDiff', () => {
    const rows = standings(
      [teamA, teamB, teamC],
      [
        makeMatch('m1', 1, teamA, teamB, 1, { team1: 21, team2: 10 }),
        makeMatch('m2', 2, teamC, teamB, 1, { team1: 21, team2: 15 }),
      ],
    );
    expect(rows[0].team.id).toBe('a');
    expect(rows[1].team.id).toBe('c');
  });

  it('breaks ties by name when points and scoreDiff equal', () => {
    const rows = standings(
      [teamA, teamB, teamC],
      [makeMatch('m1', 1, teamA, teamB, 1), makeMatch('m2', 1, teamC, teamB, 2)],
    );
    const names = rows.map(r => r.team.players[0].name);
    expect(names[0]).toBe('Alice');
    expect(names[1]).toBe('Bob');
  });
});

// ---------------------------------------------------------------------------
// getCompletedRounds
// ---------------------------------------------------------------------------

describe('Tournament.getCompletedRounds', () => {
  const teamA = makeTeam('a', ['A']);
  const teamB = makeTeam('b', ['B']);
  const teamC = makeTeam('c', ['C']);

  function completedRounds(matches: TournamentMatch[]) {
    return Tournament.from({
      phase: 'active', format: 'singles', type: 'round-robin',
      numberOfCourts: 2, teams: [teamA, teamB, teamC], matches,
    }).getCompletedRounds();
  }

  it('returns 0 when no matches', () => {
    expect(Tournament.from({
      phase: 'active', format: 'singles', type: 'round-robin',
      numberOfCourts: 2, teams: [], matches: [],
    }).getCompletedRounds()).toBe(0);
  });

  it('returns 0 when no winners set', () => {
    expect(completedRounds([makeMatch('m1', 1, teamA, teamB)])).toBe(0);
  });

  it('returns 1 when round 1 is fully done but round 2 has unfinished matches', () => {
    expect(completedRounds([
      makeMatch('m1', 1, teamA, teamB, 1),
      makeMatch('m2', 2, teamA, teamC),
    ])).toBe(1);
  });

  it('does not advance past a partial round', () => {
    expect(completedRounds([
      makeMatch('m1', 1, teamA, teamB, 1),
      makeMatch('m2', 1, teamA, teamC),
      makeMatch('m3', 2, teamB, teamC, 2),
    ])).toBe(0);
  });

  it('returns total rounds when all complete', () => {
    expect(completedRounds([
      makeMatch('m1', 1, teamA, teamB, 1),
      makeMatch('m2', 2, teamA, teamC, 2),
      makeMatch('m3', 3, teamB, teamC, 1),
    ])).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// getTotalRounds
// ---------------------------------------------------------------------------

describe('Tournament.getTotalRounds', () => {
  const teamA = makeTeam('a', ['A']);
  const teamB = makeTeam('b', ['B']);

  it('returns 0 for a tournament with no matches', () => {
    expect(Tournament.from({
      phase: 'active', format: 'singles', type: 'round-robin',
      numberOfCourts: 2, teams: [], matches: [],
    }).getTotalRounds()).toBe(0);
  });

  it('returns max round number', () => {
    expect(Tournament.from({
      phase: 'active', format: 'singles', type: 'round-robin',
      numberOfCourts: 2, teams: [teamA, teamB],
      matches: [
        makeMatch('m1', 1, teamA, teamB),
        makeMatch('m2', 2, teamA, teamB),
        makeMatch('m3', 3, teamA, teamB),
      ],
    }).getTotalRounds()).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// validate
// ---------------------------------------------------------------------------

describe('Tournament.validate', () => {
  it('returns error for fewer than 2 teams', () => {
    expect(Tournament.validate([], 'singles')).not.toBeNull();
    expect(Tournament.validate([makeTeam('a', ['A'])], 'doubles')).not.toBeNull();
  });

  it('returns error for doubles team with 1 player', () => {
    const teams = [makeTeam('a', ['A']), makeTeam('b', ['B'])];
    expect(Tournament.validate(teams, 'doubles')).not.toBeNull();
  });

  it('returns null for valid singles setup', () => {
    const teams = [makeTeam('a', ['A']), makeTeam('b', ['B'])];
    expect(Tournament.validate(teams, 'singles')).toBeNull();
  });

  it('returns null for valid doubles setup', () => {
    const teams = [makeTeam('a', ['A', 'B']), makeTeam('b', ['C', 'D'])];
    expect(Tournament.validate(teams, 'doubles')).toBeNull();
  });

  it('allows singles teams with any player count', () => {
    const teams = [makeTeam('a', ['A']), makeTeam('b', ['B']), makeTeam('c', ['C'])];
    expect(Tournament.validate(teams, 'singles')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// createDoubleTeams
// ---------------------------------------------------------------------------

describe('Tournament.createDoubleTeams', () => {
  it('creates correct pairs for even count', () => {
    const players = [
      createMockPlayer({ id: 'p1', name: 'Alice' }),
      createMockPlayer({ id: 'p2', name: 'Bob' }),
      createMockPlayer({ id: 'p3', name: 'Carol' }),
      createMockPlayer({ id: 'p4', name: 'Dave' }),
    ];
    const teams = Tournament.createDoubleTeams(players);
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
    const teams = Tournament.createDoubleTeams(players);
    expect(teams).toHaveLength(2);
    expect(teams[0].players).toHaveLength(2);
    expect(teams[1].players).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// createSingleTeams
// ---------------------------------------------------------------------------

describe('Tournament.createSingleTeams', () => {
  it('wraps each player in their own team', () => {
    const players = [
      createMockPlayer({ id: 'p1', name: 'Alice' }),
      createMockPlayer({ id: 'p2', name: 'Bob' }),
    ];
    const teams = Tournament.createSingleTeams(players);
    expect(teams).toHaveLength(2);
    expect(teams[0].players[0].name).toBe('Alice');
    expect(teams[1].players[0].name).toBe('Bob');
  });
});

// ---------------------------------------------------------------------------
// DE first stage (via Tournament.start)
// ---------------------------------------------------------------------------

describe('Tournament DE first stage', () => {
  it('generates 2 WB matches for 4 teams with no bye', () => {
    const teams = [makeTeam('a', ['A']), makeTeam('b', ['B']), makeTeam('c', ['C']), makeTeam('d', ['D'])];
    const { matches, deBracket } = Tournament.start(teams, 2, 'singles', 'double-elimination').toState();
    expect(matches).toHaveLength(2);
    expect(matches.every(m => m.bracket === 'winners')).toBe(true);
    expect(matches.every(m => m.round === 1)).toBe(true);
    expect(deBracket!.wbSlots).toEqual(['a', 'b', 'c', 'd']);
    expect(deBracket!.lbSlots).toEqual([]);
  });

  it('generates 4 WB matches for 8 teams with no bye', () => {
    const teams = ['a','b','c','d','e','f','g','h'].map(id => makeTeam(id, [id.toUpperCase()]));
    const { matches, deBracket } = Tournament.start(teams, 4, 'singles', 'double-elimination').toState();
    expect(matches).toHaveLength(4);
    expect(deBracket!.wbSlots).toHaveLength(8);
    expect(deBracket!.lbSlots).toHaveLength(0);
  });

  it('gives a bye to the first team when odd count', () => {
    const teams = [makeTeam('a', ['A']), makeTeam('b', ['B']), makeTeam('c', ['C'])];
    const { matches, deBracket } = Tournament.start(teams, 2, 'singles', 'double-elimination').toState();
    expect(matches).toHaveLength(1);
    expect(matches[0].team1.id).toBe('b');
    expect(matches[0].team2.id).toBe('c');
    expect(deBracket!.wbSlots[0]).toBe('a');
  });

  it('cycles court numbers', () => {
    const teams = ['a','b','c','d'].map(id => makeTeam(id, [id]));
    const { matches } = Tournament.start(teams, 1, 'singles', 'double-elimination').toState();
    expect(matches.every(m => m.courtNumber === 1)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// DE progression (via recordResult)
// ---------------------------------------------------------------------------

describe('Tournament DE walkthrough — 4 teams', () => {
  const teamA = makeTeam('a', ['A']);
  const teamB = makeTeam('b', ['B']);
  const teamC = makeTeam('c', ['C']);
  const teamD = makeTeam('d', ['D']);
  const teams = [teamA, teamB, teamC, teamD];

  function findMatch(matches: TournamentMatch[], t1Id: string, t2Id: string) {
    return matches.find(m => m.team1.id === t1Id && m.team2.id === t2Id)!;
  }

  it('stage 2: generates WB R2 + LB R1 after WB R1 results', () => {
    let t = Tournament.start(teams, 2, 'singles', 'double-elimination');
    const r1 = t.toState().matches;
    t = t.recordResult(findMatch(r1, 'a', 'b').id, 1); // A beats B
    t = t.recordResult(findMatch(r1, 'c', 'd').id, 1); // C beats D

    const state = t.toState();
    const r2 = state.matches.filter(m => m.round === 2);
    const wbMatches = r2.filter(m => m.bracket === 'winners');
    const lbMatches = r2.filter(m => m.bracket === 'losers');

    expect(wbMatches).toHaveLength(1); // A vs C
    expect(lbMatches).toHaveLength(1); // B vs D
    expect(wbMatches[0].team1.id).toBe('a');
    expect(wbMatches[0].team2.id).toBe('c');
    expect(state.deBracket!.wbSlots).toEqual(['a', 'c']);
    expect(state.deBracket!.lbSlots).toContain('b');
    expect(state.deBracket!.lbSlots).toContain('d');
  });

  it('stage 3: generates LB R2 only when WB R2 produces 1 winner', () => {
    let t = Tournament.start(teams, 2, 'singles', 'double-elimination');

    // R1
    const r1 = t.toState().matches;
    t = t.recordResult(findMatch(r1, 'a', 'b').id, 1); // A beats B
    t = t.recordResult(findMatch(r1, 'c', 'd').id, 1); // C beats D

    // R2
    const r2 = t.toState().matches.filter(m => m.round === 2);
    t = t.recordResult(findMatch(r2, 'a', 'c').id, 1); // A beats C (WB R2)
    t = t.recordResult(r2.filter(m => m.bracket === 'losers')[0].id, 1); // B beats D (LB R1)

    const state = t.toState();
    const r3 = state.matches.filter(m => m.round === 3);

    expect(r3.filter(m => m.bracket === 'winners')).toHaveLength(0);
    expect(r3.filter(m => m.bracket === 'losers')).toHaveLength(1); // B vs C
    expect(state.deBracket!.wbSlots).toEqual(['a']);
  });

  it('stage 4: generates Grand Final when 1 WB + 1 LB champion', () => {
    let t = Tournament.start(teams, 2, 'singles', 'double-elimination');

    // R1
    const r1 = t.toState().matches;
    t = t.recordResult(findMatch(r1, 'a', 'b').id, 1); // A beats B
    t = t.recordResult(findMatch(r1, 'c', 'd').id, 1); // C beats D

    // R2
    const r2 = t.toState().matches.filter(m => m.round === 2);
    t = t.recordResult(findMatch(r2, 'a', 'c').id, 1); // A beats C
    t = t.recordResult(r2.filter(m => m.bracket === 'losers')[0].id, 1); // B beats D

    // R3 (B vs C)
    const r3 = t.toState().matches.filter(m => m.round === 3);
    t = t.recordResult(r3[0].id, 1); // B beats C

    const state = t.toState();
    const gf = state.matches.filter(m => m.bracket === 'grand-final');

    expect(gf).toHaveLength(1);
    expect(gf[0].team1.id).toBe('a');
    expect(gf[0].team2.id).toBe('b');
    expect(state.deBracket!.wbSlots).toEqual(['a']);
    expect(state.deBracket!.lbSlots).toContain('b');
  });
});

// ---------------------------------------------------------------------------
// isComplete
// ---------------------------------------------------------------------------

describe('Tournament.isComplete', () => {
  const teamA = makeTeam('a', ['A']);
  const teamB = makeTeam('b', ['B']);

  it('returns false for DE when no grand-final match exists', () => {
    const t = Tournament.from({
      phase: 'active', format: 'singles', type: 'double-elimination',
      numberOfCourts: 2, teams: [teamA, teamB],
      matches: [makeMatch('m1', 1, teamA, teamB, 1, undefined, 'winners')],
    });
    expect(t.isComplete()).toBe(false);
  });

  it('returns false for DE when grand-final has no winner yet', () => {
    const t = Tournament.from({
      phase: 'active', format: 'singles', type: 'double-elimination',
      numberOfCourts: 2, teams: [teamA, teamB],
      matches: [makeMatch('m1', 2, teamA, teamB, undefined, undefined, 'grand-final')],
    });
    expect(t.isComplete()).toBe(false);
  });

  it('returns true for DE when grand-final has a winner', () => {
    const t = Tournament.from({
      phase: 'active', format: 'singles', type: 'double-elimination',
      numberOfCourts: 2, teams: [teamA, teamB],
      matches: [makeMatch('m1', 2, teamA, teamB, 1, undefined, 'grand-final')],
    });
    expect(t.isComplete()).toBe(true);
  });

  it('returns false for RR when not all rounds complete', () => {
    const t = Tournament.from({
      phase: 'active', format: 'singles', type: 'round-robin',
      numberOfCourts: 2, teams: [teamA, teamB],
      matches: [makeMatch('m1', 1, teamA, teamB)],
    });
    expect(t.isComplete()).toBe(false);
  });

  it('returns true for RR when all rounds complete', () => {
    const t = Tournament.from({
      phase: 'active', format: 'singles', type: 'round-robin',
      numberOfCourts: 2, teams: [teamA, teamB],
      matches: [makeMatch('m1', 1, teamA, teamB, 1)],
    });
    expect(t.isComplete()).toBe(true);
  });
});
