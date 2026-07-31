import type { Player, ScoredGame } from '../types';

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
    const updated = new Map<string, Player>(players.map(p => [p.id, { ...p }]));
    const patch = (id: string, fields: Partial<Player>): void => {
      const current = updated.get(id);
      if (current) updated.set(id, { ...current, ...fields });
    };

    for (const { court, importance } of games) {
      if (!court.winner || !court.teams) continue;

      const weight = importance ?? LevelTrackerConfig.ELO_DEFAULT_IMPORTANCE;
      const sides = [court.teams.team1, court.teams.team2].map((team, i) => ({
        team: team.map(p => updated.get(p.id) ?? p),
        won: court.winner === i + 1,
        rawScore: i === 0 ? court.score?.team1 : court.score?.team2,
      }));
      const avg = sides.map(s => this.getTeamAvgLevel(s.team));

      sides.forEach((side, i) => {
        const expected = 1 / (1 + Math.pow(10, (avg[1 - i] - avg[i]) / LevelTrackerConfig.ELO_DIVISOR));
        const delta = this.getKFactor(court.score, court.winner, side.team) * weight * ((side.won ? 1 : 0) - expected);

        for (const p of side.team) {
          const current = updated.get(p.id);
          if (!current) continue;
          const level = Math.round(Math.min(100, Math.max(0, (current.level ?? 50) + delta)) * 10) / 10;
          patch(p.id, { level });

          if (side.rawScore !== undefined) {
            const cappedScore = Math.min(side.rawScore, side.won ? 21 : 20);
            const prevGames = current.scoredGames ?? 0;
            const scoredGames = prevGames + 1;
            const averageScore =
              Math.round((((current.averageScore ?? 0) * prevGames + cappedScore) / scoredGames) * 10) / 10;
            patch(p.id, { scoredGames, averageScore });
          }
        }
      });
    }

    return players.map(p => updated.get(p.id) ?? p);
  }
}

export const levelTracker = new LevelTracker();
