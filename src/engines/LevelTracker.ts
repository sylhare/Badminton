import type { Player, ScoredGame } from '../types';
import type { Tournament } from '../tournament/Tournament';
import { BracketKind } from '../tournament/types';
import type { TournamentMatch } from '../tournament/types';

import { LevelTrackerConfig } from './levelTrackerConfig';

export class LevelTracker {
  /** K-factor (max rating change per game) from the score, normalised to the reference length and scaled by team balance. */
  getKFactor(
    score?: { team1: number; team2: number },
    winner?: 1 | 2,
    teamPlayers?: Player[],
  ): number {
    if (!score || !winner) return LevelTrackerConfig.K_DEFAULT * this.teamBalanceFactor(teamPlayers);

    const winnerScore = winner === 1 ? score.team1 : score.team2;
    const loserScore = winner === 1 ? score.team2 : score.team1;

    let rawK = LevelTrackerConfig.K_MAX;
    if (winnerScore > LevelTrackerConfig.REFERENCE_LENGTH || winnerScore <= 0) {
      rawK = LevelTrackerConfig.K_DEFAULT;
    } else {
      const diff = (winnerScore - loserScore) * (LevelTrackerConfig.REFERENCE_LENGTH / winnerScore);
      for (const band of LevelTrackerConfig.K_SCALE) {
        if (diff <= band.maxDiff) { rawK = band.k; break; }
      }
    }

    return rawK * this.teamBalanceFactor(teamPlayers);
  }

  private teamBalanceFactor(players?: Player[]): number {
    if (!players || players.length <= 1) return 1;
    const avg = players.reduce((s, p) => s + (p.level ?? 50), 0) / players.length;
    const variance = players.reduce((s, p) => s + Math.pow((p.level ?? 50) - avg, 2), 0) / players.length;
    return 1 - LevelTrackerConfig.BALANCE_FACTOR_FLOOR * Math.min(1, Math.sqrt(variance) / LevelTrackerConfig.BALANCE_FACTOR_NORMALIZER);
  }

  /**
   * Compute the average level for a team, defaulting unknown levels to 50.
   */
  getTeamAvgLevel(players: Player[]): number {
    if (players.length === 0) return 50;
    const total = players.reduce((sum, p) => sum + (p.level ?? 50), 0);
    return total / players.length;
  }

  /**
   * Apply Elo-style level updates to all players based on court results.
   * Only courts with both a winner and teams assigned are processed.
   *
   * Uses the Elo formula with a divisor of {@link LevelTrackerConfig.ELO_DIVISOR} to
   * compute expected win probabilities. A larger divisor produces a flatter probability
   * curve, so mismatched teams cause smaller swings and upsets are less extreme.
   *
   * Average score tracking is updated when a score is recorded.
   *
   * Each team's K-factor is adjusted by a per-team balance factor [0.5, 1.0] based on
   * within-team level spread — the more unbalanced the team, the smaller the rating change.
   *
   * Each game's rating change is further scaled by its `importance` (default 1), letting
   * callers weight some games more heavily (e.g. a tournament final) without changing the formula.
   */
  getLevelTrend(playerId: string, levelHistory: Map<string, number[]>): 'up' | 'down' | null {
    const history = levelHistory.get(playerId);
    if (!history || history.length < 2) return null;
    const prev = history[history.length - 2];
    const curr = history[history.length - 1];
    if (curr > prev) return 'up';
    if (curr < prev) return 'down';
    return null;
  }

