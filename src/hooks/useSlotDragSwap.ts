import { useCallback, useEffect, useRef, useState } from 'react';

import type { SlotAddr } from '../utils/slotSwap';
import { sameSlot } from '../utils/slotSwap';

/**
 * Unified pointer-based drag-to-swap gesture, shared by the court assignments
 * and the tournament setup. It deliberately does NOT use the native HTML5
 * drag-and-drop API because that has no touch support.
 *
 * Gesture model (gesture-split, so a plain tap still selects a winner):
 * - Mouse/pen: a drag begins as soon as the pointer moves past a small
 *   threshold. A press with no movement is reported via `onTap`.
 * - Touch: a drag must be armed by a long press (the slot "shakes" once armed);
 *   moving before the long press fires is treated as a scroll and cancels the
 *   gesture. A quick tap is reported via `onTap`.
 *
 * Drop targets are located with `document.elementFromPoint`, matched against
 * the `data-slot` attribute that `getSlotProps` stamps onto every slot.
 */

const SLOT_ATTR = 'data-slot';

export function encodeSlot(addr: SlotAddr): string {
  return `${addr.group}:${addr.index}`;
}

export function decodeSlot(value: string | null | undefined): SlotAddr | null {
  if (!value) return null;
  const [group, index] = value.split(':');
  const g = Number(group);
  const i = Number(index);
  if (!Number.isInteger(g) || !Number.isInteger(i)) return null;
  return { group: g, index: i };
}

function slotFromPoint(x: number, y: number): SlotAddr | null {
  const el = document.elementFromPoint(x, y);
  const slotEl = el?.closest(`[${SLOT_ATTR}]`);
  return decodeSlot(slotEl?.getAttribute(SLOT_ATTR));
}

export interface SlotGestureState {
  /** This slot is currently being dragged. */
  isDragging: boolean;
  /** The pointer is currently hovering this slot as a drop target. */
  isDropTarget: boolean;
  /** A touch long-press has armed this slot for dragging (drives the shake). */
  isArmed: boolean;
}

/** Maps a slot's gesture state to the CSS affordance classes. */
export function slotStateClass(state: SlotGestureState): string {
  return [
    state.isDragging && 'slot-dragging',
    state.isDropTarget && 'slot-drop-target',
    state.isArmed && 'slot-armed',
  ].filter(Boolean).join(' ');
}

export interface UseSlotDragSwapOptions {
  onSwap: (from: SlotAddr, to: SlotAddr) => void;
  onTap?: (addr: SlotAddr) => void;
  /** Touch long-press duration before a drag arms, in ms. */
  longPressMs?: number;
  /** Movement (px) that starts a mouse drag / cancels a pending touch long-press. */
  moveTolerancePx?: number;
  /** When false, the hook is inert (no drag, taps pass straight to onTap). */
  enabled?: boolean;
}

interface Gesture {
  source: SlotAddr;
  pointerType: string;
  startX: number;
  startY: number;
  armed: boolean;
  dragging: boolean;
  moved: boolean;
}

export interface UseSlotDragSwap {
  getSlotProps: (addr: SlotAddr) => {
    [SLOT_ATTR]: string;
    onPointerDown: (event: React.PointerEvent) => void;
    onClickCapture: (event: React.MouseEvent) => void;
    style?: React.CSSProperties;
  };
  slotState: (addr: SlotAddr) => SlotGestureState;
  /** True while any drag gesture is in progress. */
  isDragging: boolean;
}

