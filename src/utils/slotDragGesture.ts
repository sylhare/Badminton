import type { SlotAddr } from './slotSwap';
import { sameSlot } from './slotSwap';

/**
 * Pure decision logic behind the pointer-move/pointer-up branching in
 * `useSlotDragSwap`, split out so the touch-vs-mouse gesture state machine is
 * unit-testable without simulating DOM pointer events.
 */

export type MoveAction = 'ignore' | 'cancel' | 'startDrag' | 'continueDrag';

export interface MoveDecisionInput {
  isTouch: boolean;
  /** A touch long-press has armed this gesture for a finger-drag. */
  armed: boolean;
  /** The gesture has already transitioned into an active drag. */
  dragging: boolean;
  /** The pointer has moved past the move-tolerance threshold. */
  movedPast: boolean;
}

/**
 * Decides what a pointermove should do to a not-yet-swapped gesture:
 * - mouse: starts dragging once it moves past the tolerance.
 * - touch, not armed: any movement before the long-press cancels the gesture
 *   (it reads as a scroll), so only an already-armed touch can start a drag.
 */
export function decideMoveAction({ isTouch, armed, dragging, movedPast }: MoveDecisionInput): MoveAction {
  if (dragging) return 'continueDrag';
  if (!isTouch) return movedPast ? 'startDrag' : 'ignore';
  if (movedPast && !armed) return 'cancel';
  return armed ? 'startDrag' : 'ignore';
}

/** The drop target for a slot under the pointer, or null when it's the drag source itself. */
export function resolveDropTarget(source: SlotAddr, target: SlotAddr | null): SlotAddr | null {
  return target && !sameSlot(target, source) ? target : null;
}

/** True when two optional slot addresses are the same reference, or both address the same slot. */
export function sameAddrOrBothNull(a: SlotAddr | null, b: SlotAddr | null): boolean {
  return a === b || (a !== null && b !== null && sameSlot(a, b));
}

export type UpAction = 'swap' | 'suppressClick' | 'tap' | 'none';

export interface UpDecisionInput {
  dragging: boolean;
  /** A touch long-press already fired `onLongPress` for this gesture. */
  longPressed: boolean;
  /** The pointer moved past the tolerance at any point during the gesture. */
  moved: boolean;
}

/** Decides what a pointerup should do once a gesture ends. */
export function decideUpAction({ dragging, longPressed, moved }: UpDecisionInput): UpAction {
  if (dragging) return 'swap';
  if (longPressed) return 'suppressClick';
  return moved ? 'none' : 'tap';
}
