import { describe, expect, it } from 'vitest';

import { CONNECTOR_WIDTH, COLUMN_WIDTH, MATCH_GAP, MATCH_HEIGHT, SLOT_HEIGHT, winnersTop } from '../../../src/tournament/types';

describe('bracket/types constants', () => {
  it('has expected numeric values', () => {
    expect(MATCH_HEIGHT).toBe(64);
    expect(MATCH_GAP).toBe(12);
    expect(SLOT_HEIGHT).toBe(76);
    expect(COLUMN_WIDTH).toBe(176);
    expect(CONNECTOR_WIDTH).toBe(36);
  });

  it('SLOT_HEIGHT = MATCH_HEIGHT + MATCH_GAP', () => {
    expect(SLOT_HEIGHT).toBe(MATCH_HEIGHT + MATCH_GAP);
  });
});

describe('winnersTop', () => {
  it('winnersTop(0, 0) = 0', () => {
    expect(winnersTop(0, 0)).toBe(0);
  });

  it('winnersTop(0, 1) = SLOT_HEIGHT', () => {
    expect(winnersTop(0, 1)).toBe(SLOT_HEIGHT);
  });

  it('winnersTop(0, 2) = 2 * SLOT_HEIGHT', () => {
    expect(winnersTop(0, 2)).toBe(2 * SLOT_HEIGHT);
  });

  it('winnersTop(1, 0) = SLOT_HEIGHT/2 (centered between two R1 slots)', () => {
    expect(winnersTop(1, 0)).toBe(SLOT_HEIGHT / 2);
  });

  it('winnersTop(2, 0) = 3*SLOT_HEIGHT/2 (centered between two R2 slots)', () => {
    expect(winnersTop(2, 0)).toBe(3 * SLOT_HEIGHT / 2);
  });
});

