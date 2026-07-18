/**
 * The chip render contract lives with the swap logic in the hooks layer; it is
 * re-exported here so the chip components (TeamPlayerList / SinglesMatch) can
 * keep importing it from their own neighbourhood without depending on hooks.
 */
export type { SlotBinding } from '../../../hooks/useSlotSwap';
