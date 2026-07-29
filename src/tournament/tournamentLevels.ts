import type { Court, Player } from '../types';

import type { Tournament } from './Tournament';

export interface TournamentLevelInputs {
  baseline: Player[];
  courts: Court[];
}

/** Adapts a tournament's decided matches into the start-of-play baseline and ordered courts the level tracker replays. */
export function tournamentLevelInputs(tournament: Tournament): TournamentLevelInputs {
  const baseline = tournament.teams().flatMap(team => team.players);
  const courts: Court[] = tournament.matches()
    .filter(match => match.winner)
    .sort((a, b) => a.round - b.round || a.courtNumber - b.courtNumber)
    .map(match => ({
      courtNumber: match.courtNumber,
      players: [...match.team1.players, ...match.team2.players],
      teams: { team1: match.team1.players, team2: match.team2.players },
      winner: match.winner,
      score: match.score,
    }));
  return { baseline, courts };
}
