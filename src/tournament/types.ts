import type { Player } from '../types';

export type TournamentFormat = 'singles' | 'doubles';

export enum BracketKind {
  Winners = 'winners',
  Consolation = 'consolation',
  ThirdPlace = 'third-place',
}
export type TournamentType = 'round-robin' | 'elimination' | 'group-knockout';
export type TournamentPhase = 'setup' | 'active' | 'completed';

export interface TournamentTeam {
  id: string;
  players: Player[];
}

/** Points scored by each side within a single set. */
export interface SetScore {
  team1: number;
  team2: number;
}

export interface TournamentMatch {
  id: string;
  round: number;
  courtNumber: number;
  team1: TournamentTeam;
  team2: TournamentTeam;
  winner?: 1 | 2;
  /** One entry per set played; empty while the match is undecided or was won without a score. */
  sets: SetScore[];
  bracket?: BracketKind;
  /** Group index (0-based) for a group-stage match; absent for knockout/bracket matches. */
  group?: number;
}

export interface TournamentStandingRow {
  team: TournamentTeam;
  played: number;
  won: number;
  lost: number;
  points: number;
  /** Set-win differential (sets won minus sets lost) across all decided matches. */
  setDiff: number;
  /** Total-point differential across every set of every decided match. */
  scoreDiff: number;
}

export interface TournamentState {
  format: TournamentFormat;
  type: TournamentType;
  numberOfCourts: number;
  teams: TournamentTeam[];
  matches: TournamentMatch[];
  bracketSize?: number;
  /** Total sets in a match (best-of-N); the winner is the side that takes a majority. Defaults to 1. */
  bestOf: number;
  /** group-knockout: target teams per group in the round-robin phase. */
  groupSize?: number;
  /** group-knockout: how many teams advance from each group to the knockout bracket. */
  qualifiersPerGroup?: number;
}

export function formatTeamName(team: TournamentTeam): string {
  return team.players.map(p => p.name).join(' & ');
}

/** Render a match's sets as "21 – 14, 18 – 21", or null when no set was recorded. */
export function formatSets(sets: SetScore[]): string | null {
  return sets.length ? sets.map(s => `${s.team1} – ${s.team2}`).join(', ') : null;
}

/** Sets won by each side across a list of sets. */
export function tallySets(sets: SetScore[]): SetScore {
  let team1 = 0;
  let team2 = 0;
  for (const set of sets) {
    if (set.team1 > set.team2) team1++;
    else if (set.team2 > set.team1) team2++;
  }
  return { team1, team2 };
}

/** Side that took more sets; undefined on a tie or when no sets were recorded. */
export function winningSide(sets: SetScore[]): 1 | 2 | undefined {
  const { team1, team2 } = tallySets(sets);
  if (team1 > team2) return 1;
  if (team2 > team1) return 2;
  return undefined;
}

type RawSet = { team1: number | null; team2: number | null };

/** Default single-set score for a click-only win: winner 21, loser 18. */
export function defaultSinglesScore(clicked: 1 | 2): SetScore {
  return clicked === 1 ? { team1: 21, team2: 18 } : { team1: 18, team2: 21 };
}

/**
 * Resolve a match from raw per-set inputs (null = blank), returning the winner and
 * played sets, or null when no winner can be recorded. best-of-1: the clicked team
 * wins and a blank set defaults to 21–18 (a real score can still flip the winner).
 * best-of-N: a winner is recorded only once one side clinches a majority of sets
 * (ceil(bestOf/2)); a lead short of that, or a tie, yields null. This is the single
 * place that decides winner-from-click vs winner-from-score.
 */
export function resolveMatchResult(
  rawSets: RawSet[],
  clicked: 1 | 2,
  bestOf: number,
): { winner: 1 | 2; sets: SetScore[] } | null {
  if (Math.max(1, bestOf) === 1) {
    const raw = rawSets[0];
    const defaults = defaultSinglesScore(clicked);
    const set: SetScore = { team1: raw?.team1 ?? defaults.team1, team2: raw?.team2 ?? defaults.team2 };
    return { winner: winningSide([set]) ?? clicked, sets: [set] };
  }
  const sets = rawSets
    .filter(s => s.team1 !== null || s.team2 !== null)
    .map(s => ({ team1: s.team1 ?? 0, team2: s.team2 ?? 0 }));
  const winner = winningSide(sets);
  if (!winner) return null;
  const tally = tallySets(sets);
  const setsToClinch = Math.ceil(bestOf / 2);
  const winnerSets = winner === 1 ? tally.team1 : tally.team2;
  return winnerSets >= setsToClinch ? { winner, sets } : null;
}

/** Sets won by each side of a match. */
export function setsWonBy(match: TournamentMatch): SetScore {
  return tallySets(match.sets);
}

/** Total points scored by each side across every set of a match. */
export function totalPoints(match: TournamentMatch): SetScore {
  return match.sets.reduce(
    (acc, set) => ({ team1: acc.team1 + set.team1, team2: acc.team2 + set.team2 }),
    { team1: 0, team2: 0 },
  );
}

export const DEFAULT_TOURNAMENT_STATE: TournamentState = {
  format: 'doubles',
  type: 'round-robin',
  numberOfCourts: 4,
  teams: [],
  matches: [],
  bestOf: 1,
};
