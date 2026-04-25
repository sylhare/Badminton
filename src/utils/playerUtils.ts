import type { Court, Player } from '../types';

export const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function teamPairs(team: Player[]): string[] {
  const pairs: string[] = [];
  for (let i = 0; i < team.length; i++)
    for (let j = i + 1; j < team.length; j++)
      pairs.push(pairKey(team[i].id, team[j].id));
  return pairs;
}

export function opponentPairs(team1: Player[], team2: Player[]): string[] {
  return team1.flatMap(a => team2.map(b => pairKey(a.id, b.id)));
}

export function createPlayersFromNames(names: string[], idPrefix = 'player'): Player[] {
  const timestamp = Date.now();
  return names.map((name, index) => ({
    id: `${idPrefix}-${timestamp}-${index}`,
    name: name.trim(),
    isPresent: true,
  }));
}

export function validatePlayerNames(names: string[]): string[] {
  return names.map(name => name.trim()).filter(name => name.length > 0);
}

export function benchedPlayers(assignments: Court[], players: Player[]): Player[] {
  const assignedIds = new Set(assignments.flatMap(c => c.players.map(p => p.id)));
  return players.filter(p => p.isPresent && !assignedIds.has(p.id));
}