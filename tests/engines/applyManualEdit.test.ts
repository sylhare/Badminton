import { beforeEach, describe, expect, it } from 'vitest';

import { CourtAssignmentTracker } from '../../src/engines/CourtAssignmentTracker';
import { applyCourtSwap, benchSlot, courtSlot } from '../../src/utils/courtSwap';
import { createMockPlayers } from '../data/testFactories';
import type { Court, Player } from '../../src/types';

const pk = (a: Player, b: Player) => [a.id, b.id].sort().join('|');

describe('CourtAssignmentTracker.applyManualEdit', () => {
  const tracker = new CourtAssignmentTracker();
  const [A, B, C, D, E, F, G, H, X] = createMockPlayers(9);

  const court1 = (): Court => ({ courtNumber: 1, players: [A, B, C, D], teams: { team1: [A, B], team2: [C, D] } });
  const court2 = (): Court => ({ courtNumber: 2, players: [E, F, G, H], teams: { team1: [E, F], team2: [G, H] } });

  beforeEach(() => {
    tracker.resetHistory();
  });

  it('swaps teammate/opponent pair stats for changed courts across a cross-court edit', () => {
    const prev = [court1(), court2()];
    const all = [A, B, C, D, E, F, G, H];
    tracker.applyRoundStats(prev, all);

    // swap A (court1 team1[0]) with E (court2 team1[0])
    const { courts: next } = applyCourtSwap(prev, [], courtSlot(0, 1, 0), courtSlot(1, 1, 0));
    tracker.applyManualEdit(prev, next, all);

    const { teammateCountMap } = tracker.snapshot();
    expect(teammateCountMap[pk(A, B)] ?? 0).toBe(0); // old pair gone
    expect(teammateCountMap[pk(E, F)] ?? 0).toBe(0);
    expect(teammateCountMap[pk(E, B)]).toBe(1); // new pairs
    expect(teammateCountMap[pk(A, F)]).toBe(1);
    expect(teammateCountMap[pk(C, D)]).toBe(1); // untouched team unchanged
    expect(teammateCountMap[pk(G, H)]).toBe(1);
  });

  it('reverses a recorded win when the winning court line-up changes', () => {
    const prev = [{ ...court1(), winner: 1 as const }, court2()];
    const all = [A, B, C, D, E, F, G, H, X];
    tracker.applyRoundStats(prev, all);
    tracker.recordWins(prev);

    expect(tracker.snapshot().winCountMap[A.id]).toBe(1);

    // sub X in for A on the winning court -> win is void
    const { courts: next } = applyCourtSwap(prev, [X], courtSlot(0, 1, 0), benchSlot(2, 0));
    tracker.applyManualEdit(prev, next, all);

    const snap = tracker.snapshot();
    expect(snap.winCountMap[A.id] ?? 0).toBe(0);
    expect(snap.winCountMap[B.id] ?? 0).toBe(0);
    expect(snap.lossCountMap[C.id] ?? 0).toBe(0);
    expect(snap.lossCountMap[D.id] ?? 0).toBe(0);
  });

  it('does not touch a court whose line-up did not change', () => {
    const prev = [court1(), { ...court2(), winner: 2 as const }];
    const all = [A, B, C, D, E, F, G, H];
    tracker.applyRoundStats(prev, all);
    tracker.recordWins(prev);

    // edit only court 1
    const { courts: next } = applyCourtSwap(prev, [], courtSlot(0, 1, 0), courtSlot(0, 2, 0));
    tracker.applyManualEdit(prev, next, all);

    const snap = tracker.snapshot();
    expect(snap.winCountMap[G.id]).toBe(1); // court 2 win preserved
    expect(snap.winCountMap[H.id]).toBe(1);
  });

  it('reconciles bench counts when a player is subbed off the court', () => {
    const prev = [court1()];
    const all = [A, B, C, D, X]; // X is benched
    tracker.applyRoundStats(prev, all);
    expect(tracker.snapshot().benchCountMap[X.id]).toBe(1);

    // swap A (court) with X (bench)
    const { courts: next, bench } = applyCourtSwap(prev, [X], courtSlot(0, 1, 0), benchSlot(1, 0));
    expect(bench.map(p => p.id)).toEqual([A.id]);
    tracker.applyManualEdit(prev, next, all);

    const snap = tracker.snapshot();
    expect(snap.benchCountMap[A.id]).toBe(1); // A now benched
    expect(snap.benchCountMap[X.id] ?? 0).toBe(0); // X no longer benched
  });

  it('returns the next assignments', () => {
    const prev = [court1()];
    const { courts: next } = applyCourtSwap(prev, [], courtSlot(0, 1, 0), courtSlot(0, 2, 0));
    expect(tracker.applyManualEdit(prev, next, [A, B, C, D])).toBe(next);
  });
});
