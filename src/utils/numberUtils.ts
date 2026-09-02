/** Clamps a value into the inclusive [min, max] range. */
export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));