export function useSlotDragSwap({
  onSwap,
  onTap,
  longPressMs = 350,
  moveTolerancePx = 8,
  enabled = true,
}: UseSlotDragSwapOptions): UseSlotDragSwap {
  const gestureRef = useRef<Gesture | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set when a drag just finished, so the synthetic click that some browsers
  // fire afterwards is swallowed instead of being treated as a winner tap.
  const justDraggedRef = useRef(false);
  // Held in refs so the global-listener effect below does not re-subscribe on
  // every render (callers commonly pass fresh inline callbacks).
  const onSwapRef = useRef(onSwap);
  const onTapRef = useRef(onTap);
  onSwapRef.current = onSwap;
  onTapRef.current = onTap;
  const [draggingAddr, setDraggingAddr] = useState<SlotAddr | null>(null);
  const [armedAddr, setArmedAddr] = useState<SlotAddr | null>(null);
  const [dropAddr, setDropAddr] = useState<SlotAddr | null>(null);
  // Flips true on pointer-down so the global listeners (below) are subscribed
  // only while a gesture is live, not for the whole time the hook is mounted.
  const [pointerActive, setPointerActive] = useState(false);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const endGesture = useCallback(() => {
    clearLongPress();
    gestureRef.current = null;
    setPointerActive(false);
    setDraggingAddr(null);
    setArmedAddr(null);
    setDropAddr(null);
  }, [clearLongPress]);

  // Global move/up listeners are attached only while a gesture is live.
  useEffect(() => {
    if (!enabled || !pointerActive) return;

    const handleMove = (event: PointerEvent) => {
      const gesture = gestureRef.current;
      if (!gesture) return;

      const dx = event.clientX - gesture.startX;
      const dy = event.clientY - gesture.startY;
      const movedPast = Math.hypot(dx, dy) > moveTolerancePx;
      if (movedPast) gesture.moved = true;

      const isTouch = gesture.pointerType === 'touch';

      if (!gesture.dragging) {
        if (isTouch) {
          // Movement before the long-press arms = the user is scrolling.
          if (movedPast && !gesture.armed) {
            endGesture();
            return;
          }
          if (!gesture.armed) return;
        } else if (!movedPast) {
          return;
        }
        gesture.dragging = true;
        setDraggingAddr(gesture.source);
      }

      event.preventDefault();
      const target = slotFromPoint(event.clientX, event.clientY);
      const next = target && !sameSlot(target, gesture.source) ? target : null;
      // `slotFromPoint` allocates a fresh addr each move; only re-render when the
      // hovered slot actually changes, otherwise every pointermove churns the grid.
      setDropAddr(prev =>
        prev === next || (prev && next && sameSlot(prev, next)) ? prev : next,
      );
    };

    const handleUp = (event: PointerEvent) => {
      const gesture = gestureRef.current;
      if (!gesture) return;

      if (gesture.dragging) {
        justDraggedRef.current = true;
        const target = slotFromPoint(event.clientX, event.clientY);
        if (target && !sameSlot(target, gesture.source)) {
          onSwapRef.current(gesture.source, target);
        }
      } else if (!gesture.moved) {
        onTapRef.current?.(gesture.source);
      }
      endGesture();
    };

    window.addEventListener('pointermove', handleMove, { passive: false });
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', endGesture);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', endGesture);
    };
  }, [enabled, pointerActive, moveTolerancePx, endGesture]);

  const onPointerDown = useCallback((addr: SlotAddr, event: React.PointerEvent) => {
    if (!enabled) return;
    if (event.button !== undefined && event.button !== 0) return; // primary button only

    justDraggedRef.current = false;
    gestureRef.current = {
      source: addr,
      pointerType: event.pointerType || 'mouse',
      startX: event.clientX,
      startY: event.clientY,
      armed: false,
      dragging: false,
      moved: false,
    };
    setPointerActive(true);

    if ((event.pointerType || 'mouse') === 'touch') {
      clearLongPress();
      longPressTimerRef.current = setTimeout(() => {
        const gesture = gestureRef.current;
        if (!gesture || gesture.dragging) return;
        gesture.armed = true;
        setArmedAddr(gesture.source);
      }, longPressMs);
    }
  }, [enabled, longPressMs, clearLongPress]);

  const onClickCapture = useCallback((event: React.MouseEvent) => {
    if (justDraggedRef.current) {
      event.stopPropagation();
      event.preventDefault();
      justDraggedRef.current = false;
    }
  }, []);

  const getSlotProps = useCallback((addr: SlotAddr) => ({
    [SLOT_ATTR]: encodeSlot(addr),
    onPointerDown: (event: React.PointerEvent) => onPointerDown(addr, event),
    onClickCapture,
    style: enabled ? ({ touchAction: 'manipulation' } as React.CSSProperties) : undefined,
  }), [enabled, onPointerDown, onClickCapture]);

  const slotState = useCallback((addr: SlotAddr): SlotGestureState => ({
    isDragging: draggingAddr !== null && sameSlot(addr, draggingAddr),
    isDropTarget: dropAddr !== null && sameSlot(addr, dropAddr),
    isArmed: armedAddr !== null && sameSlot(addr, armedAddr),
  }), [draggingAddr, dropAddr, armedAddr]);

  return { getSlotProps, slotState, isDragging: draggingAddr !== null };
}
