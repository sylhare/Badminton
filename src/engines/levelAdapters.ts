import type { Player, ScoredGame } from '../types';
import type { Tournament } from '../tournament/Tournament';
import { BracketKind } from '../tournament/types';
import type { TournamentMatch } from '../tournament/types';

import { LevelTrackerConfig } from './levelTrackerConfig';

/** Elo importance of a match; only the winners-bracket final and semi-final are boosted. */
export function resolveMatchImportance(match: TournamentMatch, totalRounds: number): number {
  if (match.bracket === BracketKind.Winners) {
    if (match.round === totalRounds) return LevelTrackerConfig.WB_FINAL_IMPORTANCE;
    if (match.round === totalRounds - 1) return LevelTrackerConfig.WB_SEMIFINAL_IMPORTANCE;
  }
  return LevelTrackerConfig.ELO_DEFAULT_IMPORTANCE;
}

/** A tournament match is a court result carrying its Elo importance. */
function matchToScoredGame(match: TournamentMatch, totalRounds: number): ScoredGame {
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

/** Start-of-play baseline plus the decided games to replay through {@link LevelTracker.updatePlayersLevels}. */
export function tournamentToScoredGames(tournament: Tournament): { baseline: Player[]; games: ScoredGame[] } {
  const baseline = tournament.teams().flatMap(team => team.players);
  const totalRounds = tournament.totalRounds();
  const games: ScoredGame[] = tournament.matches()
    .filter(match => match.winner)
    .sort((a, b) => a.round - b.round || a.courtNumber - b.courtNumber)
    .map(match => matchToScoredGame(match, totalRounds));
  return { baseline, games };
}
