export class LevelTrackerConfig {
  /** ELO divisor — controls curve steepness (larger = flatter, more upsets). */
  static readonly ELO_DIVISOR = 400;

  /** K-factor returned when no score is available (same as deuce). */
  static readonly K_DEFAULT = 0.3;

  /** K-factor for the most dominant win (diff > 15, loser < 6). */
  static readonly K_MAX = 1.5;

  /**
   * K-factor bands, applied when the winner score is exactly 21.
   * Each entry maps a maximum score difference to a K-factor.
   * Evaluated in order; first match wins.
   */
  static readonly K_SCALE = [
    { maxDiff: 3,  k: 0.4 },
    { maxDiff: 6,  k: 0.8 },
    { maxDiff: 10, k: 1.0 },
    { maxDiff: 15, k: 1.2 },
  ] as const;

  /** Minimum balance factor (applied when team spread is maximal [0, 100]). */
  static readonly BALANCE_FACTOR_FLOOR = 0.5;

  /** Spread normalizer: sqrt(variance) / NORMALIZER, clamped to [0, 1]. */
  static readonly BALANCE_FACTOR_NORMALIZER = 50;
}
