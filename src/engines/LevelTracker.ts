import type { Player, ScoredGame } from '../types';
import { DEFAULT_LEVEL } from '../types';
import { MatchScore } from '../scoring/MatchScore';

import { LevelTrackerConfig } from './levelTrackerConfig';

/** Down-scale the K-factor for uneven teams so a lopsided pairing moves ratings less. */
function teamBalanceFactor(players?: Player[]): number {
  if (!players || players.length <= 1) return 1;
  const avg = getTeamAvgLevel(players);
  const variance = players.reduce((s, p) => s + Math.pow((p.level ?? DEFAULT_LEVEL) - avg, 2), 0) / players.length;
  return 1 - LevelTrackerConfig.BALANCE_FACTOR_FLOOR * Math.min(1, Math.sqrt(variance) / LevelTrackerConfig.BALANCE_FACTOR_NORMALIZER);
}

/** K-factor (max rating change per game) from the score, normalised to the reference length and scaled by team balance. */
export function getKFactor(
  score?: { team1: number; team2: number },
  winner?: 1 | 2,
  teamPlayers?: Player[],
): number {
  if (!score || !winner) return LevelTrackerConfig.K_DEFAULT * teamBalanceFactor(teamPlayers);

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

  return rawK * teamBalanceFactor(teamPlayers);
}

/** Compute the average level for a team, defaulting unknown levels to 50. */
export function getTeamAvgLevel(players: Player[]): number {
  if (players.length === 0) return DEFAULT_LEVEL;
  const total = players.reduce((sum, p) => sum + (p.level ?? DEFAULT_LEVEL), 0);
  return total / players.length;
}

/** Direction of a player's last recorded level change, or null if flat / too little history. */
export function getLevelTrend(playerId: string, levelHistory: Map<string, number[]>): 'up' | 'down' | null {
  const history = levelHistory.get(playerId);
  if (!history || history.length < 2) return null;
  const prev = history[history.length - 2];
  const curr = history[history.length - 1];
  if (curr > prev) return 'up';
  if (curr < prev) return 'down';
  return null;
}

/** Elo update per decided game; each change scales by team balance and the game's `importance` (default 1). */
export function updatePlayersLevels(games: ScoredGame[], players: Player[]): Player[] {
  const updated = new Map<string, Player>(players.map(p => [p.id, { ...p }]));

  for (const { court, importance } of games) {
    if (!court.winner || !court.teams) continue;

    const result = MatchScore.of(court.sets ?? [], court.winner);
    const score = result.eloScore();
    const weight = importance ?? LevelTrackerConfig.ELO_DEFAULT_IMPORTANCE;
    const sides = [court.teams.team1, court.teams.team2].map((team, i) => ({
      team: team.map(p => updated.get(p.id) ?? p),
      won: result.winner === i + 1,
      rawScore: i === 0 ? score?.team1 : score?.team2,
    }));
    const avg = sides.map(s => getTeamAvgLevel(s.team));

    sides.forEach((side, i) => {
      const expected = 1 / (1 + Math.pow(10, (avg[1 - i] - avg[i]) / LevelTrackerConfig.ELO_DIVISOR));
      const delta = getKFactor(score, result.winner, side.team) * weight * ((side.won ? 1 : 0) - expected);

      for (const p of side.team) {
        const current = updated.get(p.id);
        if (!current) continue;
        const level = Math.round(Math.min(100, Math.max(0, (current.level ?? DEFAULT_LEVEL) + delta)) * 10) / 10;
        const merged: Player = { ...current, level };

        if (side.rawScore !== undefined) {
          const cappedScore = Math.min(side.rawScore, side.won ? 21 : 20);
          const prevGames = current.scoredGames ?? 0;
          merged.scoredGames = prevGames + 1;
          merged.averageScore =
            Math.round((((current.averageScore ?? 0) * prevGames + cappedScore) / merged.scoredGames) * 10) / 10;
        }

        updated.set(p.id, merged);
      }
    });
  }

  return players.map(p => updated.get(p.id) ?? p);
}

/** Back-compat facade so existing `levelTracker.method(...)` call sites keep working. */
export const levelTracker = { getKFactor, getTeamAvgLevel, getLevelTrend, updatePlayersLevels };
