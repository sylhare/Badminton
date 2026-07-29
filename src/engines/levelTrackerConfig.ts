export class LevelTrackerConfig {
  /** ELO divisor — controls curve steepness (larger = flatter, more upsets). */
  static readonly ELO_DIVISOR = 400;

  /** K-factor returned when no score is available (same as deuce). */
  static readonly K_DEFAULT = 0.6;

  /** K-factor for the most dominant win (diff > 15, loser < 6). */
  static readonly K_MAX = 3.0;

  /** Match length the {@link K_SCALE} bands are calibrated to; winner scores are normalised to it. */
  static readonly REFERENCE_LENGTH = 21;

  /** K-factor bands over the winner-score-normalised margin of victory; first matching maxDiff wins. */
  static readonly K_SCALE = [
    { maxDiff: 3, k: 0.8 },
    { maxDiff: 6, k: 1.6 },
    { maxDiff: 10, k: 2.0 },
    { maxDiff: 15, k: 2.4 },
  ] as const;

  /** Minimum balance factor (applied when team spread is maximal [0, 100]). */
  static readonly BALANCE_FACTOR_FLOOR = 0.5;

  /** Spread normalizer: sqrt(variance) / NORMALIZER, clamped to [0, 1]. */
  static readonly BALANCE_FACTOR_NORMALIZER = 50;
}
