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
): TournamentMatch {
  return { id, round, courtNumber: 1, team1, team2, winner, score };
}

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

describe('Tournament.getTotalRounds', () => {
  const teamA = makeTeam('a', ['A']);
  const teamB = makeTeam('b', ['B']);

  it('returns 0 for a RR tournament with no matches', () => {
    expect(Tournament.from({
      phase: 'active', format: 'singles', type: 'round-robin',
      numberOfCourts: 2, teams: [], matches: [],
    }).getTotalRounds()).toBe(0);
  });

  it('returns max round number for RR', () => {
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

  it('returns log2(size) for SE regardless of matches generated', () => {
    const teams = [makeTeam('a', ['A']), makeTeam('b', ['B']), makeTeam('c', ['C']), makeTeam('d', ['D'])];
    const t = Tournament.start(teams, 2, 'singles', 'elimination');

    expect(t.getTotalRounds()).toBe(2);

    expect(t.getTotalRounds()).toBe(2);
  });
});

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

describe('Tournament SE first stage', () => {
  it('4 teams → size=4, 2 R1 matches, no nulls in seeding', () => {
    const teams = [makeTeam('a', ['A']), makeTeam('b', ['B']), makeTeam('c', ['C']), makeTeam('d', ['D'])];
    const { matches, seBracket } = Tournament.start(teams, 2, 'singles', 'elimination').toState();
    expect(seBracket!.size).toBe(4);
    expect(seBracket!.seeding).toHaveLength(4);
    expect(seBracket!.seeding.every(s => s !== null)).toBe(true);
    expect(matches).toHaveLength(2);
    expect(matches.every(m => m.round === 1)).toBe(true);
  });

  it('6 teams → size=8, seeding has 2 nulls (null-null pair), 3 R1 matches', () => {
    const teams = ['a','b','c','d','e','f'].map(id => makeTeam(id, [id.toUpperCase()]));
    const { matches, seBracket } = Tournament.start(teams, 4, 'singles', 'elimination').toState();
    expect(seBracket!.size).toBe(8);
    expect(seBracket!.seeding).toHaveLength(8);
    const nullCount = seBracket!.seeding.filter(s => s === null).length;
    expect(nullCount).toBe(2);
    expect(matches).toHaveLength(3);
    expect(matches.every(m => m.round === 1)).toBe(true);
  });

  it('3 teams → size=4, 1 R1 match + 1 bye pair', () => {
    const teams = [makeTeam('a', ['A']), makeTeam('b', ['B']), makeTeam('c', ['C'])];
    const { matches, seBracket } = Tournament.start(teams, 2, 'singles', 'elimination').toState();
    expect(seBracket!.size).toBe(4);
    expect(seBracket!.seeding).toHaveLength(4);
    const nullCount = seBracket!.seeding.filter(s => s === null).length;
    expect(nullCount).toBe(1);
    expect(matches).toHaveLength(1);
  });

  it('cycles court numbers', () => {
    const teams = ['a','b','c','d'].map(id => makeTeam(id, [id]));
    const { matches } = Tournament.start(teams, 1, 'singles', 'elimination').toState();
    expect(matches.every(m => m.courtNumber === 1)).toBe(true);
  });
});

describe('Tournament SE walkthrough — 4 teams', () => {
  const teamA = makeTeam('a', ['A']);
  const teamB = makeTeam('b', ['B']);
  const teamC = makeTeam('c', ['C']);
  const teamD = makeTeam('d', ['D']);
  const teams = [teamA, teamB, teamC, teamD];

  it('R1 results → R2 generated with correct matchup', () => {
    let t = Tournament.start(teams, 2, 'singles', 'elimination');
    const r1 = t.toState().matches;
    expect(r1).toHaveLength(2);

    t = t.recordResult(r1[0].id, 1);
    t = t.recordResult(r1[1].id, 1);

    const state = t.toState();
    const r2 = state.matches.filter(m => m.round === 2);
    expect(r2).toHaveLength(1);

    const r2Teams = [r2[0].team1.id, r2[0].team2.id].sort();
    expect(r2Teams).toContain('a');
    expect(r2Teams).toContain('c');
  });

  it('isComplete after consolation final (4-team walkthrough)', () => {
    let t = Tournament.start(teams, 2, 'singles', 'elimination');
    expect(t.isComplete()).toBe(false);

    const wb1 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'wb' && m.round === 1);
    t = t.recordResult(wb1[0].id, 1);
    t = t.recordResult(wb1[1].id, 1);
    expect(t.isComplete()).toBe(false);

    const wb2 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'wb' && m.round === 2);
    t = t.recordResult(wb2[0].id, 1);
    expect(t.isComplete()).toBe(false);

    const lb1 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'lb' && m.round === 1);
    t = t.recordResult(lb1[0].id, 1);
    
    expect(t.isComplete()).toBe(true);
    expect(t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'lb')).toHaveLength(1);
  });

  it('getTotalRounds returns 2 (log2(4)) from the start', () => {
    const t = Tournament.start(teams, 2, 'singles', 'elimination');
    expect(t.getTotalRounds()).toBe(2);
  });
});

