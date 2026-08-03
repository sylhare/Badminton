import type { TournamentTeam } from './types';

export interface RoundRobinPairing {
  round: number;
  team1: TournamentTeam;
  team2: TournamentTeam;
}

/**
 * Circle-method round-robin schedule: every team meets every other exactly once.
 * An odd count adds a bye slot, so one team sits out each round. Returns pairings
 * with 1-based round numbers; callers assign match ids and courts.
 */
export function roundRobinPairings(teams: TournamentTeam[]): RoundRobinPairing[] {
  const n = teams.length;
  if (n < 2) return [];

  const hasBye = n % 2 !== 0;
  const padded: (TournamentTeam | null)[] = hasBye ? [...teams, null] : [...teams];
  const m = padded.length;

  const pairings: RoundRobinPairing[] = [];
  const rotating = padded.slice(1);

  for (let round = 0; round < m - 1; round++) {
    const roundTeams = [padded[0], ...rotating];

    for (let i = 0; i < m / 2; i++) {
      const t1 = roundTeams[i];
      const t2 = roundTeams[m - 1 - i];
      if (t1 === null || t2 === null) continue;
      pairings.push({ round: round + 1, team1: t1, team2: t2 });
    }

    const last = rotating.pop()!;
    rotating.unshift(last);
  }

  return pairings;
}
