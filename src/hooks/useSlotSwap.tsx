import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { SlotAddr } from '../utils/slotSwap';
import { sameSlot } from '../utils/slotSwap';

import { slotStateClass, useSlotDragSwap } from './useSlotDragSwap';
import { useSwapSelection } from './useSwapSelection';

/**
 * The render contract a draggable/selectable player chip consumes: per-index
 * DOM props + the state classes for that index. Produced by
 * `useSlotSwap().binding(...)` and threaded down to the chip components
 * (TeamPlayerList / SinglesMatch / the tournament slots) so they stay unaware of
 * court indices, the drag hook, or the selection state machine.
 */
export interface SlotBinding {
  getProps: (index: number) => React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>;
  stateClass: (index: number) => string;
}

/** How long the post-swap "bump" affordance stays on the swapped slots (ms). */
const BUMP_MS = 360;

/**
 * Touch behaviour:
 * - `'edit-mode'`: a long-press enters a tap-to-swap edit mode. Used on the
 *   court, where a plain tap otherwise sets the winner, so swapping must be an
 *   explicit mode.
 * - `'tap'`: tapping always selects/swaps directly. Used in tournament setup,
 *   where a tap has no other meaning.
 */
export type SlotSwapTouchMode = 'edit-mode' | 'tap';

export interface UseSlotSwapOptions {
  onSwap: (from: SlotAddr, to: SlotAddr) => void;
  /** When false the whole gesture layer is inert. */
  enabled?: boolean;
  touch?: SlotSwapTouchMode;
}

export interface UseSlotSwap {
  /** Builds the per-chip binding for a group, given how to address its slots. */
  binding: (addrOf: (index: number) => SlotAddr) => SlotBinding;
  /** The floating drag label; render once near the surface root. */
  dragGhost: React.ReactNode;
  isDragging: boolean;
  /** True while a touch `'edit-mode'` tap-to-swap session is active. */
  isEditMode: boolean;
  /** Leave edit mode and drop the current selection. */
  exitEditMode: () => void;
  /** Drop the current selection without touching edit mode. */
  clearSelection: () => void;
}

/**
 * The single, self-contained swap surface: it wires the pure pointer-gesture
 * detector (`useSlotDragSwap`) to the tap/click selection state machine
 * (`useSwapSelection`) and owns the shared "landed" bump so a swap looks and
 * feels identical whether it came from a drag-drop or a tap-to-swap. Consumers
 * only ever see one cohesive API — they never touch the drag hook, the
 * selection hook, or the animation state directly.
 */
export function useSlotSwap({
  onSwap,
  enabled = true,
  touch = 'tap',
}: UseSlotSwapOptions): UseSlotSwap {
  const [bumpAddrs, setBumpAddrs] = useState<SlotAddr[]>([]);
  const bumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  const triggerBump = useCallback((addrs: SlotAddr[]) => {
    setBumpAddrs(addrs);
    if (bumpTimerRef.current !== null) clearTimeout(bumpTimerRef.current);
    bumpTimerRef.current = setTimeout(() => setBumpAddrs([]), BUMP_MS);
  }, []);

  useEffect(() => () => {
    if (bumpTimerRef.current !== null) clearTimeout(bumpTimerRef.current);
  }, []);

  const onSwapRef = useRef(onSwap);
  onSwapRef.current = onSwap;
  const handleSwap = useCallback((from: SlotAddr, to: SlotAddr) => {
    triggerBump([from, to]);
    onSwapRef.current(from, to);
  }, [triggerBump]);

  const selection = useSwapSelection(handleSwap);
  const { clear: clearSelection, select: selectSlot, handleTap, isSelected } = selection;

  const exitEditMode = useCallback(() => {
    setIsEditMode(false);
    clearSelection();
  }, [clearSelection]);

  const drag = useSlotDragSwap({
    onSwap: handleSwap,
    onTap: touch === 'tap' || isEditMode ? handleTap : undefined,
    onLongPress:
      touch === 'edit-mode'
        ? (addr) => {
            setIsEditMode(true);
            selectSlot(addr);
          }
        : undefined,
    enabled,
  });

  const binding = (addrOf: (index: number) => SlotAddr): SlotBinding => ({
    getProps: (index) => drag.getSlotProps(addrOf(index)),
    stateClass: (index) => {
      const addr = addrOf(index);
      return [
        slotStateClass(drag.slotState(addr)),
        isSelected(addr) && 'swap-selected',
        bumpAddrs.some(a => sameSlot(a, addr)) && 'slot-bumped',
      ].filter(Boolean).join(' ');
    },
  });

  return {
    binding,
    dragGhost: drag.dragGhost,
    isDragging: drag.isDragging,
    isEditMode,
    exitEditMode,
    clearSelection,
  };
}
