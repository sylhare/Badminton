import { describe, expect, it } from 'vitest';

import Tournament from '../../src/tournament/Tournament';
import { makeMatch, makeTeam } from '../data/tournamentFactories';

describe('elimination', () => {
  describe('bracket setup', () => {
    it('4 teams: size 4, 2 round-1 matches, no byes', () => {
      const teams = [makeTeam('a', ['A']), makeTeam('b', ['B']), makeTeam('c', ['C']), makeTeam('d', ['D'])];
      const { matches, seBracket } = Tournament.start(teams, 2, 'singles', 'elimination').toState();
      expect(seBracket!.size).toBe(4);
      expect(seBracket!.seeding).toHaveLength(4);
      expect(seBracket!.seeding.every(s => s !== null)).toBe(true);
      expect(matches).toHaveLength(2);
      expect(matches.every(m => m.round === 1)).toBe(true);
    });

    it('6 teams: size 8, 2 null byes, 3 round-1 matches', () => {
      const teams = ['a', 'b', 'c', 'd', 'e', 'f'].map(id => makeTeam(id, [id.toUpperCase()]));
      const { matches, seBracket } = Tournament.start(teams, 4, 'singles', 'elimination').toState();
      expect(seBracket!.size).toBe(8);
      expect(seBracket!.seeding).toHaveLength(8);
      const nullCount = seBracket!.seeding.filter(s => s === null).length;
      expect(nullCount).toBe(2);
      expect(matches).toHaveLength(3);
      expect(matches.every(m => m.round === 1)).toBe(true);
    });

    it('3 teams: size 4, 1 round-1 match, 1 bye pair', () => {
      const teams = [makeTeam('a', ['A']), makeTeam('b', ['B']), makeTeam('c', ['C'])];
      const { matches, seBracket } = Tournament.start(teams, 2, 'singles', 'elimination').toState();
      expect(seBracket!.size).toBe(4);
      expect(seBracket!.seeding).toHaveLength(4);
      const nullCount = seBracket!.seeding.filter(s => s === null).length;
      expect(nullCount).toBe(1);
      expect(matches).toHaveLength(1);
    });

    it('cycles court numbers', () => {
      const teams = ['a', 'b', 'c', 'd'].map(id => makeTeam(id, [id]));
      const { matches } = Tournament.start(teams, 1, 'singles', 'elimination').toState();
      expect(matches.every(m => m.courtNumber === 1)).toBe(true);
    });

    it('5 teams: size 8, 3 null byes, 2 round-1 matches', () => {
      const teams = ['a', 'b', 'c', 'd', 'e'].map(id => makeTeam(id, [id.toUpperCase()]));
      const { matches, seBracket } = Tournament.start(teams, 2, 'singles', 'elimination').toState();
      expect(seBracket!.size).toBe(8);
      expect(seBracket!.seeding).toHaveLength(8);
      const nullCount = seBracket!.seeding.filter(s => s === null).length;
      expect(nullCount).toBe(3);
      expect(matches).toHaveLength(2);
      expect(matches.every(m => m.round === 1)).toBe(true);
    });

    it('7 teams: size 8, 1 null bye, 3 round-1 matches', () => {
      const teams = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(id => makeTeam(id, [id.toUpperCase()]));
      const { matches, seBracket } = Tournament.start(teams, 2, 'singles', 'elimination').toState();
      expect(seBracket!.size).toBe(8);
      expect(seBracket!.seeding).toHaveLength(8);
      const nullCount = seBracket!.seeding.filter(s => s === null).length;
      expect(nullCount).toBe(1);
      expect(matches).toHaveLength(3);
      expect(matches.every(m => m.round === 1)).toBe(true);
    });
  });

  describe('isComplete', () => {
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
  });

  describe('getTotalRounds', () => {
    it('returns log2(size) regardless of matches generated', () => {
      const teams = [makeTeam('a', ['A']), makeTeam('b', ['B']), makeTeam('c', ['C']), makeTeam('d', ['D'])];
      const t = Tournament.start(teams, 2, 'singles', 'elimination');
      expect(t.getTotalRounds()).toBe(2);
    });
  });

  describe('walkthrough — 4 teams', () => {
    const teamA = makeTeam('a', ['A']);
    const teamB = makeTeam('b', ['B']);
    const teamC = makeTeam('c', ['C']);
    const teamD = makeTeam('d', ['D']);
    const teams = [teamA, teamB, teamC, teamD];

    it('round 1 results generate round 2 matchup', () => {
      let t = Tournament.start(teams, 2, 'singles', 'elimination');
      const round1Matches = t.toState().matches;
      expect(round1Matches).toHaveLength(2);

      const round1Winner0 = round1Matches[0].team1.id;
      const round1Winner1 = round1Matches[1].team1.id;

      t = t.recordResult(round1Matches[0].id, 1);
      t = t.recordResult(round1Matches[1].id, 1);

      const state = t.toState();
      const round2Matches = state.matches.filter(m => m.round === 2);
      expect(round2Matches).toHaveLength(1);

      const round2Teams = [round2Matches[0].team1.id, round2Matches[0].team2.id].sort();
      expect(round2Teams).toContain(round1Winner0);
      expect(round2Teams).toContain(round1Winner1);
    });

    it('isComplete after consolation final', () => {
      let t = Tournament.start(teams, 2, 'singles', 'elimination');
      expect(t.isComplete()).toBe(false);

      const winnersRound1 = t.toState().matches.filter(m => Tournament.isWinners(m) && m.round === 1);
      t = t.recordResult(winnersRound1[0].id, 1);
      t = t.recordResult(winnersRound1[1].id, 1);
      expect(t.isComplete()).toBe(false);

      const winnersRound2 = t.toState().matches.filter(m => Tournament.isWinners(m) && m.round === 2);
      t = t.recordResult(winnersRound2[0].id, 1);
      expect(t.isComplete()).toBe(false);

      const consolationRound1 = t.toState().matches.filter(m => Tournament.isConsolation(m) && m.round === 1);
      t = t.recordResult(consolationRound1[0].id, 1);

      expect(t.isComplete()).toBe(true);
      expect(t.toState().matches.filter(m => Tournament.isConsolation(m))).toHaveLength(1);
    });
  });

  describe('walkthrough — 6 teams', () => {
    const teams = ['a', 'b', 'c', 'd', 'e', 'f'].map(id => makeTeam(id, [id.toUpperCase()]));

    it('round 1 has 3 matches (all 6 teams play)', () => {
      const { matches } = Tournament.start(teams, 4, 'singles', 'elimination').toState();
      expect(matches.filter(m => m.round === 1)).toHaveLength(3);
    });

    it('after round 1, round 2 has 1 match (2 winners advance, 1 gets bye)', () => {
      let t = Tournament.start(teams, 4, 'singles', 'elimination');
      const round1Matches = t.toState().matches;
      expect(round1Matches).toHaveLength(3);
      t = t.recordResult(round1Matches[0].id, 1);
      t = t.recordResult(round1Matches[1].id, 1);
      t = t.recordResult(round1Matches[2].id, 1);

      const round2Matches = t.toState().matches.filter(m => Tournament.isWinners(m) && m.round === 2);
      expect(round2Matches).toHaveLength(1);
    });

    it('after round 2, round 3 final is generated', () => {
      let t = Tournament.start(teams, 4, 'singles', 'elimination');
      const round1Matches = t.toState().matches;
      t = t.recordResult(round1Matches[0].id, 1);
      t = t.recordResult(round1Matches[1].id, 1);
      t = t.recordResult(round1Matches[2].id, 1);

      const round2Matches = t.toState().matches.filter(m => Tournament.isWinners(m) && m.round === 2);
      t = t.recordResult(round2Matches[0].id, 1);

      const round3Matches = t.toState().matches.filter(m => Tournament.isWinners(m) && m.round === 3);
      expect(round3Matches).toHaveLength(1);
      expect(t.isComplete()).toBe(false);
    });

    it('isComplete after consolation final', () => {
      let t = Tournament.start(teams, 4, 'singles', 'elimination');

      const winnersRound1 = t.toState().matches.filter(m => Tournament.isWinners(m) && m.round === 1);
      expect(winnersRound1).toHaveLength(3);
      t = t.recordResult(winnersRound1[0].id, 1);
      t = t.recordResult(winnersRound1[1].id, 1);
      t = t.recordResult(winnersRound1[2].id, 1);

      const winnersRound2 = t.toState().matches.filter(m => Tournament.isWinners(m) && m.round === 2);
      expect(winnersRound2).toHaveLength(1);
      const consolationRound1 = t.toState().matches.filter(m => Tournament.isConsolation(m) && m.round === 1);
      expect(consolationRound1).toHaveLength(1);

      t = t.recordResult(winnersRound2[0].id, 1);
      const winnersRound3 = t.toState().matches.filter(m => Tournament.isWinners(m) && m.round === 3);
      expect(winnersRound3).toHaveLength(1);

      t = t.recordResult(consolationRound1[0].id, 1);
      const consolationRound2 = t.toState().matches.filter(m => Tournament.isConsolation(m) && m.round === 2);
      expect(consolationRound2).toHaveLength(1);

      t = t.recordResult(winnersRound3[0].id, 1);
      expect(t.isComplete()).toBe(false);

      t = t.recordResult(consolationRound2[0].id, 1);
      expect(t.isComplete()).toBe(true);
      expect(t.toState().matches.filter(m => Tournament.isConsolation(m))).toHaveLength(2);
    });

    it('getTotalRounds returns 3 (log2(8)) from the start', () => {
      const t = Tournament.start(teams, 4, 'singles', 'elimination');
      expect(t.getTotalRounds()).toBe(3);
    });
  });

  describe('consolation bracket', () => {
    function makeTeams(names: string[]) {
      return names.map((name, i) => makeTeam(`team-${i}`, [name]));
    }

    it('4 teams: round 1 losers appear in consolation round 1', () => {
      const teams = makeTeams(['Alice', 'Bob', 'Carol', 'Dana']);
      let t = Tournament.start(teams, 2, 'singles', 'elimination');
      const winnersRound1 = t.toState().matches.filter(m => Tournament.isWinners(m) && m.round === 1);
      t = t.recordResult(winnersRound1[0].id, 1);
      t = t.recordResult(winnersRound1[1].id, 1);

      const consolationRound1 = t.toState().matches.filter(m => Tournament.isConsolation(m) && m.round === 1);
      expect(consolationRound1).toHaveLength(1);
      const loser1 = winnersRound1[0].team2.id;
      const loser2 = winnersRound1[1].team2.id;
      expect([consolationRound1[0].team1.id, consolationRound1[0].team2.id]).toContain(loser1);
      expect([consolationRound1[0].team1.id, consolationRound1[0].team2.id]).toContain(loser2);
    });

    it('4 teams: no consolation round 2 in a 4-team bracket', () => {
      const teams = makeTeams(['Alice', 'Bob', 'Carol', 'Dana']);
      let t = Tournament.start(teams, 2, 'singles', 'elimination');
      const winnersRound1 = t.toState().matches.filter(m => Tournament.isWinners(m) && m.round === 1);
      t = t.recordResult(winnersRound1[0].id, 1);
      t = t.recordResult(winnersRound1[1].id, 1);
      const consolationRound1 = t.toState().matches.filter(m => Tournament.isConsolation(m) && m.round === 1);
      t = t.recordResult(consolationRound1[0].id, 1);
      const winnersRound2 = t.toState().matches.filter(m => Tournament.isWinners(m) && m.round === 2);
      t = t.recordResult(winnersRound2[0].id, 1);

      const consolationRound2 = t.toState().matches.filter(m => Tournament.isConsolation(m) && m.round === 2);
      expect(consolationRound2).toHaveLength(0);
      expect(t.isComplete()).toBe(true);
    });

    it('4 teams: isComplete false until consolation final decided', () => {
      const teams = makeTeams(['Alice', 'Bob', 'Carol', 'Dana']);
      let t = Tournament.start(teams, 2, 'singles', 'elimination');
      const winnersRound1 = t.toState().matches.filter(m => Tournament.isWinners(m) && m.round === 1);
      t = t.recordResult(winnersRound1[0].id, 1);
      t = t.recordResult(winnersRound1[1].id, 1);
      const winnersRound2 = t.toState().matches.filter(m => Tournament.isWinners(m) && m.round === 2);
      t = t.recordResult(winnersRound2[0].id, 1);

      expect(t.isComplete()).toBe(false);

      const consolationRound1 = t.toState().matches.filter(m => Tournament.isConsolation(m) && m.round === 1);
      t = t.recordResult(consolationRound1[0].id, 1);
      expect(t.isComplete()).toBe(true);
    });

    it('8 teams: consolation round 2 appears after consolation round 1 is complete', () => {
      const teams = makeTeams(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
      let t = Tournament.start(teams, 4, 'singles', 'elimination');

      const winnersRound1 = t.toState().matches.filter(m => Tournament.isWinners(m) && m.round === 1);
      expect(winnersRound1).toHaveLength(4);
      for (const m of winnersRound1) t = t.recordResult(m.id, 1);

      expect(t.toState().matches.filter(m => Tournament.isConsolation(m) && m.round === 1)).toHaveLength(2);
      expect(t.toState().matches.filter(m => Tournament.isConsolation(m) && m.round === 2)).toHaveLength(0);

      const consolationRound1 = t.toState().matches.filter(m => Tournament.isConsolation(m) && m.round === 1);
      for (const m of consolationRound1) t = t.recordResult(m.id, 1);

      expect(t.toState().matches.filter(m => Tournament.isConsolation(m) && m.round === 2)).toHaveLength(1);
    });

    it('8 teams: winners bracket final loser is not seeded into consolation', () => {
      const teams = makeTeams(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
      let t = Tournament.start(teams, 4, 'singles', 'elimination');

      const winnersRound1 = t.toState().matches.filter(m => Tournament.isWinners(m) && m.round === 1);
      for (const m of winnersRound1) t = t.recordResult(m.id, 1);
      const consolationRound1 = t.toState().matches.filter(m => Tournament.isConsolation(m) && m.round === 1);
      for (const m of consolationRound1) t = t.recordResult(m.id, 1);
      const winnersRound2 = t.toState().matches.filter(m => Tournament.isWinners(m) && m.round === 2);
      for (const m of winnersRound2) t = t.recordResult(m.id, 1);
      const consolationRound2 = t.toState().matches.filter(m => Tournament.isConsolation(m) && m.round === 2);
      for (const m of consolationRound2) t = t.recordResult(m.id, 1);
      const winnersRound3 = t.toState().matches.filter(m => Tournament.isWinners(m) && m.round === 3);
      t = t.recordResult(winnersRound3[0].id, 1);
      const winnersFinalLoserId = winnersRound3[0].team2.id;

      const allLB = t.toState().matches.filter(m => Tournament.isConsolation(m));
      const lbTeamIds = new Set(allLB.flatMap(m => [m.team1.id, m.team2.id]));
      expect(lbTeamIds.has(winnersFinalLoserId)).toBe(false);
    });

    it('2 teams: no consolation bracket, complete after winners bracket final', () => {
      const teams = makeTeams(['Alice', 'Bob']);
      let t = Tournament.start(teams, 2, 'singles', 'elimination');
      const matches = t.toState().matches;
      expect(matches.filter(m => Tournament.isConsolation(m))).toHaveLength(0);
      t = t.recordResult(matches[0].id, 1);
      expect(t.isComplete()).toBe(true);
    });

    it('5 teams: after round-1, consolation round-1 has 1 match with both losers', () => {
      const teams = makeTeams(['A', 'B', 'C', 'D', 'E']);
      let t = Tournament.start(teams, 2, 'singles', 'elimination');
      const round1Matches = t.toState().matches.filter(m => Tournament.isWinners(m) && m.round === 1);
      expect(round1Matches).toHaveLength(2);
      const loser0 = round1Matches[0].team2.id;
      const loser1 = round1Matches[1].team2.id;
      for (const m of round1Matches) t = t.recordResult(m.id, 1);

      const consolRound1 = t.toState().matches.filter(m => Tournament.isConsolation(m) && m.round === 1);
      expect(consolRound1).toHaveLength(1);
      const consolTeams = [consolRound1[0].team1.id, consolRound1[0].team2.id];
      expect(consolTeams).toContain(loser0);
      expect(consolTeams).toContain(loser1);
    });

    it('7 teams: after round-1, consolation round-1 has 1 match; 3rd loser advances via bye to consolation round-2', () => {
      const teams = makeTeams(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
      let t = Tournament.start(teams, 2, 'singles', 'elimination');
      const round1Matches = t.toState().matches.filter(m => Tournament.isWinners(m) && m.round === 1);
      expect(round1Matches).toHaveLength(3);
      const loserIds = round1Matches.map(m => m.team2.id);
      for (const m of round1Matches) t = t.recordResult(m.id, 1);

      const consolRound1 = t.toState().matches.filter(m => Tournament.isConsolation(m) && m.round === 1);
      expect(consolRound1).toHaveLength(1);

      t = t.recordResult(consolRound1[0].id, 1);
      const consolRound2 = t.toState().matches.filter(m => Tournament.isConsolation(m) && m.round === 2);
      expect(consolRound2).toHaveLength(1);
      const consolRound2Teams = [consolRound2[0].team1.id, consolRound2[0].team2.id];
      const byeLoser = loserIds.find(id => !consolRound1[0].team1.id.includes(id) && !consolRound1[0].team2.id.includes(id));
      expect(consolRound2Teams).toContain(byeLoser);
    });
  });
});
