import { describe, expect, it } from 'vitest';

import { clampCourtCount, isValidCourtCount, MAX_COURTS, MIN_COURTS } from '../../../src/components/court/courtCountUtils';

describe('isValidCourtCount', () => {
  it.each([
    [MIN_COURTS, true],
    [MAX_COURTS, true],
    [10, true],
    [0, false],
    [MAX_COURTS + 1, false],
    [NaN, false],
  ])('returns %s for %s', (value, expected) => {
    expect(isValidCourtCount(value)).toBe(expected);
  });
});

describe('clampCourtCount', () => {
  it.each([
    [10, 10],
    [0, MIN_COURTS],
    [-5, MIN_COURTS],
    [MAX_COURTS + 1, MAX_COURTS],
    [999, MAX_COURTS],
  ])('clamps %s to %s', (value, expected) => {
    expect(clampCourtCount(value)).toBe(expected);
  });
});
