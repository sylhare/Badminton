import { describe, expect, it } from 'vitest';

import { sameSlot, swapInGroups } from '../../src/utils/slotSwap';

describe('sameSlot', () => {
  it('is true only for identical group + index', () => {
    expect(sameSlot({ group: 0, index: 1 }, { group: 0, index: 1 })).toBe(true);
    expect(sameSlot({ group: 0, index: 1 }, { group: 1, index: 1 })).toBe(false);
    expect(sameSlot({ group: 0, index: 1 }, { group: 0, index: 0 })).toBe(false);
  });
});

describe('swapInGroups', () => {
  it('swaps two items in different groups', () => {
    const groups = [['a', 'b'], ['c', 'd']];
    const next = swapInGroups(groups, { group: 0, index: 0 }, { group: 1, index: 1 });
    expect(next).toEqual([['d', 'b'], ['c', 'a']]);
  });

  it('swaps two items within the same group', () => {
    const groups = [['a', 'b', 'c']];
    const next = swapInGroups(groups, { group: 0, index: 0 }, { group: 0, index: 2 });
    expect(next).toEqual([['c', 'b', 'a']]);
  });

  it('does not mutate the original groups', () => {
    const groups = [['a', 'b'], ['c', 'd']];
    const snapshot = JSON.parse(JSON.stringify(groups));
    swapInGroups(groups, { group: 0, index: 0 }, { group: 1, index: 0 });
    expect(groups).toEqual(snapshot);
  });

  it('returns new array references only for touched groups', () => {
    const groups = [['a', 'b'], ['c', 'd'], ['e', 'f']];
    const next = swapInGroups(groups, { group: 0, index: 0 }, { group: 1, index: 0 });
    expect(next[0]).not.toBe(groups[0]);
    expect(next[1]).not.toBe(groups[1]);
    expect(next[2]).toBe(groups[2]);
  });

  it('returns the same reference when addresses are equal (no-op)', () => {
    const groups = [['a', 'b']];
    expect(swapInGroups(groups, { group: 0, index: 1 }, { group: 0, index: 1 })).toBe(groups);
  });

  it('returns the same reference when an address is out of range', () => {
    const groups = [['a', 'b'], ['c']];
    expect(swapInGroups(groups, { group: 0, index: 0 }, { group: 1, index: 5 })).toBe(groups);
    expect(swapInGroups(groups, { group: 9, index: 0 }, { group: 0, index: 0 })).toBe(groups);
  });

  it('works with object items by reference', () => {
    const a = { id: 'a' };
    const b = { id: 'b' };
    const c = { id: 'c' };
    const groups = [[a, b], [c]];
    const next = swapInGroups(groups, { group: 0, index: 1 }, { group: 1, index: 0 });
    expect(next[0][1]).toBe(c);
    expect(next[1][0]).toBe(b);
    expect(next[0][0]).toBe(a);
  });
});
