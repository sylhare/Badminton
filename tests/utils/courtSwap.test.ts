import { describe, expect, it } from 'vitest';

import type { Court, Player } from '../../src/types';
import { applyCourtSwap, benchGroup, benchSlot, courtSlot, courtTeamGroup } from '../../src/utils/courtSwap';

const p = (id: string): Player => ({ id, name: id.toUpperCase(), isPresent: true });
const [A, B, C, D, E, F, G, H, X, Y] =
  ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'x', 'y'].map(p);

function doubles(courtNumber: number, t1: Player[], t2: Player[], extra?: Partial<Court>): Court {
  return { courtNumber, players: [...t1, ...t2], teams: { team1: t1, team2: t2 }, ...extra };
}

describe('address helpers', () => {
  it('maps court/team and bench to stable group indices', () => {
    expect(courtTeamGroup(0, 1)).toBe(0);
    expect(courtTeamGroup(0, 2)).toBe(1);
    expect(courtTeamGroup(1, 1)).toBe(2);
    expect(benchGroup(2)).toBe(4);
    expect(courtSlot(1, 2, 0)).toEqual({ group: 3, index: 0 });
    expect(benchSlot(2, 1)).toEqual({ group: 4, index: 1 });
  });
});

describe('applyCourtSwap', () => {
  it('swaps two players across courts and rebuilds players + teams', () => {
    const courts = [doubles(1, [A, B], [C, D]), doubles(2, [E, F], [G, H])];
    // court 0 team1[0] = A  <->  court 1 team2[0] = G
    const res = applyCourtSwap(courts, [], courtSlot(0, 1, 0), courtSlot(1, 2, 0));
    expect(res.courts[0].teams!.team1.map(x => x.id)).toEqual(['g', 'b']);
    expect(res.courts[1].teams!.team2.map(x => x.id)).toEqual(['a', 'h']);
    expect(res.courts[0].players.map(x => x.id)).toEqual(['g', 'b', 'c', 'd']);
    expect(res.changedCourtNumbers).toEqual([1, 2]);
  });

  it('swaps a court player with a bench player (sub in)', () => {
    const courts = [doubles(1, [A, B], [C, D])];
    const bench = [X, Y];
    const res = applyCourtSwap(courts, bench, courtSlot(0, 1, 0), benchSlot(1, 0));
    expect(res.courts[0].teams!.team1.map(x => x.id)).toEqual(['x', 'b']);
    expect(res.bench.map(x => x.id)).toEqual(['a', 'y']);
    expect(res.changedCourtNumbers).toEqual([1]);
  });

  it('clears winner and score on a court whose line-up changed', () => {
    const courts = [doubles(1, [A, B], [C, D], { winner: 1, score: { team1: 21, team2: 15 } })];
    const res = applyCourtSwap(courts, [X], courtSlot(0, 1, 0), benchSlot(1, 0));
    expect(res.courts[0].winner).toBeUndefined();
    expect(res.courts[0].score).toBeUndefined();
  });

  it('clears winner even for an in-court swap that keeps the roster but changes teams', () => {
    const courts = [doubles(1, [A, B], [C, D], { winner: 2 })];
    // swap A (team1[0]) with C (team2[0]) -> same 4 players, different teams
    const res = applyCourtSwap(courts, [], courtSlot(0, 1, 0), courtSlot(0, 2, 0));
    expect(res.courts[0].teams!.team1.map(x => x.id)).toEqual(['c', 'b']);
    expect(res.courts[0].teams!.team2.map(x => x.id)).toEqual(['a', 'd']);
    expect(res.courts[0].winner).toBeUndefined();
    expect(res.changedCourtNumbers).toEqual([1]);
  });

  it('preserves a singles waiting player when swapping the active players', () => {
    const court: Court = {
      courtNumber: 1,
      players: [A, B, C], // C is the waiting player (index 2)
      teams: { team1: [A], team2: [B] },
    };
    const res = applyCourtSwap([court], [X], courtSlot(0, 1, 0), benchSlot(1, 0));
    expect(res.courts[0].teams!.team1.map(x => x.id)).toEqual(['x']);
    expect(res.courts[0].players.map(x => x.id)).toContain('c'); // waiting player kept
    expect(res.bench.map(x => x.id)).toEqual(['a']);
  });

  it('returns the original layout for a no-op swap', () => {
    const courts = [doubles(1, [A, B], [C, D])];
    const res = applyCourtSwap(courts, [], courtSlot(0, 1, 0), courtSlot(0, 1, 0));
    expect(res.courts).toBe(courts);
    expect(res.changedCourtNumbers).toEqual([]);
  });

  it('does not mutate the input courts', () => {
    const courts = [doubles(1, [A, B], [C, D]), doubles(2, [E, F], [G, H])];
    const snapshot = JSON.parse(JSON.stringify(courts));
    applyCourtSwap(courts, [], courtSlot(0, 1, 0), courtSlot(1, 1, 0));
    expect(courts).toEqual(snapshot);
  });
});
