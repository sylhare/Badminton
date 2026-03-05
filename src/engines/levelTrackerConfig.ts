export class LevelTrackerConfig {
  /** ELO divisor — controls curve steepness (larger = flatter, more upsets). */
  static readonly ELO_DIVISOR = 400;

  /** K-factor returned when no score is available (same as deuce). */
  static readonly K_DEFAULT = 3;

  /** K-factor for the most dominant win (diff > 15, loser < 6). */
  static readonly K_MAX = 15;

  /**
   * K-factor bands, applied when the winner score is exactly 21.
   * Each entry maps a maximum score difference to a K-factor.
   * Evaluated in order; first match wins.
   */
  static readonly K_SCALE = [
    { maxDiff: 3,  k: 4  },   // loser 18–20
    { maxDiff: 6,  k: 8  },   // loser 15–17
    { maxDiff: 10, k: 10 },   // loser 11–14
    { maxDiff: 15, k: 12 },   // loser 6–10
  ] as const;

  /** Minimum balance factor (applied when team spread is maximal [0, 100]). */
  static readonly BALANCE_FACTOR_FLOOR = 0.5;

  /** Spread normalizer: sqrt(variance) / NORMALIZER, clamped to [0, 1]. */
  static readonly BALANCE_FACTOR_NORMALIZER = 50;
}
