import type { MatchBracket, TournamentMatch, TournamentTeam } from '../../src/tournament/types.ts';

export function makeTeam(id: string, playerNames: string | string[]): TournamentTeam {
  const names = Array.isArray(playerNames) ? playerNames : [playerNames];
  return {
    id,
    playerIds: names.map((_, i) => `${id}-p${i}`),
  };
}

/** Build a Player array matching the playerIds produced by makeTeam. */
export function makeTeamPlayers(id: string, playerNames: string | string[]): { id: string; name: string; isPresent: boolean }[] {
  const names = Array.isArray(playerNames) ? playerNames : [playerNames];
  return names.map((name, i) => ({ id: `${id}-p${i}`, name, isPresent: true }));
}

export function makeMatch(
  id: string,
  round: number,
  team1: TournamentTeam,
  team2: TournamentTeam,
  winner?: 1 | 2,
  score?: { team1: number; team2: number },
  bracket?: MatchBracket,
): TournamentMatch {
  return { id, round, courtNumber: 1, team1, team2, winner, score, bracket };
}
