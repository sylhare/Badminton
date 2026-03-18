import { describe, it, expect } from 'vitest';

import Tournament from '../../src/utils/Tournament';
import type { TournamentTeam } from '../../src/types/tournament';

function makeTeams(names: string[]): TournamentTeam[] {
  return names.map((name, i) => ({
    id: `team-${i}`,
    players: [{ id: `p-${i}`, name, isPresent: true }],
  }));
}

describe('Double Elimination — 4 singles teams', () => {
  const teams = makeTeams(['Alice', 'Bob', 'Carol', 'Dana']);

  function startDE() {
    return Tournament.start(teams, 2, 'singles', 'elimination');
  }

  it('starts with 2 WB R1 matches, no LB or GF matches', () => {
    const t = startDE();
    const matches = t.toState().matches;
    const wb = matches.filter(m => (m.bracket ?? 'wb') === 'wb');
    const lb = matches.filter(m => (m.bracket ?? 'wb') === 'lb');
    const gf = matches.filter(m => (m.bracket ?? 'wb') === 'gf');
    expect(wb).toHaveLength(2);
    expect(lb).toHaveLength(0);
    expect(gf).toHaveLength(0);
  });

  it('after WB R1 completes, generates 1 LB R1 match and 1 WB R2 match', () => {
    let t = startDE();
    const wb1 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'wb' && m.round === 1);
    t = t.recordResult(wb1[0].id, 1);
    t = t.recordResult(wb1[1].id, 1);

    const matches = t.toState().matches;
    const wb = matches.filter(m => (m.bracket ?? 'wb') === 'wb');
    const lb = matches.filter(m => (m.bracket ?? 'wb') === 'lb');
    const gf = matches.filter(m => (m.bracket ?? 'wb') === 'gf');
    expect(wb).toHaveLength(3);
    expect(lb).toHaveLength(1);
    expect(gf).toHaveLength(0);
  });

  it('WB R1 losers appear in LB R1', () => {
    let t = startDE();
    const wb1 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'wb' && m.round === 1);

    t = t.recordResult(wb1[0].id, 1);
    t = t.recordResult(wb1[1].id, 1);

    const lbR1 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'lb' && m.round === 1);
    expect(lbR1).toHaveLength(1);

    const loser1 = wb1[0].team2.id;
    const loser2 = wb1[1].team2.id;
    const lbTeamIds = [lbR1[0].team1.id, lbR1[0].team2.id];
    expect(lbTeamIds).toContain(loser1);
    expect(lbTeamIds).toContain(loser2);
  });

  it('LB R2 (LBF) appears after both LB R1 and WB R2 are done', () => {
    let t = startDE();
    const wb1 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'wb' && m.round === 1);
    t = t.recordResult(wb1[0].id, 1);
    t = t.recordResult(wb1[1].id, 1);

    const lb1 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'lb' && m.round === 1);
    t = t.recordResult(lb1[0].id, 1);

    expect(t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'lb' && m.round === 2)).toHaveLength(0);

    const wb2 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'wb' && m.round === 2);
    t = t.recordResult(wb2[0].id, 1);

    const lb2 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'lb' && m.round === 2);
    expect(lb2).toHaveLength(1);
  });

  it('WB R2 loser appears in LB R2 (challenge round)', () => {
    let t = startDE();
    const wb1 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'wb' && m.round === 1);
    t = t.recordResult(wb1[0].id, 1);
    t = t.recordResult(wb1[1].id, 1);

    const lb1 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'lb' && m.round === 1);
    t = t.recordResult(lb1[0].id, 1);

    const wb2 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'wb' && m.round === 2);
    t = t.recordResult(wb2[0].id, 1);

    const lb2 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'lb' && m.round === 2);
    const wbFinalLoser = wb2[0].team2.id;
    const lbTeamIds = [lb2[0].team1.id, lb2[0].team2.id];
    expect(lbTeamIds).toContain(wbFinalLoser);
  });

  it('GF appears after WBF and LBF are both done', () => {
    let t = startDE();
    const wb1 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'wb' && m.round === 1);
    t = t.recordResult(wb1[0].id, 1);
    t = t.recordResult(wb1[1].id, 1);
    const lb1 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'lb' && m.round === 1);
    t = t.recordResult(lb1[0].id, 1);
    const wb2 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'wb' && m.round === 2);
    t = t.recordResult(wb2[0].id, 1);

    expect(t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'gf')).toHaveLength(0);

    const lb2 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'lb' && m.round === 2);
    t = t.recordResult(lb2[0].id, 1);

    expect(t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'gf')).toHaveLength(1);
  });

  it('isComplete returns false until GF has a winner', () => {
    let t = startDE();
    const wb1 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'wb' && m.round === 1);
    t = t.recordResult(wb1[0].id, 1);
    t = t.recordResult(wb1[1].id, 1);
    const lb1 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'lb' && m.round === 1);
    t = t.recordResult(lb1[0].id, 1);
    const wb2 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'wb' && m.round === 2);
    t = t.recordResult(wb2[0].id, 1);
    const lb2 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'lb' && m.round === 2);
    t = t.recordResult(lb2[0].id, 1);

    expect(t.isComplete()).toBe(false);

    const gf = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'gf');
    t = t.recordResult(gf[0].id, 1);

    expect(t.isComplete()).toBe(true);
  });

  it('GF has the WB champion vs LB champion as participants', () => {
    let t = startDE();
    const wb1 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'wb' && m.round === 1);

    t = t.recordResult(wb1[0].id, 1);
    t = t.recordResult(wb1[1].id, 1);
    const lb1 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'lb' && m.round === 1);
    t = t.recordResult(lb1[0].id, 1);
    const wb2 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'wb' && m.round === 2);

    t = t.recordResult(wb2[0].id, 1);
    const lb2 = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'lb' && m.round === 2);
    t = t.recordResult(lb2[0].id, 1);

    const gf = t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'gf');
    expect(gf).toHaveLength(1);

    const wbFinalWinnerId = wb2[0].team1.id;
    const gfTeamIds = [gf[0].team1.id, gf[0].team2.id];
    expect(gfTeamIds).toContain(wbFinalWinnerId);
  });
});

describe('Double Elimination — 2 teams (no LB)', () => {
  it('with 2 teams there is no LB and isComplete triggers after WBF', () => {
    const teams = makeTeams(['Alice', 'Bob']);
    let t = Tournament.start(teams, 2, 'singles', 'elimination');
    const matches = t.toState().matches;
    expect(matches.filter(m => (m.bracket ?? 'wb') === 'wb')).toHaveLength(1);
    expect(matches.filter(m => (m.bracket ?? 'wb') === 'lb')).toHaveLength(0);

    t = t.recordResult(matches[0].id, 1);
    expect(t.isComplete()).toBe(true);
    expect(t.toState().matches.filter(m => (m.bracket ?? 'wb') === 'lb')).toHaveLength(0);
  });
});
