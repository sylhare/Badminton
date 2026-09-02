import { describe, expect, it } from 'vitest';

import { decideMoveAction, decideUpAction, resolveDropTarget, sameAddrOrBothNull } from '../../src/utils/slotDragGesture';

describe('decideMoveAction', () => {
  it('continues an already-active drag regardless of pointer type', () => {
    expect(decideMoveAction({ isTouch: false, armed: false, dragging: true, movedPast: false })).toBe('continueDrag');
    expect(decideMoveAction({ isTouch: true, armed: false, dragging: true, movedPast: true })).toBe('continueDrag');
  });

  it('starts a mouse drag once it moves past the tolerance, ignores it before', () => {
    expect(decideMoveAction({ isTouch: false, armed: false, dragging: false, movedPast: true })).toBe('startDrag');
    expect(decideMoveAction({ isTouch: false, armed: false, dragging: false, movedPast: false })).toBe('ignore');
  });

  it('cancels an unarmed touch gesture that moves (reads as a scroll)', () => {
    expect(decideMoveAction({ isTouch: true, armed: false, dragging: false, movedPast: true })).toBe('cancel');
  });

  it('ignores an unarmed touch gesture that has not moved', () => {
    expect(decideMoveAction({ isTouch: true, armed: false, dragging: false, movedPast: false })).toBe('ignore');
  });

  it('starts a touch drag once armed, whether or not it has moved yet', () => {
    expect(decideMoveAction({ isTouch: true, armed: true, dragging: false, movedPast: true })).toBe('startDrag');
    expect(decideMoveAction({ isTouch: true, armed: true, dragging: false, movedPast: false })).toBe('startDrag');
  });
});

describe('resolveDropTarget', () => {
  const source = { group: 0, index: 0 };

  it('returns null when there is no target under the pointer', () => {
    expect(resolveDropTarget(source, null)).toBeNull();
  });

  it('returns null when the target is the drag source itself', () => {
    expect(resolveDropTarget(source, { group: 0, index: 0 })).toBeNull();
  });

  it('returns the target when it differs from the source', () => {
    const target = { group: 1, index: 2 };
    expect(resolveDropTarget(source, target)).toEqual(target);
  });
});

describe('sameAddrOrBothNull', () => {
  it('treats two nulls as the same', () => {
    expect(sameAddrOrBothNull(null, null)).toBe(true);
  });

  it('treats null and a slot as different', () => {
    expect(sameAddrOrBothNull(null, { group: 0, index: 0 })).toBe(false);
    expect(sameAddrOrBothNull({ group: 0, index: 0 }, null)).toBe(false);
  });

  it('treats two different object instances addressing the same slot as the same', () => {
    expect(sameAddrOrBothNull({ group: 1, index: 2 }, { group: 1, index: 2 })).toBe(true);
  });

  it('treats different slots as different', () => {
    expect(sameAddrOrBothNull({ group: 1, index: 2 }, { group: 1, index: 3 })).toBe(false);
  });
});

describe('decideUpAction', () => {
  it('swaps when the gesture ends mid-drag', () => {
    expect(decideUpAction({ dragging: true, longPressed: false, moved: true })).toBe('swap');
  });

  it('swaps take priority even if longPressed was somehow also set', () => {
    expect(decideUpAction({ dragging: true, longPressed: true, moved: true })).toBe('swap');
  });

  it('suppresses the trailing click after a long-press fired', () => {
    expect(decideUpAction({ dragging: false, longPressed: true, moved: false })).toBe('suppressClick');
  });

  it('reports a tap when the pointer never moved and nothing else fired', () => {
    expect(decideUpAction({ dragging: false, longPressed: false, moved: false })).toBe('tap');
  });

  it('does nothing when the pointer moved but never crossed into a drag', () => {
    expect(decideUpAction({ dragging: false, longPressed: false, moved: true })).toBe('none');
  });
});
