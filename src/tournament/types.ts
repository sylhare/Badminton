export type TournamentFormat = 'singles' | 'doubles';
export type TournamentType = 'round-robin' | 'elimination';
export type TournamentPhase = 'setup' | 'active' | 'completed';

/** Height of a single match card in pixels. */
export const MATCH_HEIGHT = 64;

/** Vertical gap between adjacent match cards in pixels. */
export const MATCH_GAP = 12;

/** Slot height: one unit of the bracket grid (MATCH_HEIGHT + MATCH_GAP). */
export const SLOT_HEIGHT = MATCH_HEIGHT + MATCH_GAP;

/** Width of a match card column in pixels. */
export const COLUMN_WIDTH = 176;

/** Width of the SVG connector strip between columns in pixels. */
export const CONNECTOR_WIDTH = 36;

/**
 * Returns the top position (px) of a match card within the Winners Bracket.
 *
 * Each subsequent round doubles the slot size, centering cards in a binary tree.
 *
 * @param roundIdx - Zero-based round index.
 * @param matchIdx - Zero-based match index within the round.
 */
export function winnersTop(roundIdx: number, matchIdx: number): number {
  const slots = 1 << roundIdx;
  return matchIdx * slots * SLOT_HEIGHT + ((slots - 1) * SLOT_HEIGHT) / 2;
}

/** Named sentinel: real team is coming, not yet known. */
export const SEED_TBD = Symbol('SEED_TBD');

/** Named sentinel: structurally absent slot (bye padding or empty). */
export const SEED_ABSENT = Symbol('SEED_ABSENT');

export type SeedSlot = string | typeof SEED_TBD | typeof SEED_ABSENT;

/**
 * Strategy object carrying bracket identity. Pass to `bracketNodes`
 * so callers never need to branch on bracket type themselves.
 */
export type BracketConfig = {
  side: 'winners' | 'consolation';
  setup: EliminationSetup;
};

/**
 * A single node in the bracket tree visualization.
 *
 * - `match`: a real match with two known teams.
 * - `bye-advance`: one team advances automatically (no opponent).
 * - `tbd`: teams not yet determined but will be (pending match results).
 * - `empty`: structurally absent slot (e.g. null-null seeding pair) — never produces an advancer.
 */
export interface BracketNode {
  type: 'match' | 'bye-advance' | 'tbd' | 'empty';
  match?: TournamentMatch;
  team1: TournamentTeam | null;
  team2: TournamentTeam | null;
}

/**
 * Which bracket a match belongs to in a consolation-bracket elimination tournament.
 *
 * - `wb` — Winners Bracket: teams that have not yet lost. A loss here drops
 *   the team into the consolation bracket instead of eliminating them.
 *   The WB Final winner is the tournament champion (1st place), and the WB
 *   Final loser takes 2nd place without playing consolation.
 * - `lb` — Consolation Bracket: teams that have lost exactly once. A second
 *   loss here eliminates the team. The consolation final winner takes 3rd place.
 *
 * Absent or `undefined` is treated as `'wb'` for backward compatibility.
 */
export type MatchBracket = 'wb' | 'lb';

export interface TournamentTeam {
  id: string;
  playerIds: string[];
}

export interface TournamentMatch {
  id: string;
  round: number;
  /** Which bracket this match belongs to. Absent/undefined defaults to `'wb'`. */
  bracket?: MatchBracket;
  courtNumber: number;
  team1: TournamentTeam;
  team2: TournamentTeam;
  winner?: 1 | 2;
  score?: { team1: number; team2: number };
}

export interface TournamentStandingRow {
  team: TournamentTeam;
  played: number;
  won: number;
  lost: number;
  points: number;
  scoreDiff: number;
}

export interface EliminationSetup {
  size: number;
  seeding: (string | null)[];
}

export interface TournamentState {
  phase: TournamentPhase;
  format: TournamentFormat;
  type: TournamentType;
  numberOfCourts: number;
  teams: TournamentTeam[];
  matches: TournamentMatch[];
  seBracket?: EliminationSetup;
}

export const DEFAULT_TOURNAMENT_STATE: TournamentState = {
  phase: 'setup',
  format: 'doubles',
  type: 'round-robin',
  numberOfCourts: 4,
  teams: [],
  matches: [],
};

