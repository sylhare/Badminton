import { describe, expect, it } from 'vitest';

import Tournament from '../../src/tournament/Tournament';
import { makeTeam } from '../data/tournamentFactories';

describe('elimination', () => {
  describe('SE first stage', () => {
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
      const teams = ['a', 'b', 'c', 'd', 'e', 'f'].map(id => makeTeam(id, [id.toUpperCase()]));
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
      const teams = ['a', 'b', 'c', 'd'].map(id => makeTeam(id, [id]));
      const { matches } = Tournament.start(teams, 1, 'singles', 'elimination').toState();
      expect(matches.every(m => m.courtNumber === 1)).toBe(true);
    });
  });

  describe('walkthrough — 4 teams', () => {
    const teamA = makeTeam('a', ['A']);
    const teamB = makeTeam('b', ['B']);
    const teamC = makeTeam('c', ['C']);
    const teamD = makeTeam('d', ['D']);
    const teams = [teamA, teamB, teamC, teamD];

    it('R1 results → R2 generated with correct matchup', () => {
      let t = Tournament.start(teams, 2, 'singles', 'elimination');
      const r1 = t.toState().matches;
      expect(r1).toHaveLength(2);

      const r1Winner0 = r1[0].team1.id;
      const r1Winner1 = r1[1].team1.id;

      t = t.recordResult(r1[0].id, 1);
      t = t.recordResult(r1[1].id, 1);

      const state = t.toState();
      const r2 = state.matches.filter(m => m.round === 2);
      expect(r2).toHaveLength(1);

      const r2Teams = [r2[0].team1.id, r2[0].team2.id].sort();
      expect(r2Teams).toContain(r1Winner0);
      expect(r2Teams).toContain(r1Winner1);
    });

    it('isComplete after consolation final', () => {
      let t = Tournament.start(teams, 2, 'singles', 'elimination');
      expect(t.isComplete()).toBe(false);

      const wb1 = t.toState().matches.filter(m => Tournament.isWinners(m) && m.round === 1);
      t = t.recordResult(wb1[0].id, 1);
      t = t.recordResult(wb1[1].id, 1);
      expect(t.isComplete()).toBe(false);

      const wb2 = t.toState().matches.filter(m => Tournament.isWinners(m) && m.round === 2);
      t = t.recordResult(wb2[0].id, 1);
      expect(t.isComplete()).toBe(false);

      const lb1 = t.toState().matches.filter(m => Tournament.isConsolation(m) && m.round === 1);
      t = t.recordResult(lb1[0].id, 1);

      expect(t.isComplete()).toBe(true);
      expect(t.toState().matches.filter(m => Tournament.isConsolation(m))).toHaveLength(1);
    });

    it('getTotalRounds returns 2 (log2(4)) from the start', () => {
      const t = Tournament.start(teams, 2, 'singles', 'elimination');
      expect(t.getTotalRounds()).toBe(2);
    });
  });

  describe('walkthrough — 6 teams', () => {
    const teams = ['a', 'b', 'c', 'd', 'e', 'f'].map(id => makeTeam(id, [id.toUpperCase()]));

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

      const r2 = t.toState().matches.filter(m => Tournament.isWinners(m) && m.round === 2);
      expect(r2).toHaveLength(1);
    });

    it('after R2, final (R3) is generated', () => {
      let t = Tournament.start(teams, 4, 'singles', 'elimination');
      const r1 = t.toState().matches;
      t = t.recordResult(r1[0].id, 1);
      t = t.recordResult(r1[1].id, 1);
      t = t.recordResult(r1[2].id, 1);

      const r2 = t.toState().matches.filter(m => Tournament.isWinners(m) && m.round === 2);
      t = t.recordResult(r2[0].id, 1);

      const r3 = t.toState().matches.filter(m => Tournament.isWinners(m) && m.round === 3);
      expect(r3).toHaveLength(1);
      expect(t.isComplete()).toBe(false);
    });

    it('isComplete after consolation final', () => {
      let t = Tournament.start(teams, 4, 'singles', 'elimination');

      const wb1 = t.toState().matches.filter(m => Tournament.isWinners(m) && m.round === 1);
      expect(wb1).toHaveLength(3);
      t = t.recordResult(wb1[0].id, 1);
      t = t.recordResult(wb1[1].id, 1);
      t = t.recordResult(wb1[2].id, 1);

      const wb2 = t.toState().matches.filter(m => Tournament.isWinners(m) && m.round === 2);
      expect(wb2).toHaveLength(1);
      const lb1 = t.toState().matches.filter(m => Tournament.isConsolation(m) && m.round === 1);
      expect(lb1).toHaveLength(1);

      t = t.recordResult(wb2[0].id, 1);
      const wb3 = t.toState().matches.filter(m => Tournament.isWinners(m) && m.round === 3);
      expect(wb3).toHaveLength(1);

      t = t.recordResult(lb1[0].id, 1);
      const lb2 = t.toState().matches.filter(m => Tournament.isConsolation(m) && m.round === 2);
      expect(lb2).toHaveLength(1);

      t = t.recordResult(wb3[0].id, 1);
      expect(t.isComplete()).toBe(false);

      t = t.recordResult(lb2[0].id, 1);
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

    it('4 teams: WB R1 losers appear in consolation R1', () => {
      const teams = makeTeams(['Alice', 'Bob', 'Carol', 'Dana']);
      let t = Tournament.start(teams, 2, 'singles', 'elimination');
      const wb1 = t.toState().matches.filter(m => Tournament.isWinners(m) && m.round === 1);
      t = t.recordResult(wb1[0].id, 1);
      t = t.recordResult(wb1[1].id, 1);

      const lb1 = t.toState().matches.filter(m => Tournament.isConsolation(m) && m.round === 1);
      expect(lb1).toHaveLength(1);
      const loser1 = wb1[0].team2.id;
      const loser2 = wb1[1].team2.id;
      expect([lb1[0].team1.id, lb1[0].team2.id]).toContain(loser1);
      expect([lb1[0].team1.id, lb1[0].team2.id]).toContain(loser2);
    });

    it('4 teams: no consolation R2 (lbRounds=1)', () => {
      const teams = makeTeams(['Alice', 'Bob', 'Carol', 'Dana']);
      let t = Tournament.start(teams, 2, 'singles', 'elimination');
      const wb1 = t.toState().matches.filter(m => Tournament.isWinners(m) && m.round === 1);
      t = t.recordResult(wb1[0].id, 1);
      t = t.recordResult(wb1[1].id, 1);
      const lb1 = t.toState().matches.filter(m => Tournament.isConsolation(m) && m.round === 1);
      t = t.recordResult(lb1[0].id, 1);
      const wb2 = t.toState().matches.filter(m => Tournament.isWinners(m) && m.round === 2);
      t = t.recordResult(wb2[0].id, 1);

      const lb2 = t.toState().matches.filter(m => Tournament.isConsolation(m) && m.round === 2);
      expect(lb2).toHaveLength(0);
      expect(t.isComplete()).toBe(true);
    });

    it('4 teams: isComplete false until consolation final decided', () => {
      const teams = makeTeams(['Alice', 'Bob', 'Carol', 'Dana']);
      let t = Tournament.start(teams, 2, 'singles', 'elimination');
      const wb1 = t.toState().matches.filter(m => Tournament.isWinners(m) && m.round === 1);
      t = t.recordResult(wb1[0].id, 1);
      t = t.recordResult(wb1[1].id, 1);
      const wb2 = t.toState().matches.filter(m => Tournament.isWinners(m) && m.round === 2);
      t = t.recordResult(wb2[0].id, 1);

      expect(t.isComplete()).toBe(false);

      const lb1 = t.toState().matches.filter(m => Tournament.isConsolation(m) && m.round === 1);
      t = t.recordResult(lb1[0].id, 1);
      expect(t.isComplete()).toBe(true);
    });

    it('8 teams: consolation R2 (final) appears after LB R1 complete', () => {
      const teams = makeTeams(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
      let t = Tournament.start(teams, 4, 'singles', 'elimination');

      const wb1 = t.toState().matches.filter(m => Tournament.isWinners(m) && m.round === 1);
      expect(wb1).toHaveLength(4);
      for (const m of wb1) t = t.recordResult(m.id, 1);

      expect(t.toState().matches.filter(m => Tournament.isConsolation(m) && m.round === 1)).toHaveLength(2);
      expect(t.toState().matches.filter(m => Tournament.isConsolation(m) && m.round === 2)).toHaveLength(0);

      const lb1 = t.toState().matches.filter(m => Tournament.isConsolation(m) && m.round === 1);
      for (const m of lb1) t = t.recordResult(m.id, 1);

      expect(t.toState().matches.filter(m => Tournament.isConsolation(m) && m.round === 2)).toHaveLength(1);
    });

    it('8 teams: WBF loser does not appear in consolation bracket', () => {
      const teams = makeTeams(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
      let t = Tournament.start(teams, 4, 'singles', 'elimination');

      const wb1 = t.toState().matches.filter(m => Tournament.isWinners(m) && m.round === 1);
      for (const m of wb1) t = t.recordResult(m.id, 1);
      const lb1 = t.toState().matches.filter(m => Tournament.isConsolation(m) && m.round === 1);
      for (const m of lb1) t = t.recordResult(m.id, 1);
      const wb2 = t.toState().matches.filter(m => Tournament.isWinners(m) && m.round === 2);
      for (const m of wb2) t = t.recordResult(m.id, 1);
      const lb2 = t.toState().matches.filter(m => Tournament.isConsolation(m) && m.round === 2);
      for (const m of lb2) t = t.recordResult(m.id, 1);
      const wb3 = t.toState().matches.filter(m => Tournament.isWinners(m) && m.round === 3);
      t = t.recordResult(wb3[0].id, 1);
      const wbfLoserId = wb3[0].team2.id;

      const allLB = t.toState().matches.filter(m => Tournament.isConsolation(m));
      const lbTeamIds = new Set(allLB.flatMap(m => [m.team1.id, m.team2.id]));
      expect(lbTeamIds.has(wbfLoserId)).toBe(false);
    });

    it('2 teams: no consolation bracket, isComplete after WBF', () => {
      const teams = makeTeams(['Alice', 'Bob']);
      let t = Tournament.start(teams, 2, 'singles', 'elimination');
      const matches = t.toState().matches;
      expect(matches.filter(m => Tournament.isConsolation(m))).toHaveLength(0);
      t = t.recordResult(matches[0].id, 1);
      expect(t.isComplete()).toBe(true);
    });
  });
});
