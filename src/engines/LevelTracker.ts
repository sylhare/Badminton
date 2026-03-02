import type { Court, Player } from '../types';

export class LevelTracker {
  /**
   * Determine the K-factor (maximum rating change per game) based on the score.
   * A higher K means a more dominant result causes a larger level adjustment.
   *
   * K-factor scale (winner score must be exactly 21):
   * - Deuce / winner ≠ 21 → K = 6  (closest possible win)
   * - Loser 18–20         → K = 8
   * - Loser 15–17         → K = 12
   * - Loser 11–14         → K = 16
   * - Loser 6–10          → K = 20
   * - Loser < 6           → K = 24  (most dominant win)
   *
   * Returns K = 8 when no score is available (neutral baseline).
   */
  getKFactor(score?: { team1: number; team2: number }, winner?: 1 | 2): number {
    if (!score || !winner) return 8;

    const winnerScore = winner === 1 ? score.team1 : score.team2;
    const loserScore = winner === 1 ? score.team2 : score.team1;

    if (winnerScore !== 21) return 6;

    const diff = 21 - loserScore;
    if (diff <= 3) return 8;
    if (diff <= 6) return 12;
    if (diff <= 10) return 16;
    if (diff <= 15) return 20;
    return 24;
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
   * Uses the Elo formula with a scale factor of 50 to compute expected win probabilities.
   * Average score tracking is updated when a score is recorded.
   */
  updatePlayersLevels(courts: Court[], players: Player[]): Player[] {
    const updatedPlayers = new Map<string, Player>(players.map(p => [p.id, { ...p }]));

    for (const court of courts) {
      if (!court.winner || !court.teams) continue;

      const { team1, team2 } = court.teams;
      const k = this.getKFactor(court.score, court.winner);

      const team1Avg = this.getTeamAvgLevel(team1);
      const team2Avg = this.getTeamAvgLevel(team2);

      const team1Expected = 1 / (1 + Math.pow(10, (team2Avg - team1Avg) / 50));
      const team2Expected = 1 - team1Expected;

      const team1Actual = court.winner === 1 ? 1 : 0;
      const team2Actual = court.winner === 2 ? 1 : 0;

      const applyLevelDelta = (teamPlayers: Player[], actual: number, expected: number) => {
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
        const updateAvgScore = (teamPlayers: Player[], teamScore: number) => {
          const cappedScore = Math.min(teamScore, 21);
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

        updateAvgScore(team1, court.score.team1);
        updateAvgScore(team2, court.score.team2);
      }
    }

    return players.map(p => updatedPlayers.get(p.id) ?? p);
  }
}

export const levelTracker = new LevelTracker();
