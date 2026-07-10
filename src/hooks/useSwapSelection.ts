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

  // onSwap is a side effect, so it must run outside the state updater (which
  // React's StrictMode intentionally double-invokes) — otherwise a swap fires
  // twice and cancels itself out. Taps are user-paced, so reading `selected`
  // from the closure is safe here.
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

  const clear = useCallback(() => setSelected(null), []);

  return { selected, handleTap, isSelected, clear };
}
