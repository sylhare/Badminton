import { useCallback, useState } from 'react';

import type { SlotAddr } from '../utils/slotSwap';
import { sameSlot } from '../utils/slotSwap';

/**
 * Click/tap-to-swap state machine: tap one slot to select it, tap another to
 * swap the two, tap the selected slot again to cancel. Pairs with
 * `useSlotDragSwap` (whose `onTap` feeds `handleTap` here) so a surface can
 * offer both drag and tap-to-swap from a single shared core — used as the
 * accessible/touch-friendly fallback alongside dragging.
 *
 * `onSwap` is invoked outside the state updater on purpose: StrictMode
 * double-invokes updaters, and a doubled swap of the same slots cancels itself
 * out (guarded by a StrictMode test).
 */
export interface UseSwapSelection {
  selected: SlotAddr | null;
  handleTap: (addr: SlotAddr) => void;
  isSelected: (addr: SlotAddr) => boolean;
  /** Force a slot to be the current selection (e.g. a long-press picks it up). */
  select: (addr: SlotAddr) => void;
  clear: () => void;
}

export function useSwapSelection(onSwap: (from: SlotAddr, to: SlotAddr) => void): UseSwapSelection {
  const [selected, setSelected] = useState<SlotAddr | null>(null);

  const handleTap = useCallback((addr: SlotAddr) => {
    if (selected === null) {
      setSelected(addr);
      return;
    }
    if (sameSlot(selected, addr)) {
      setSelected(null);
      return;
    }
    onSwap(selected, addr);
    setSelected(null);
  }, [selected, onSwap]);

  const isSelected = useCallback(
    (addr: SlotAddr) => selected !== null && sameSlot(selected, addr),
    [selected],
  );

  const select = useCallback((addr: SlotAddr) => setSelected(addr), []);
  const clear = useCallback(() => setSelected(null), []);

  return { selected, handleTap, isSelected, select, clear };
}