describe('Tournament SE walkthrough — 6 teams', () => {
  const teams = ['a','b','c','d','e','f'].map(id => makeTeam(id, [id.toUpperCase()]));

  it('R1 has 3 matches (all 6 teams play)', () => {
    const { matches } = Tournament.start(teams, 4, 'singles', 'elimination').toState();
    expect(matches.filter(m => m.round === 1)).toHaveLength(3);
  });

  it('after R1, R2 has 1 match (2 R1 winners play; 3rd winner gets bye)', () => {
    let t = Tournament.start(teams, 4, 'singles', 'elimination');
    const r1 = t.toState().matches;
    expect(r1).toHaveLength(3);
    t = t.recordResult(r1[0].id, 1);
    t = t.recordResult(r1[1].id, 1);
    t = t.recordResult(r1[2].id, 1);

    const r2 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'wb' && m.round === 2);
    expect(r2).toHaveLength(1);
  });

  it('after R2, final (R3) is generated', () => {
    let t = Tournament.start(teams, 4, 'singles', 'elimination');
    const r1 = t.toState().matches;
    t = t.recordResult(r1[0].id, 1);
    t = t.recordResult(r1[1].id, 1);
    t = t.recordResult(r1[2].id, 1);

    const r2 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'wb' && m.round === 2);
    t = t.recordResult(r2[0].id, 1);

    const r3 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'wb' && m.round === 3);
    expect(r3).toHaveLength(1);
    expect(t.isComplete()).toBe(false);
  });

  it('isComplete after consolation final (6-team walkthrough)', () => {
    let t = Tournament.start(teams, 4, 'singles', 'elimination');

    // WB R1: 3 matches
    const wb1 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'wb' && m.round === 1);
    expect(wb1).toHaveLength(3);
    t = t.recordResult(wb1[0].id, 1);
    t = t.recordResult(wb1[1].id, 1);
    t = t.recordResult(wb1[2].id, 1);

    // WB R2: 1 match (W0 vs W1); W2 gets bye
    const wb2 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'wb' && m.round === 2);
    expect(wb2).toHaveLength(1);
    t = t.recordResult(wb2[0].id, 1);

    // LB R1: 1 match (L(R1m0) vs L(R1m1)); L(R1m2) exits
    const lb1 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'lb' && m.round === 1);
    expect(lb1).toHaveLength(1);
    t = t.recordResult(lb1[0].id, 1);

    // LB R2: 1 match triggered (LB-R1 survivor vs WB-R2 loser)
    const lb2 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'lb' && m.round === 2);
    expect(lb2).toHaveLength(1);

    // WB R3 (WBF): W(R2) vs W2-bye
    const wb3 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'wb' && m.round === 3);
    expect(wb3).toHaveLength(1);
    t = t.recordResult(wb3[0].id, 1);
    expect(t.isComplete()).toBe(false);

    t = t.recordResult(lb2[0].id, 1);
    expect(t.isComplete()).toBe(true);
    expect(t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'lb')).toHaveLength(2);
  });

  it('getTotalRounds returns 3 (log2(8)) from the start', () => {
    const t = Tournament.start(teams, 4, 'singles', 'elimination');
    expect(t.getTotalRounds()).toBe(3);
  });
});

