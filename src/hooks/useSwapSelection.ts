import { useCallback, useState } from 'react';

import type { SlotAddr } from '../utils/slotSwap';
import { sameSlot } from '../utils/slotSwap';

/**
 * Click/tap-to-swap state machine: tap one slot to select it, tap another to
 * swap the two, tap the selected slot again to cancel. Pairs with
 * `useSlotDragSwap` (whose `onTap` feeds `handleTap` here) so a surface can
 * offer both drag and tap-to-swap from a single shared core — used as the
 * accessible/touch-friendly fallback alongside dragging.
 */
export interface UseSwapSelection {
  selected: SlotAddr | null;
  handleTap: (addr: SlotAddr) => void;
  isSelected: (addr: SlotAddr) => boolean;
  clear: () => void;
}

export function useSwapSelection(onSwap: (from: SlotAddr, to: SlotAddr) => void): UseSwapSelection {
  const [selected, setSelected] = useState<SlotAddr | null>(null);

  const handleTap = useCallback((addr: SlotAddr) => {
    setSelected(prev => {
      if (!prev) return addr;
      if (sameSlot(prev, addr)) return null;
      onSwap(prev, addr);
      return null;
    });
  }, [onSwap]);

  const isSelected = useCallback(
    (addr: SlotAddr) => selected !== null && sameSlot(selected, addr),
    [selected],
  );

  const clear = useCallback(() => setSelected(null), []);

  return { selected, handleTap, isSelected, clear };
}
