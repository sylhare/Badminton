/**
 * Generic, side-effect-free swap primitive shared by every "move a player
 * between slots" surface — court assignments, the tournament setup, and the
 * demo sandbox. A layout is modelled as a list of groups (teams, or courts +
 * bench), and a slot is addressed by `{ group, index }`. Consumers map their
 * own structure to/from groups and keep this the single source of swap truth.
 */

export interface SlotAddr {
  /** Index of the group (e.g. a team, or the bench). */
  group: number;
  /** Index of the slot within the group. */
  index: number;
}

export function sameSlot(a: SlotAddr, b: SlotAddr): boolean {
  return a.group === b.group && a.index === b.index;
}

function inBounds(groups: unknown[][], addr: SlotAddr): boolean {
  const group = groups[addr.group];
  return !!group && addr.index >= 0 && addr.index < group.length;
}

/**
 * Immutably swaps the two items at addresses `a` and `b`, returning a new
 * nested array. The original is never mutated. If the two addresses are equal,
 * or either is out of range, the original `groups` reference is returned
 * unchanged (callers can use referential equality to detect a no-op).
 */
export function swapInGroups<T>(groups: T[][], a: SlotAddr, b: SlotAddr): T[][] {
  if (sameSlot(a, b)) return groups;
  if (!inBounds(groups, a) || !inBounds(groups, b)) return groups;

  const itemA = groups[a.group][a.index];
  const itemB = groups[b.group][b.index];

  return groups.map((group, gi) => {
    if (gi !== a.group && gi !== b.group) return group;
    const next = [...group];
    if (gi === a.group) next[a.index] = itemB;
    if (gi === b.group) next[b.index] = itemA;
    return next;
  });
}
