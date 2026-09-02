import type { Court, Player } from '../types';

/** Shuffles an array using Fisher-Yates. Returns a new array. */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** Inverse of {@link pairKey}: splits a pair key back into its two ids. */
export const splitPairKey = (key: string): [string, string] => {
  const [a, b] = key.split('|');
  return [a, b];
};

/** True when two player lists contain the same members (order ignored). */
export function samePlayers(a: Player[], b: Player[]): boolean {
  if (a.length !== b.length) return false;
  const ids = new Set(a.map(p => p.id));
  return b.every(p => ids.has(p.id));
}

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

export type NameSeparator = 'backticks' | 'commas/newlines' | null;

/**
 * Single authority for turning the free-text player-entry field into names.
 * Backticks take precedence over commas/newlines; a lone entry is one name.
 * Returns the already-validated names so the displayed count can never drift
 * from what is actually added.
 */
export function parsePlayerInput(text: string): { names: string[]; separator: NameSeparator } {
  if (text.includes('`')) {
    return { names: validatePlayerNames(text.split('`')), separator: 'backticks' };
  }
  if (/[,\n]/.test(text)) {
    return { names: validatePlayerNames(text.split(/[,\n]+/)), separator: 'commas/newlines' };
  }
  return { names: validatePlayerNames([text]), separator: null };
}

export function benchedPlayers(assignments: Court[], players: Player[]): Player[] {
  const assignedIds = new Set(assignments.flatMap(c => c.players.map(p => p.id)));
  return players.filter(p => p.isPresent && !assignedIds.has(p.id));
}