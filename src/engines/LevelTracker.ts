import type { Court, Player } from '../types';

export class LevelTracker {
  /**
   * Determine the K-factor (maximum rating change per game) based on the score.
   * A higher K means a more dominant result causes a larger level adjustment.
   *
   * K-factor scale (winner score must be exactly 21):
   * - Deuce / winner ≠ 21 → K = 3   (closest possible win)
   * - Loser 18–20         → K = 4
   * - Loser 15–17         → K = 8
   * - Loser 11–14         → K = 10
   * - Loser 6–10          → K = 12
   * - Loser < 6           → K = 15  (most dominant win)
   *
   * Returns K = 3 when no score is available (same as deuce).
   *
   * When teamPlayers is provided, the raw K is further scaled by a balance factor
   * [0.5, 1.0] based on within-team level spread — the more unbalanced the team,
   * the less informative the result is about individual ability.
   *
   * Balance factor:
   * - Balanced team / singles → 1.0  (no reduction)
   * - [0, 100] team           → 0.5  (K halved)
   */
  getKFactor(
    score?: { team1: number; team2: number },
    winner?: 1 | 2,
    teamPlayers?: Player[],
  ): number {
    if (!score || !winner) return 3 * this.teamBalanceFactor(teamPlayers);

    const winnerScore = winner === 1 ? score.team1 : score.team2;
    const loserScore = winner === 1 ? score.team2 : score.team1;

    let rawK: number;
    if (winnerScore !== 21) {
      rawK = 3;
    } else {
      const diff = 21 - loserScore;
      if (diff <= 3) rawK = 4;
      else if (diff <= 6) rawK = 8;
      else if (diff <= 10) rawK = 10;
      else if (diff <= 15) rawK = 12;
      else rawK = 15;
    }

    return rawK * this.teamBalanceFactor(teamPlayers);
  }

  private teamBalanceFactor(players?: Player[]): number {
    if (!players || players.length <= 1) return 1;
    const avg = players.reduce((s, p) => s + (p.level ?? 50), 0) / players.length;
    const variance = players.reduce((s, p) => s + Math.pow((p.level ?? 50) - avg, 2), 0) / players.length;
    return 1 - 0.5 * Math.min(1, Math.sqrt(variance) / 50);
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
   * Uses the Elo formula with a divisor of 400 to compute expected win probabilities.
   * A larger divisor produces a flatter probability curve — a 50-point level gap gives
   * only ~56% expected win (vs ~91% with divisor 50), so mismatched teams cause smaller
   * swings and upsets are less extreme. Max swing is guaranteed < 10 points per game
   * (max K = 15 × max |actual − expected| ≈ 0.64 = 9.6).
   *
   * Average score tracking is updated when a score is recorded.
   *
   * Each team's K-factor is adjusted by a per-team balance factor [0.5, 1.0] based on
   * within-team level spread — the more unbalanced the team, the smaller the rating change.
   */
  updatePlayersLevels(courts: Court[], players: Player[]): Player[] {
    const updatedPlayers = new Map<string, Player>(players.map(p => [p.id, { ...p }]));

    for (const court of courts) {
      if (!court.winner || !court.teams) continue;

      const { team1, team2 } = court.teams;

      const team1Avg = this.getTeamAvgLevel(team1);
      const team2Avg = this.getTeamAvgLevel(team2);

      const team1Expected = 1 / (1 + Math.pow(10, (team2Avg - team1Avg) / 400));
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

      applyLevelDelta(team1, team1Actual, team1Expected);
      applyLevelDelta(team2, team2Actual, team2Expected);

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
