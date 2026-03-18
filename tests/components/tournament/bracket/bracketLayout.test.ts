import { describe, expect, it } from 'vitest';

import { CN, CW, MG, MH, SH, wbTop } from '../../../../src/components/tournament/bracket/bracketLayout';

describe('bracketLayout constants', () => {
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

describe('wbTop', () => {
  it('wbTop(0, 0) = 0', () => {
    expect(wbTop(0, 0)).toBe(0);
  });

  it('wbTop(0, 1) = SH', () => {
    expect(wbTop(0, 1)).toBe(SH);
  });

  it('wbTop(0, 2) = 2 * SH', () => {
    expect(wbTop(0, 2)).toBe(2 * SH);
  });

  it('wbTop(1, 0) = SH/2 (centered between two R1 slots)', () => {
    expect(wbTop(1, 0)).toBe(SH / 2);
  });

  it('wbTop(2, 0) = 3*SH/2 (centered between two R2 slots)', () => {
    expect(wbTop(2, 0)).toBe(3 * SH / 2);
  });
});
