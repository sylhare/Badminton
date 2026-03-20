import { describe, expect, it } from 'vitest';

import { CONNECTOR_WIDTH, COLUMN_WIDTH, MATCH_GAP, MATCH_HEIGHT, SLOT_HEIGHT, consolationTop, winnersTop } from '../../../src/tournament/bracket/types';

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
