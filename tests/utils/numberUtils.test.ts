import { describe, expect, it } from 'vitest';

import { clamp, mean, sum } from '../../src/utils/numberUtils';

describe('numberUtils', () => {
  describe('clamp', () => {
    it('clamps values within range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });
  });

  describe('sum', () => {
    it('sums array of numbers', () => {
      expect(sum([1, 2, 3, 4, 5])).toBe(15);
      expect(sum([10, -5, 3])).toBe(8);
      expect(sum([])).toBe(0);
    });
  });

  describe('mean', () => {
    it('calculates average of array', () => {
      expect(mean([2, 4, 6, 8])).toBe(5);
      expect(mean([10])).toBe(10);
      expect(mean([])).toBe(0);
    });
  });
});
