import type { Court, Player } from '../types';

import { LevelTrackerConfig } from './levelTrackerConfig';

export class LevelTracker {
  /**
   * Determine the K-factor (maximum rating change per game) based on the score.
   *
   * Returns {@link LevelTrackerConfig.K_DEFAULT} when no score is available or the
   * winner score is not exactly 21 (deuce). Otherwise the raw K is looked up from
   * {@link LevelTrackerConfig.K_SCALE} (matched by score difference) or falls back
   * to {@link LevelTrackerConfig.K_MAX} for the most dominant wins.
   *
   * When teamPlayers is provided, the raw K is scaled by a balance factor
   * [{@link LevelTrackerConfig.BALANCE_FACTOR_FLOOR}, 1.0] based on within-team
   * level spread — the more unbalanced the team, the less informative the result.
   */
  getKFactor(
    score?: { team1: number; team2: number },
    winner?: 1 | 2,
    teamPlayers?: Player[],
  ): number {
    if (!score || !winner) return LevelTrackerConfig.K_DEFAULT * this.teamBalanceFactor(teamPlayers);

    const winnerScore = winner === 1 ? score.team1 : score.team2;
    const loserScore  = winner === 1 ? score.team2 : score.team1;

    let rawK = LevelTrackerConfig.K_MAX;
    if (winnerScore !== 21) {
      rawK = LevelTrackerConfig.K_DEFAULT;
    } else {
      const diff = 21 - loserScore;
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

  updatePlayersLevels(courts: Court[], players: Player[]): Player[] {
    const updatedPlayers = new Map<string, Player>(players.map(p => [p.id, { ...p }]));

    for (const court of courts) {
      if (!court.winner || !court.teams) continue;

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
        const delta = k * (actual - expected);
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
