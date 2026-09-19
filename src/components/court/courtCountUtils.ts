import { clamp } from '../../utils/numberUtils';

export const MIN_COURTS = 1;
export const MAX_COURTS = 20;

/** True when the parsed court count is a whole number within the allowed range. */
export const isValidCourtCount = (value: number): boolean =>
  !isNaN(value) && value >= MIN_COURTS && value <= MAX_COURTS;

/** Clamps a court count into the allowed [MIN_COURTS, MAX_COURTS] range. */
export const clampCourtCount = (value: number): number => clamp(value, MIN_COURTS, MAX_COURTS);
