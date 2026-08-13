import type { SetScore } from '../types';
import { DEFAULT_SET_SIZE } from '../types';

/** One score cell straight from an input: a number, a raw text value, or null/'' when unplayed. */
export type RawCell = number | string | null;
export type RawSet = { team1: RawCell; team2: RawCell };

/** Normalise a raw cell to a number, or null when blank/non-numeric — the one parse point for scores. */
function cellValue(cell: RawCell): number | null {
  if (cell === null || cell === '') return null;
  const n = typeof cell === 'number' ? cell : parseInt(cell, 10);
  return Number.isNaN(n) ? null : n;
}

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

/** Sets needed to win a best-of-N match. */
function setsToClinch(bestOf: number): number {
  return Math.ceil(Math.max(1, bestOf) / 2);
}

/**
 * Walk the sets in order and stop as soon as one side clinches the majority
 * (ceil(bestOf/2)): a best-of-3 ends 2–0 or 2–1, never 3–0. Returns the winner
 * and the sets actually needed to decide the match — any trailing sets are
 * impossible and dropped.
 */
function clinchInOrder(sets: SetScore[], bestOf: number): { winner: 1 | 2; sets: SetScore[] } | null {
  const need = setsToClinch(bestOf);
  let team1 = 0;
  let team2 = 0;
  for (let i = 0; i < sets.length; i++) {
    const s = sets[i];
    if (s.team1 > s.team2) team1++;
    else if (s.team2 > s.team1) team2++;
    if (team1 >= need) return { winner: 1, sets: sets.slice(0, i + 1) };
    if (team2 >= need) return { winner: 2, sets: sets.slice(0, i + 1) };
  }
  return null;
}

/**
 * A match's set(s) as one value object — the single home for winner resolution, standings
 * tallies and the Elo score. Every match is a series of sets: casual play is a best-of-1,
 * tournaments configure best-of 1/3/5, and all of them share this one type.
 */
export class MatchScore {
  private constructor(
    readonly sets: SetScore[],
    readonly winner: 1 | 2 | undefined,
  ) {}

  /** Wrap already-decided sets (a stored match or court) with their authoritative winner. */
  static of(sets: SetScore[], winner: 1 | 2 | undefined): MatchScore {
    return new MatchScore(sets, winner);
  }

  /** Single-set score for a click-only win: winner `setSize` (21), loser `setSize − 3` (18). */
  static defaultSingle(clicked: 1 | 2, setSize = DEFAULT_SET_SIZE): SetScore {
    const win = setSize;
    const lose = Math.max(0, setSize - 3);
    return clicked === 1 ? { team1: win, team2: lose } : { team1: lose, team2: win };
  }

  /**
   * The one resolution authority for every match, from raw per-set inputs (null = blank).
   * best-of-1: the clicked team wins and a blank set defaults to `setSize`–(setSize−3) (a real
   * score can still flip it). best-of-N: a winner is recorded only once one side clinches a
   * majority of sets (ceil(bestOf/2)); a lead short of that, or a tie, yields null. Sets played
   * after the clinch are impossible and dropped.
   */
  static resolve(rawSets: RawSet[], clicked: 1 | 2, bestOf: number, setSize = DEFAULT_SET_SIZE): MatchScore | null {
    const cells = rawSets.map(s => ({ team1: cellValue(s.team1), team2: cellValue(s.team2) }));
    if (Math.max(1, bestOf) === 1) {
      const raw = cells[0] ?? { team1: null, team2: null };
      const d = MatchScore.defaultSingle(clicked, setSize);
      const winnerRaw = clicked === 1 ? raw.team1 : raw.team2;
      const loserRaw = clicked === 1 ? raw.team2 : raw.team1;
      const winnerDefault = clicked === 1 ? d.team1 : d.team2;
      const loserDefault = clicked === 1 ? d.team2 : d.team1;
      const winScore = winnerRaw ?? winnerDefault;
      const loseScore = loserRaw ?? (winScore > setSize ? winScore - 2 : Math.min(loserDefault, Math.max(0, winScore - 1)));
      const set: SetScore = clicked === 1
        ? { team1: winScore, team2: loseScore }
        : { team1: loseScore, team2: winScore };
      return new MatchScore([set], sideWithMoreSets([set]) ?? clicked);
    }
    const sets = cells
      .filter(s => s.team1 !== null || s.team2 !== null)
      .map(s => ({ team1: s.team1 ?? 0, team2: s.team2 ?? 0 }))
      .filter(s => s.team1 !== s.team2);
    const clinched = clinchInOrder(sets, bestOf);
    return clinched ? new MatchScore(clinched.sets, clinched.winner) : null;
  }

  /**
   * The set index at which one side clinches the best-of-N majority — every later set is
   * impossible and should be locked. -1 when nothing has clinched yet or for a best-of-1.
   * Blank sets are skipped but keep their position, so the index lines up with the inputs.
   */
  static clinchSetIndex(rawSets: RawSet[], bestOf: number): number {
    if (Math.max(1, bestOf) === 1) return -1;
    const cells = rawSets.map(s => ({ team1: cellValue(s.team1) ?? 0, team2: cellValue(s.team2) ?? 0 }));
    const clinched = clinchInOrder(cells, bestOf);
    return clinched ? clinched.sets.length - 1 : -1;
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
