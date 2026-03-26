import type { TournamentTeam } from './types';

export function formatTeamName(team: TournamentTeam): string {
  return team.players.map(p => p.name).join(' & ');
}
