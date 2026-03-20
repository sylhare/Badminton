import { describe, expect, it } from 'vitest';

import { CN, CW, MG, MH, SH, consolationTop, winnersTop } from '../../../../src/components/tournament/bracket/types';

describe('bracket/types constants', () => {
  it('has expected numeric values', () => {
    expect(MH).toBe(64);
    expect(MG).toBe(12);
    expect(SH).toBe(76);
    expect(CW).toBe(176);
    expect(CN).toBe(36);
  });

  it('SH = MH + MG', () => {
    expect(SH).toBe(MH + MG);
  });
});

describe('winnersTop', () => {
  it('winnersTop(0, 0) = 0', () => {
    expect(winnersTop(0, 0)).toBe(0);
  });

  it('winnersTop(0, 1) = SH', () => {
    expect(winnersTop(0, 1)).toBe(SH);
  });

  it('winnersTop(0, 2) = 2 * SH', () => {
    expect(winnersTop(0, 2)).toBe(2 * SH);
  });

  it('winnersTop(1, 0) = SH/2 (centered between two R1 slots)', () => {
    expect(winnersTop(1, 0)).toBe(SH / 2);
  });

  it('winnersTop(2, 0) = 3*SH/2 (centered between two R2 slots)', () => {
    expect(winnersTop(2, 0)).toBe(3 * SH / 2);
  });
});

describe('consolationTop', () => {
  it('tier 0: cols 0 and 1 match winnersTop(0,...)', () => {
    expect(consolationTop(0, 0)).toBe(winnersTop(0, 0));
    expect(consolationTop(0, 1)).toBe(winnersTop(0, 1));
    expect(consolationTop(1, 0)).toBe(winnersTop(0, 0));
    expect(consolationTop(1, 1)).toBe(winnersTop(0, 1));
  });

  it('tier 1: cols 2 and 3 match winnersTop(1,...)', () => {
    expect(consolationTop(2, 0)).toBe(winnersTop(1, 0));
    expect(consolationTop(3, 0)).toBe(winnersTop(1, 0));
  });

  it('tier 2: col 4 matches winnersTop(2,...)', () => {
    expect(consolationTop(4, 0)).toBe(winnersTop(2, 0));
  });
});
