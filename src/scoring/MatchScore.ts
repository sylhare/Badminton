import type { SetScore } from '../types';

/** The Elo-facing view of a match result: who won, and the per-game score used to weight the rating change. */
export interface EloResult {
  readonly winner: 1 | 2 | undefined;
  /** Points per side normalised to a single ~21-point game, or undefined when no set was scored. */
  eloScore(): SetScore | undefined;
}

export type RawSet = { team1: number | null; team2: number | null };

/** Sets won by each side across a list of sets. */
function tally(sets: SetScore[]): SetScore {
  let team1 = 0;
  let team2 = 0;
  for (const s of sets) {
    if (s.team1 > s.team2) team1++;
    else if (s.team2 > s.team1) team2++;
  }
  return { team1, team2 };
}

/** The side that took more sets; undefined on a tie or when nothing was scored. */
function sideWithMoreSets(sets: SetScore[]): 1 | 2 | undefined {
  const { team1, team2 } = tally(sets);
  if (team1 > team2) return 1;
  if (team2 > team1) return 2;
  return undefined;
}

/** The side that has clinched a majority of sets (ceil(bestOf/2)), else undefined. */
function clinchWinner(sets: SetScore[], bestOf: number): 1 | 2 | undefined {
  const t = tally(sets);
  if (t.team1 === t.team2) return undefined;
  const winner = t.team1 > t.team2 ? 1 : 2;
  const won = winner === 1 ? t.team1 : t.team2;
  return won >= Math.ceil(bestOf / 2) ? winner : undefined;
}

/**
 * A match's set(s) as one value object — the single home for winner resolution, standings
 * tallies and the Elo score. Every match is a series of sets: casual play is a best-of-1,
 * tournaments configure best-of 1/3/5, and all of them share this one type.
 */
export class MatchScore implements EloResult {
  private constructor(
    readonly sets: SetScore[],
    readonly winner: 1 | 2 | undefined,
  ) {}

  /** Wrap already-decided sets (a stored match or court) with their authoritative winner. */
  static of(sets: SetScore[], winner: 1 | 2 | undefined): MatchScore {
    return new MatchScore(sets, winner);
  }

  /** Single-set score for a click-only win: winner 21, loser 18. */
  static defaultSingle(clicked: 1 | 2): SetScore {
    return clicked === 1 ? { team1: 21, team2: 18 } : { team1: 18, team2: 21 };
  }

  /**
   * The one resolution authority for every match, from raw per-set inputs (null = blank).
   * best-of-1: the clicked team wins and a blank set defaults to 21–18 (a real score can still
   * flip it). best-of-N: a winner is recorded only once one side clinches a majority of sets
   * (ceil(bestOf/2)); a lead short of that, or a tie, yields null.
   */
  static resolve(rawSets: RawSet[], clicked: 1 | 2, bestOf: number): MatchScore | null {
    if (Math.max(1, bestOf) === 1) {
      const raw = rawSets[0];
      const d = MatchScore.defaultSingle(clicked);
      const set: SetScore = { team1: raw?.team1 ?? d.team1, team2: raw?.team2 ?? d.team2 };
      return new MatchScore([set], sideWithMoreSets([set]) ?? clicked);
    }
    const sets = rawSets
      .filter(s => s.team1 !== null || s.team2 !== null)
      .map(s => ({ team1: s.team1 ?? 0, team2: s.team2 ?? 0 }));
    const winner = clinchWinner(sets, bestOf);
    return winner ? new MatchScore(sets, winner) : null;
  }

  isDecided(): boolean {
    return this.winner !== undefined;
  }

  /** Sets won by each side. */
  setsWon(): SetScore {
    return tally(this.sets);
  }

  /** Total points scored by each side across every set. */
  points(): SetScore {
    return this.sets.reduce(
      (acc, s) => ({ team1: acc.team1 + s.team1, team2: acc.team2 + s.team2 }),
      { team1: 0, team2: 0 },
    );
  }

  /** Render the sets as "21 – 14, 18 – 21", or null when nothing was scored. */
  formatted(): string | null {
    return this.sets.length ? this.sets.map(s => `${s.team1} – ${s.team2}`).join(', ') : null;
  }

  /**
   * The score fed to the Elo K-factor: the average of the sets, not their sum, so a best-of-N
   * winner still reads as a ~21-point game and the margin-of-victory scale applies.
   */
  eloScore(): SetScore | undefined {
    if (!this.sets.length) return undefined;
    const total = this.points();
    const n = this.sets.length;
    return { team1: Math.round(total.team1 / n), team2: Math.round(total.team2 / n) };
  }
}
