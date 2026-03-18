import type { TournamentMatch, TournamentTeam } from '../../../types/tournament';

export interface BracketNode {
  type: 'match' | 'bye-advance' | 'tbd';
  match?: TournamentMatch;
  team1: TournamentTeam | null;
  team2: TournamentTeam | null;
}
