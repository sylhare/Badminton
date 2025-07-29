import { Player } from '../App';

/**
 * Creates Player objects from an array of names
 * @param names Array of player names
 * @param idPrefix Optional prefix for the player ID
 * @returns Array of Player objects
 */
export function createPlayersFromNames(names: string[], idPrefix = 'player'): Player[] {
  const timestamp = Date.now();
  return names.map((name, index) => ({
    id: `${idPrefix}-${timestamp}-${index}`,
    name: name.trim(),
    isPresent: true,
  }));
}

/**
 * Validates and filters player names
 * @param names Array of raw names
 * @returns Array of valid, trimmed names
 */
export function validatePlayerNames(names: string[]): string[] {
  return names
    .map(name => name.trim())
    .filter(name => name.length > 0);
}