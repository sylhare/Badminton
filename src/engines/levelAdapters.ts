import type { Player, ScoredGame } from '../types';
import type { Tournament } from '../tournament/Tournament';
import { BracketKind } from '../tournament/types';
import type { TournamentMatch } from '../tournament/types';

import { LevelTrackerConfig } from './levelTrackerConfig';

/** Elo importance of a tournament match, relative to a casual game (1). */
export const DEFAULT_TOURNAMENT_WEIGHTS = {
  /** Winners-bracket final (last round) swings levels 1.5x a casual game. */
  finalMultiplier: 1.5,
  /** Winners-bracket semi-final (second-to-last round) swings levels 1.25x a casual game. */
  semifinalMultiplier: 1.25,
} as const;

/** Elo importance of a match; only the winners-bracket final and semi-final are boosted. */
export function resolveMatchImportance(match: TournamentMatch, totalRounds: number): number {
  if (match.bracket === BracketKind.Winners) {
    if (match.round === totalRounds) return DEFAULT_TOURNAMENT_WEIGHTS.finalMultiplier;
    if (match.round === totalRounds - 1) return DEFAULT_TOURNAMENT_WEIGHTS.semifinalMultiplier;
  }
  return LevelTrackerConfig.ELO_DEFAULT_IMPORTANCE;
}

/** A tournament match is a court result carrying its Elo importance. */
export function matchToScoredGame(match: TournamentMatch, totalRounds: number): ScoredGame {
  return {
    court: {
      courtNumber: match.courtNumber,
      players: [...match.team1.players, ...match.team2.players],
      teams: { team1: match.team1.players, team2: match.team2.players },
      winner: match.winner,
      score: match.score,
    },
    importance: resolveMatchImportance(match, totalRounds),
  };
}

export interface TournamentScoredGames {
  baseline: Player[];
  games: ScoredGame[];
}

/** Start-of-play baseline plus the decided games to replay through {@link LevelTracker.updatePlayersLevels}. */
export function tournamentToScoredGames(tournament: Tournament): TournamentScoredGames {
  const baseline = tournament.teams().flatMap(team => team.players);
  const totalRounds = tournament.totalRounds();
  const games: ScoredGame[] = tournament.matches()
    .filter(match => match.winner)
    .sort((a, b) => a.round - b.round || a.courtNumber - b.courtNumber)
    .map(match => matchToScoredGame(match, totalRounds));
  return { baseline, games };
}
