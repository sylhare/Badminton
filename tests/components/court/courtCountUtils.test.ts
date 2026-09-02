import { describe, expect, it } from 'vitest';

import { clampCourtCount, isValidCourtCount, MAX_COURTS, MIN_COURTS } from '../../../src/components/court/courtCountUtils';

describe('isValidCourtCount', () => {
  it('accepts values within [MIN_COURTS, MAX_COURTS]', () => {
    expect(isValidCourtCount(MIN_COURTS)).toBe(true);
    expect(isValidCourtCount(MAX_COURTS)).toBe(true);
    expect(isValidCourtCount(10)).toBe(true);
  });

  it('rejects out-of-range and NaN values', () => {
    expect(isValidCourtCount(0)).toBe(false);
    expect(isValidCourtCount(MAX_COURTS + 1)).toBe(false);
    expect(isValidCourtCount(NaN)).toBe(false);
  });
});

describe('clampCourtCount', () => {
  it('leaves in-range values unchanged', () => {
    expect(clampCourtCount(10)).toBe(10);
  });

  it('clamps below MIN_COURTS up to MIN_COURTS', () => {
    expect(clampCourtCount(0)).toBe(MIN_COURTS);
    expect(clampCourtCount(-5)).toBe(MIN_COURTS);
  });

  it('clamps above MAX_COURTS down to MAX_COURTS', () => {
    expect(clampCourtCount(MAX_COURTS + 1)).toBe(MAX_COURTS);
    expect(clampCourtCount(999)).toBe(MAX_COURTS);
  });
});
