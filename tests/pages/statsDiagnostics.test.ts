import { describe, expect, it } from 'vitest';

import {
  computeDiagnostics,
  getChipClass,
  getFairnessClass,
  getPlayerName,
  hasEntries,
} from '../../src/pages/statsDiagnostics';
import type { EngineSnapshot } from '../../src/types';
import { createMockPlayer } from '../data/testFactories';

const players = [
  createMockPlayer({ id: '1', name: 'Alice' }),
  createMockPlayer({ id: '2', name: 'Bob' }),
  createMockPlayer({ id: '3', name: 'Charlie' }),
];

const emptySnapshot: EngineSnapshot = {
  benchCountMap: {},
  singleCountMap: {},
  teammateCountMap: {},
  opponentCountMap: {},
  winCountMap: {},
  lossCountMap: {},
};

describe('hasEntries', () => {
  it('detects entries', () => {
    expect(hasEntries({ a: 1 })).toBe(true);
    expect(hasEntries({})).toBe(false);
  });
});

describe('getPlayerName', () => {
  it('resolves a known player and falls back to "removed" for an unknown id', () => {
    expect(getPlayerName(players, '1')).toBe('Alice');
    expect(getPlayerName(players, 'missing')).toBe('removed');
  });
});

describe('getFairnessClass / getChipClass', () => {
  it('buckets fairness score into good/neutral/warning', () => {
    expect(getFairnessClass(0.5)).toBe('good');
    expect(getFairnessClass(1.5)).toBe('neutral');
    expect(getFairnessClass(2.5)).toBe('warning');
  });

  it('buckets bench count into low/medium/medium-high/high', () => {
    expect(getChipClass(1)).toBe('low');
    expect(getChipClass(2)).toBe('medium');
    expect(getChipClass(3)).toBe('medium-high');
    expect(getChipClass(4)).toBe('high');
  });
});

describe('computeDiagnostics', () => {
  it('returns null when no players', () => {
    expect(computeDiagnostics(emptySnapshot, [])).toBeNull();
  });

  it('returns null when no snapshot', () => {
    expect(computeDiagnostics(null, players)).toBeNull();
  });

  it('returns null when no data in maps', () => {
    expect(computeDiagnostics(emptySnapshot, players)).toBeNull();
  });

  it('computes totals and fairness score from bench data', () => {
    const diagnostics = computeDiagnostics({
      ...emptySnapshot,
      benchCountMap: { '1': 2, '2': 0, '3': 0 },
      winCountMap: { '1': 1 },
    }, players);

    expect(diagnostics?.totalPlayers).toBe(3);
    expect(diagnostics?.neverBenched).toBe(0);
    expect(diagnostics?.benchedMultiple).toBe(1);
    expect(diagnostics?.maxBenchCount).toBe(2);
    expect(diagnostics?.minBenchCount).toBe(0);
  });

  it('uses the stored roundsPlayed when present', () => {
    const diagnostics = computeDiagnostics(
      { ...emptySnapshot, benchCountMap: { '1': 1 }, roundsPlayed: 7 },
      players,
    );

    expect(diagnostics?.totalRounds).toBe(7);
  });

  it('flags a bench imbalance warning when the spread is too wide', () => {
    const diagnostics = computeDiagnostics({
      ...emptySnapshot,
      benchCountMap: { '1': 10, '2': 0, '3': 0 },
      winCountMap: { '1': 1, '2': 1 },
    }, players);

    expect(diagnostics?.warnings.some(w => w.includes('Bench imbalance'))).toBe(true);
  });

  it('flags repeated teammate and opponent warnings above threshold', () => {
    const diagnostics = computeDiagnostics({
      ...emptySnapshot,
      benchCountMap: { '1': 0, '2': 0, '3': 0 },
      teammateCountMap: { '1|2': 5 },
      opponentCountMap: { '1|3': 5 },
    }, players);

    expect(diagnostics?.warnings.some(w => w.includes('teamed up'))).toBe(true);
    expect(diagnostics?.warnings.some(w => w.includes('faced each other'))).toBe(true);
  });

  it('flags a singles-overplay warning when one player dominates singles', () => {
    const diagnostics = computeDiagnostics({
      ...emptySnapshot,
      singleCountMap: { '1': 6, '2': 0, '3': 0 },
    }, players);

    expect(diagnostics?.warnings.some(w => w.includes('played singles'))).toBe(true);
    expect(diagnostics?.playersWithMultipleSingles).toBe(1);
  });

  it('produces no warnings for a balanced session', () => {
    const diagnostics = computeDiagnostics({
      ...emptySnapshot,
      benchCountMap: { '1': 1, '2': 1, '3': 1 },
      teammateCountMap: { '1|2': 1 },
      opponentCountMap: { '1|3': 1 },
      singleCountMap: { '1': 1 },
    }, players);

    expect(diagnostics?.warnings).toEqual([]);
  });

  it('handles single player without division by zero', () => {
    const singlePlayer = [createMockPlayer({ id: '1', name: 'Alice' })];
    const diagnostics = computeDiagnostics({
      ...emptySnapshot,
      benchCountMap: { '1': 1 },
    }, singlePlayer);

    expect(diagnostics).not.toBeNull();
    expect(Number.isNaN(diagnostics?.benchFairnessScore)).toBe(false);
    expect(diagnostics?.warnings.some(w => w.includes('Infinity'))).toBe(false);
    expect(diagnostics?.totalPlayers).toBe(1);
  });

  it('handles empty benchCounts without NaN in fairness score', () => {
    const diagnostics = computeDiagnostics({
      ...emptySnapshot,
      singleCountMap: { '1': 1 },
    }, players);

    expect(diagnostics).not.toBeNull();
    expect(Number.isNaN(diagnostics?.benchFairnessScore)).toBe(false);
    expect(diagnostics?.benchFairnessScore).toBe(0);
  });
});
