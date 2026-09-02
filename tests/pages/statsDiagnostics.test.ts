import { describe, expect, it } from 'vitest';

import {
  computeDiagnostics,
  formatPair,
  getChipClass,
  getFairnessClass,
  getMax,
  getMin,
  getPlayerName,
  getRepeatedPairs,
  getWarningThreshold,
  hasEntries,
  sumValues,
} from '../../src/pages/statsDiagnostics';
import { createMockPlayer } from '../data/testFactories';

const players = [
  createMockPlayer({ id: '1', name: 'Alice' }),
  createMockPlayer({ id: '2', name: 'Bob' }),
  createMockPlayer({ id: '3', name: 'Charlie' }),
];

const emptyMaps = {
  bench: {},
  teammate: {},
  opponent: {},
  single: {},
  win: {},
  loss: {},
};

describe('sumValues / hasEntries / getMin / getMax', () => {
  it('sums, detects entries, and finds min/max, defaulting to 0 when empty', () => {
    expect(sumValues({ a: 2, b: 3 })).toBe(5);
    expect(sumValues({})).toBe(0);
    expect(hasEntries({ a: 1 })).toBe(true);
    expect(hasEntries({})).toBe(false);
    expect(getMin({ a: 5, b: 1 })).toBe(1);
    expect(getMin({})).toBe(0);
    expect(getMax({ a: 5, b: 1 })).toBe(5);
    expect(getMax({})).toBe(0);
  });
});

describe('getPlayerName / formatPair', () => {
  it('resolves a known player and falls back to "removed" for an unknown id', () => {
    expect(getPlayerName(players, '1')).toBe('Alice');
    expect(getPlayerName(players, 'missing')).toBe('removed');
  });

  it('formats a pair key using the given separator', () => {
    expect(formatPair(players, '1|2', ' & ')).toBe('Alice & Bob');
    expect(formatPair(players, '2|3', ' vs ')).toBe('Bob vs Charlie');
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

describe('getRepeatedPairs', () => {
  it('keeps only pairs with count > 1, formatted and sorted descending, capped at 10', () => {
    const map = { '1|2': 3, '2|3': 1, '1|3': 5 };
    expect(getRepeatedPairs(players, map, ' & ')).toEqual([
      { pair: 'Alice & Charlie', count: 5 },
      { pair: 'Alice & Bob', count: 3 },
    ]);
  });
});

describe('getWarningThreshold', () => {
  it('is at least 4, or double the average, or average + 3', () => {
    expect(getWarningThreshold(0)).toBe(4);
    expect(getWarningThreshold(3)).toBe(6);
    expect(getWarningThreshold(10)).toBe(20);
  });
});

describe('computeDiagnostics', () => {
  it('returns null when no players appear in any map', () => {
    expect(computeDiagnostics(emptyMaps, players)).toBeNull();
  });

  it('computes totals and fairness score from bench data', () => {
    const diagnostics = computeDiagnostics({
      ...emptyMaps,
      bench: { '1': 2, '2': 0, '3': 0 },
      win: { '1': 1 },
    }, players);

    expect(diagnostics?.totalPlayers).toBe(3);
    expect(diagnostics?.neverBenched).toBe(0);
    expect(diagnostics?.benchedMultiple).toBe(1);
    expect(diagnostics?.maxBenchCount).toBe(2);
    expect(diagnostics?.minBenchCount).toBe(0);
  });

  it('uses the stored roundsPlayed when present instead of the estimate', () => {
    const diagnostics = computeDiagnostics(
      { ...emptyMaps, bench: { '1': 1 }, roundsPlayed: 7 },
      players,
    );

    expect(diagnostics?.totalRounds).toBe(7);
  });

  it('flags a bench imbalance warning when the spread is too wide', () => {
    const diagnostics = computeDiagnostics({
      ...emptyMaps,
      bench: { '1': 10, '2': 0, '3': 0 },
      win: { '1': 1, '2': 1 },
    }, players);

    expect(diagnostics?.warnings.some(w => w.includes('Bench imbalance'))).toBe(true);
  });

  it('flags repeated teammate and opponent warnings above threshold', () => {
    const diagnostics = computeDiagnostics({
      ...emptyMaps,
      bench: { '1': 0, '2': 0, '3': 0 },
      teammate: { '1|2': 5 },
      opponent: { '1|3': 5 },
    }, players);

    expect(diagnostics?.warnings.some(w => w.includes('teamed up'))).toBe(true);
    expect(diagnostics?.warnings.some(w => w.includes('faced each other'))).toBe(true);
  });

  it('flags a singles-overplay warning when one player dominates singles', () => {
    const diagnostics = computeDiagnostics({
      ...emptyMaps,
      single: { '1': 6, '2': 0, '3': 0 },
    }, players);

    expect(diagnostics?.warnings.some(w => w.includes('played singles'))).toBe(true);
    expect(diagnostics?.playersWithMultipleSingles).toBe(1);
  });

  it('produces no warnings for a balanced session', () => {
    const diagnostics = computeDiagnostics({
      ...emptyMaps,
      bench: { '1': 1, '2': 1, '3': 1 },
      teammate: { '1|2': 1 },
      opponent: { '1|3': 1 },
      single: { '1': 1 },
    }, players);

    expect(diagnostics?.warnings).toEqual([]);
  });
});