  updatePlayersLevels(games: ScoredGame[], players: Player[]): Player[] {
    const updatedPlayers = new Map<string, Player>(players.map(p => [p.id, { ...p }]));

    for (const { court, importance: gameImportance } of games) {
      if (!court.winner || !court.teams) continue;

      const importance = gameImportance ?? LevelTrackerConfig.ELO_DEFAULT_IMPORTANCE;
      const { team1, team2 } = court.teams;

      const freshTeam1 = team1.map(p => updatedPlayers.get(p.id) ?? p);
      const freshTeam2 = team2.map(p => updatedPlayers.get(p.id) ?? p);

      const team1Avg = this.getTeamAvgLevel(freshTeam1);
      const team2Avg = this.getTeamAvgLevel(freshTeam2);

      const team1Expected = 1 / (1 + Math.pow(10, (team2Avg - team1Avg) / LevelTrackerConfig.ELO_DIVISOR));
      const team2Expected = 1 - team1Expected;

      const team1Actual = court.winner === 1 ? 1 : 0;
      const team2Actual = court.winner === 2 ? 1 : 0;

      const applyLevelDelta = (teamPlayers: Player[], actual: number, expected: number) => {
        const k = this.getKFactor(court.score, court.winner, teamPlayers);
        const delta = k * importance * (actual - expected);
        for (const p of teamPlayers) {
          const current = updatedPlayers.get(p.id);
          if (!current) continue;
          const raw = (current.level ?? 50) + delta;
          const newLevel = Math.round(Math.min(100, Math.max(0, raw)) * 10) / 10;
          updatedPlayers.set(p.id, { ...current, level: newLevel });
        }
      };

      applyLevelDelta(freshTeam1, team1Actual, team1Expected);
      applyLevelDelta(freshTeam2, team2Actual, team2Expected);

      if (court.score) {
        const updateAvgScore = (teamPlayers: Player[], teamScore: number, isWinner: boolean) => {
          const cap = isWinner ? 21 : 20;
          const cappedScore = Math.min(teamScore, cap);
          for (const p of teamPlayers) {
            const current = updatedPlayers.get(p.id);
            if (!current) continue;
            const prevGames = current.scoredGames ?? 0;
            const scoredGames = prevGames + 1;
            const averageScore =
              Math.round((((current.averageScore ?? 0) * prevGames + cappedScore) / scoredGames) * 10) / 10;
            updatedPlayers.set(p.id, { ...current, scoredGames, averageScore });
          }
        };

        updateAvgScore(team1, court.score.team1, court.winner === 1);
        updateAvgScore(team2, court.score.team2, court.winner === 2);
      }
    }

    return players.map(p => updatedPlayers.get(p.id) ?? p);
  }
}

export const levelTracker = new LevelTracker();

/**
 * How much tournament matches swing player levels, relative to a casual game.
 * Named here so there are no magic numbers in the resolver.
 */
export const DEFAULT_TOURNAMENT_WEIGHTS = {
  /** Baseline importance for a tournament match (1 = same as a casual game). */
  base: 1.0,
  /** Multiplier for the winners-bracket final (last round). */
  finalMultiplier: 1.5,
  /** Multiplier for the winners-bracket semi-final (second-to-last round). */
  semifinalMultiplier: 1.25,
} as const;

/**
 * Resolves a match's Elo importance. The final/semi-final boost only applies to
 * the winners bracket, so round-robin matches (no bracket) and consolation/
 * third-place matches keep the base weight.
 */
export function resolveMatchImportance(match: TournamentMatch, totalRounds: number): number {
  if (match.bracket === BracketKind.Winners) {
    if (match.round === totalRounds) return DEFAULT_TOURNAMENT_WEIGHTS.base * DEFAULT_TOURNAMENT_WEIGHTS.finalMultiplier;
    if (match.round === totalRounds - 1) return DEFAULT_TOURNAMENT_WEIGHTS.base * DEFAULT_TOURNAMENT_WEIGHTS.semifinalMultiplier;
  }
  return DEFAULT_TOURNAMENT_WEIGHTS.base;
}

export interface TournamentLevelInputs {
  baseline: Player[];
  games: ScoredGame[];
}

/**
 * Adapts a tournament's decided matches into the start-of-play baseline and the
 * ordered {@link ScoredGame}s the level tracker replays — each carrying the Elo
 * importance derived from {@link resolveMatchImportance}. A tournament is just a
 * series of games, so it feeds the same {@link LevelTracker.updatePlayersLevels}.
 */
export function tournamentLevelInputs(tournament: Tournament): TournamentLevelInputs {
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
      importance: resolveMatchImportance(match, totalRounds),
    }));
  return { baseline, games };
}
