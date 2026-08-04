import type { Player, ScoredGame } from '../types';
import type { Tournament } from '../tournament/Tournament';
import { BracketKind, totalPoints } from '../tournament/types';
import type { SetScore, TournamentMatch } from '../tournament/types';

import { LevelTrackerConfig } from './levelTrackerConfig';

/**
 * Elo importance of a match; only the winners-bracket final and semi-final are
 * boosted. `finalRound` is the winners bracket's own last round — for a
 * group-knockout it is the knockout depth, not the group+knockout total.
 */
export function resolveMatchImportance(match: TournamentMatch, finalRound: number): number {
  if (match.bracket === BracketKind.Winners) {
    if (match.round === finalRound) return LevelTrackerConfig.WB_FINAL_IMPORTANCE;
    if (match.round === finalRound - 1) return LevelTrackerConfig.WB_SEMIFINAL_IMPORTANCE;
  }
  return LevelTrackerConfig.ELO_DEFAULT_IMPORTANCE;
}

/** Replay order within a round: winners bracket, then consolation, then third-place. */
const BRACKET_REPLAY_RANK: Record<BracketKind, number> = {
  [BracketKind.Winners]: 0,
  [BracketKind.Consolation]: 1,
  [BracketKind.ThirdPlace]: 2,
};

function bracketRank(match: TournamentMatch): number {
  return match.bracket === undefined ? 0 : BRACKET_REPLAY_RANK[match.bracket];
}

/** Group-stage matches (phase 0) replay before knockout/bracket matches (phase 1). */
function phaseRank(match: TournamentMatch): number {
  return match.bracket === undefined ? 0 : 1;
}

/**
 * The score fed to the Elo K-factor: the average of the sets, not their sum, so
 * a best-of-N winner still reads as a ~21-point game and the margin-of-victory
 * scale applies (a summed total would exceed the reference length and flatten K).
 */
function averageSetScore(match: TournamentMatch): SetScore | undefined {
  if (!match.sets.length) return undefined;
  const total = totalPoints(match);
  const n = match.sets.length;
  return { team1: Math.round(total.team1 / n), team2: Math.round(total.team2 / n) };
}

/** The winners bracket's final round, used to locate the final/semi for the importance boost. */
function winnersFinalRound(matches: TournamentMatch[], fallback: number): number {
  const rounds = matches.filter(m => m.bracket === BracketKind.Winners).map(m => m.round);
  return rounds.length ? Math.max(...rounds) : fallback;
}

/** A tournament match is a court result carrying its Elo importance. */
function matchToScoredGame(match: TournamentMatch, finalRound: number): ScoredGame {
  return {
    court: {
      courtNumber: match.courtNumber,
      players: [...match.team1.players, ...match.team2.players],
      teams: { team1: match.team1.players, team2: match.team2.players },
      winner: match.winner,
      score: averageSetScore(match),
    },
    importance: resolveMatchImportance(match, finalRound),
  };
}

/** Start-of-play baseline plus the decided games to replay through {@link LevelTracker.updatePlayersLevels}. */
export function tournamentToScoredGames(tournament: Tournament): { baseline: Player[]; games: ScoredGame[] } {
  const baseline = tournament.teams().flatMap(team => team.players);
  const allMatches = tournament.matches();
  const finalRound = winnersFinalRound(allMatches, tournament.totalRounds());
  const games: ScoredGame[] = allMatches
    .filter(match => match.winner)
    .sort((a, b) =>
      phaseRank(a) - phaseRank(b) ||
      a.round - b.round ||
      bracketRank(a) - bracketRank(b) ||
      a.courtNumber - b.courtNumber)
    .map(match => matchToScoredGame(match, finalRound));
  return { baseline, games };
}
