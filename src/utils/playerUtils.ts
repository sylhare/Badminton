import { Player } from '../App';

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