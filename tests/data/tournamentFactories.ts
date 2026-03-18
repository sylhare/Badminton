import type { MatchBracket, TournamentMatch, TournamentTeam } from '../../src/types/tournament';

import { createMockPlayer } from './testFactories';

export function makeTeam(id: string, playerNames: string | string[]): TournamentTeam {
  const names = Array.isArray(playerNames) ? playerNames : [playerNames];
  return {
    id,
    players: names.map((name, i) => createMockPlayer({ id: `${id}-p${i}`, name })),
  };
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
