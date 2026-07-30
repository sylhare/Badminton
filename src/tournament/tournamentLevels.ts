import type { Player, ScoredGame } from '../types';

import type { Tournament } from './Tournament';
import { BracketKind } from './types';
import type { TournamentMatch } from './types';

/**
 * Tunable weighting for how much tournament matches swing player levels. All
 * values live here (no magic numbers in the resolver) so they can be adjusted
 * in one place — or overridden per call via {@link tournamentLevelInputs}.
 */
export interface TournamentWeightConfig {
  /** Baseline importance for a tournament match (1 = same as a casual game). */
  base: number;
  /** Multiplier for the winners-bracket final (last round). */
  finalMultiplier: number;
  /** Multiplier for the winners-bracket semi-final (second-to-last round). */
  semifinalMultiplier: number;
  /** Optional per-bracket multipliers; unset brackets use 1. */
  bracketMultipliers?: Partial<Record<BracketKind, number>>;
}

export const DEFAULT_TOURNAMENT_WEIGHTS: TournamentWeightConfig = {
  base: 1.0,
  finalMultiplier: 1.5,
  semifinalMultiplier: 1.25,
};

/**
 * Resolves a match's Elo importance from the weight config. The final/semi-final
 * boost only applies to the winners bracket, so round-robin matches (no bracket)
 * and consolation/third-place matches keep the base weight.
 */
export function resolveMatchImportance(
  match: TournamentMatch,
  totalRounds: number,
  weights: TournamentWeightConfig = DEFAULT_TOURNAMENT_WEIGHTS,
): number {
  let importance = weights.base;

  if (match.bracket === BracketKind.Winners) {
    if (match.round === totalRounds) importance *= weights.finalMultiplier;
    else if (match.round === totalRounds - 1) importance *= weights.semifinalMultiplier;
  }

  const bracketMultiplier = match.bracket ? weights.bracketMultipliers?.[match.bracket] : undefined;
  if (bracketMultiplier !== undefined) importance *= bracketMultiplier;

  return importance;
}

export interface TournamentLevelInputs {
  baseline: Player[];
  games: ScoredGame[];
}

/**
 * Adapts a tournament's decided matches into the start-of-play baseline and the
 * ordered {@link ScoredGame}s the level tracker replays — each carrying the Elo
 * importance derived from {@link resolveMatchImportance}.
 */
export function tournamentLevelInputs(
  tournament: Tournament,
  weights: TournamentWeightConfig = DEFAULT_TOURNAMENT_WEIGHTS,
): TournamentLevelInputs {
  const baseline = tournament.teams().flatMap(team => team.players);
  const totalRounds = tournament.totalRounds();
  const games: ScoredGame[] = tournament.matches()
    .filter(match => match.winner)
    .sort((a, b) => a.round - b.round || a.courtNumber - b.courtNumber)
    .map(match => ({
      court: {
        courtNumber: match.courtNumber,
        players: [...match.team1.players, ...match.team2.players],
        teams: { team1: match.team1.players, team2: match.team2.players },
        winner: match.winner,
        score: match.score,
      },
      options: { importance: resolveMatchImportance(match, totalRounds, weights) },
    }));
  return { baseline, games };
}