describe('Consolation Bracket', () => {
  function makeTeams(names: string[]) {
    return names.map((name, i) => makeTeam(`team-${i}`, [name]));
  }

  it('4 teams: WB R1 losers appear in consolation R1', () => {
    const teams = makeTeams(['Alice', 'Bob', 'Carol', 'Dana']);
    let t = Tournament.start(teams, 2, 'singles', 'elimination');
    const wb1 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'wb' && m.round === 1);
    t = t.recordResult(wb1[0].id, 1);
    t = t.recordResult(wb1[1].id, 1);

    const lb1 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'lb' && m.round === 1);
    expect(lb1).toHaveLength(1);
    const loser1 = wb1[0].team2.id;
    const loser2 = wb1[1].team2.id;
    expect([lb1[0].team1.id, lb1[0].team2.id]).toContain(loser1);
    expect([lb1[0].team1.id, lb1[0].team2.id]).toContain(loser2);
  });

  it('4 teams: no consolation R2 (lbRounds=1)', () => {
    const teams = makeTeams(['Alice', 'Bob', 'Carol', 'Dana']);
    let t = Tournament.start(teams, 2, 'singles', 'elimination');
    const wb1 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'wb' && m.round === 1);
    t = t.recordResult(wb1[0].id, 1);
    t = t.recordResult(wb1[1].id, 1);
    const lb1 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'lb' && m.round === 1);
    t = t.recordResult(lb1[0].id, 1);
    const wb2 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'wb' && m.round === 2);
    t = t.recordResult(wb2[0].id, 1);

    const lb2 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'lb' && m.round === 2);
    expect(lb2).toHaveLength(0);
    expect(t.isComplete()).toBe(true);
  });

  it('4 teams: isComplete false until consolation final decided', () => {
    const teams = makeTeams(['Alice', 'Bob', 'Carol', 'Dana']);
    let t = Tournament.start(teams, 2, 'singles', 'elimination');
    const wb1 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'wb' && m.round === 1);
    t = t.recordResult(wb1[0].id, 1);
    t = t.recordResult(wb1[1].id, 1);
    const wb2 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'wb' && m.round === 2);
    t = t.recordResult(wb2[0].id, 1);

    expect(t.isComplete()).toBe(false);

    const lb1 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'lb' && m.round === 1);
    t = t.recordResult(lb1[0].id, 1);
    expect(t.isComplete()).toBe(true);
  });

  it('8 teams: consolation R2 (challenge) appears after LB R1 + WB R2 complete', () => {
    const teams = makeTeams(['A','B','C','D','E','F','G','H']);
    let t = Tournament.start(teams, 4, 'singles', 'elimination');

    const wb1 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'wb' && m.round === 1);
    expect(wb1).toHaveLength(4);
    for (const m of wb1) t = t.recordResult(m.id, 1);

    expect(t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'lb' && m.round === 1)).toHaveLength(2);
    expect(t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'lb' && m.round === 2)).toHaveLength(0);

    const lb1 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'lb' && m.round === 1);
    for (const m of lb1) t = t.recordResult(m.id, 1);
    
    expect(t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'lb' && m.round === 2)).toHaveLength(0);

    const wb2 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'wb' && m.round === 2);
    for (const m of wb2) t = t.recordResult(m.id, 1);
    
    expect(t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'lb' && m.round === 2)).toHaveLength(2);
  });

  it('8 teams: consolation R3 (final) appears after LB R2 complete', () => {
    const teams = makeTeams(['A','B','C','D','E','F','G','H']);
    let t = Tournament.start(teams, 4, 'singles', 'elimination');

    const wb1 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'wb' && m.round === 1);
    for (const m of wb1) t = t.recordResult(m.id, 1);
    const lb1 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'lb' && m.round === 1);
    for (const m of lb1) t = t.recordResult(m.id, 1);
    const wb2 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'wb' && m.round === 2);
    for (const m of wb2) t = t.recordResult(m.id, 1);
    const lb2 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'lb' && m.round === 2);
    for (const m of lb2) t = t.recordResult(m.id, 1);

    const lb3 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'lb' && m.round === 3);
    expect(lb3).toHaveLength(1);
  });

  it('8 teams: WBF loser does not appear in consolation bracket', () => {
    const teams = makeTeams(['A','B','C','D','E','F','G','H']);
    let t = Tournament.start(teams, 4, 'singles', 'elimination');

    const wb1 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'wb' && m.round === 1);
    for (const m of wb1) t = t.recordResult(m.id, 1);
    const lb1 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'lb' && m.round === 1);
    for (const m of lb1) t = t.recordResult(m.id, 1);
    const wb2 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'wb' && m.round === 2);
    for (const m of wb2) t = t.recordResult(m.id, 1);
    const lb2 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'lb' && m.round === 2);
    for (const m of lb2) t = t.recordResult(m.id, 1);
    const wb3 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'wb' && m.round === 3);
    t = t.recordResult(wb3[0].id, 1);
    const wbfLoserId = wb3[0].team2.id;

    const allLB = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'lb');
    const lbTeamIds = new Set(allLB.flatMap(m => [m.team1.id, m.team2.id]));
    expect(lbTeamIds.has(wbfLoserId)).toBe(false);
  });

  it('2 teams: no consolation bracket, isComplete after WBF', () => {
    const teams = makeTeams(['Alice', 'Bob']);
    let t = Tournament.start(teams, 2, 'singles', 'elimination');
    const matches = t.toState().matches;
    expect(matches.filter(m => (m.bracket ?? 'wb') === 'lb')).toHaveLength(0);
    t = t.recordResult(matches[0].id, 1);
    expect(t.isComplete()).toBe(true);
  });
});

describe('Tournament SE isComplete', () => {
  const teamA = makeTeam('a', ['A']);
  const teamB = makeTeam('b', ['B']);

  it('returns false when no matches', () => {
    const t = Tournament.from({
      phase: 'active', format: 'singles', type: 'elimination',
      numberOfCourts: 2, teams: [teamA, teamB],
      matches: [],
      seBracket: { size: 2, seeding: ['a', 'b'] },
    });
    expect(t.isComplete()).toBe(false);
  });

  it('returns false when final match has no winner yet', () => {
    const t = Tournament.from({
      phase: 'active', format: 'singles', type: 'elimination',
      numberOfCourts: 2, teams: [teamA, teamB],
      matches: [makeMatch('m1', 1, teamA, teamB)],
      seBracket: { size: 2, seeding: ['a', 'b'] },
    });
    expect(t.isComplete()).toBe(false);
  });

  it('returns true when final match has a winner', () => {
    const t = Tournament.from({
      phase: 'active', format: 'singles', type: 'elimination',
      numberOfCourts: 2, teams: [teamA, teamB],
      matches: [makeMatch('m1', 1, teamA, teamB, 1)],
      seBracket: { size: 2, seeding: ['a', 'b'] },
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
