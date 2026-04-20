import type { Player } from '../types';

export const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function teamPairs(team: Player[]): string[] {
  const pairs: string[] = [];
  for (let i = 0; i < team.length; i++)
    for (let j = i + 1; j < team.length; j++)
      pairs.push(pairKey(team[i].id, team[j].id));
  return pairs;
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