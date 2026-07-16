import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { SlotAddr } from '../utils/slotSwap';
import { sameSlot } from '../utils/slotSwap';

/**
 * Unified pointer-based drag-to-swap gesture, shared by the court assignments
 * and the tournament setup. It deliberately does NOT use the native HTML5
 * drag-and-drop API because that has no touch support.
 *
 * Gesture model (gesture-split, so a plain tap still selects a winner):
 * - Mouse/pen: a drag begins as soon as the pointer moves past a small
 *   threshold; a floating label follows the cursor and the hovered slot is
 *   outlined. A press with no movement is reported via `onTap`.
 * - Touch: dragging with a finger is unreliable on small screens, so instead a
 *   long press reports `onLongPress` (the caller flips into a tap-to-swap "edit
 *   mode"). If no `onLongPress` handler is supplied the long press falls back to
 *   arming a finger-drag (the slot "shakes" once armed). A quick tap is reported
 *   via `onTap`.
 *
 * Drop targets are located with `document.elementFromPoint`, matched against
 * the `data-slot` attribute that `getSlotProps` stamps onto every slot. The
 * floating drag label is `pointer-events: none` so it never shadows the slot
 * beneath the cursor.
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

function labelForSlot(addr: SlotAddr): string {
  const el = document.querySelector(`[${SLOT_ATTR}="${encodeSlot(addr)}"]`);
  return el?.textContent?.trim() ?? '';
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

/** Portals into `.app` rather than `document.body` so the ghost inherits the smart-mode `--color-primary` override, which is scoped to `.app`. */
function ghostPortalTarget(): HTMLElement {
  if (typeof document !== 'undefined') {
    const app = document.querySelector('.app');
    if (app instanceof HTMLElement) return app;
  }
  return document.body;
}

export interface UseSlotDragSwapOptions {
  onSwap: (from: SlotAddr, to: SlotAddr) => void;
  onTap?: (addr: SlotAddr) => void;
  /**
   * Fired when a touch long-press completes. When supplied it takes over the
   * touch long-press (no finger-drag is armed): the caller is expected to enter
   * a tap-to-swap "edit mode" instead. When omitted the long-press arms a
   * finger-drag as before.
   */
  onLongPress?: (addr: SlotAddr) => void;
  /** Touch long-press duration before a drag arms / edit mode engages, in ms. */
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
  /** A long press has fired for this gesture, so pointerup must not also tap. */
  longPressed: boolean;
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
  /**
   * The floating label that follows the cursor mid-drag. Render it once near the
   * root of the consuming surface (it portals itself to `document.body`).
   */
  dragGhost: React.ReactNode;
}

export function useSlotDragSwap({
  onSwap,
  onTap,
  onLongPress,
  longPressMs = 350,
  moveTolerancePx = 8,
  enabled = true,
}: UseSlotDragSwapOptions): UseSlotDragSwap {
  const gestureRef = useRef<Gesture | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const justDraggedRef = useRef(false);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const ghostPosRef = useRef({ x: 0, y: 0 });
  const onSwapRef = useRef(onSwap);
  const onTapRef = useRef(onTap);
  const onLongPressRef = useRef(onLongPress);
  onSwapRef.current = onSwap;
  onTapRef.current = onTap;
  onLongPressRef.current = onLongPress;
  const [draggingAddr, setDraggingAddr] = useState<SlotAddr | null>(null);
  const [armedAddr, setArmedAddr] = useState<SlotAddr | null>(null);
  const [dropAddr, setDropAddr] = useState<SlotAddr | null>(null);
  const [ghostLabel, setGhostLabel] = useState<string | null>(null);
  const [pointerActive, setPointerActive] = useState(false);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const positionGhost = useCallback((x: number, y: number) => {
    ghostPosRef.current = { x, y };
    if (ghostRef.current) {
      ghostRef.current.style.transform = `translate(${x}px, ${y}px)`;
    }
  }, []);

  const endGesture = useCallback(() => {
    clearLongPress();
    gestureRef.current = null;
    setPointerActive(false);
    setDraggingAddr(null);
    setArmedAddr(null);
    setDropAddr(null);
    setGhostLabel(null);
  }, [clearLongPress]);

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
        positionGhost(event.clientX, event.clientY);
        setGhostLabel(labelForSlot(gesture.source));
      }

      event.preventDefault();
      positionGhost(event.clientX, event.clientY);
      const target = slotFromPoint(event.clientX, event.clientY);
      const next = target && !sameSlot(target, gesture.source) ? target : null;
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
      } else if (gesture.longPressed) {
        justDraggedRef.current = true;
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
    if (event.button !== undefined && event.button !== 0) return;

    justDraggedRef.current = false;
    gestureRef.current = {
      source: addr,
      pointerType: event.pointerType || 'mouse',
      startX: event.clientX,
      startY: event.clientY,
      armed: false,
      dragging: false,
      moved: false,
      longPressed: false,
    };
    setPointerActive(true);

    if ((event.pointerType || 'mouse') === 'touch') {
      clearLongPress();
      longPressTimerRef.current = setTimeout(() => {
        const gesture = gestureRef.current;
        if (!gesture || gesture.dragging) return;
        if (onLongPressRef.current) {
          gesture.longPressed = true;
          onLongPressRef.current(gesture.source);
        } else {
          gesture.armed = true;
          setArmedAddr(gesture.source);
        }
      }, longPressMs);
    } else {
      positionGhost(event.clientX, event.clientY);
      setGhostLabel(labelForSlot(addr));
    }
  }, [enabled, longPressMs, clearLongPress, positionGhost]);

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

  const dragGhost = ghostLabel !== null
    ? createPortal(
        <div
          ref={node => {
            ghostRef.current = node;
            if (node) {
              const { x, y } = ghostPosRef.current;
              node.style.transform = `translate(${x}px, ${y}px)`;
            }
          }}
          className="slot-drag-ghost"
          aria-hidden="true"
        >
          <span className="slot-drag-ghost-pill">{ghostLabel}</span>
        </div>,
        ghostPortalTarget(),
      )
    : null;

  return { getSlotProps, slotState, isDragging: draggingAddr !== null, dragGhost };
}
