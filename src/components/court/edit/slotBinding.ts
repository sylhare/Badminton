import type React from 'react';

import type { UseSlotDragSwap } from '../../../hooks/useSlotDragSwap';
import { slotStateClass } from '../../../hooks/useSlotDragSwap';
import type { SlotAddr } from '../../../utils/slotSwap';

/**
 * A per-team view over the shared drag hook, indexed by the player's position
 * within the team. Threaded down to `TeamPlayerList` / `SinglesMatch` so each
 * player chip becomes an addressable, draggable slot without those components
 * knowing about court indices or the hook itself.
 */
export interface SlotBinding {
  getProps: (index: number) => React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>;
  stateClass: (index: number) => string;
}

export function makeBinding(drag: UseSlotDragSwap, addrOf: (index: number) => SlotAddr): SlotBinding {
  return {
    getProps: (index) => drag.getSlotProps(addrOf(index)),
    stateClass: (index) => slotStateClass(drag.slotState(addrOf(index))),
  };
}
