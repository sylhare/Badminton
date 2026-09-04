/** Clamps a value into the inclusive [min, max] range. */
export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** Sums all numbers in an array. */
export const sum = (arr: number[]): number =>
  arr.reduce((a, b) => a + b, 0);

/** Computes the mean (average) of an array, or 0 if empty. */
export const mean = (arr: number[]): number =>
  arr.length > 0 ? sum(arr) / arr.length : 0;
