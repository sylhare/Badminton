import type { Court, Player } from '../types';

import type { SlotAddr } from './slotSwap';
import { swapInGroups } from './slotSwap';
import { samePlayers } from './playerUtils';

/**
 * Court-domain adapter over the generic slot-swap primitive.
 *
 * The editable model treats every court as two groups (team1, team2) followed
 * by a single bench group, so a court at index `ci` owns groups `ci*2`
 * (team 1) and `ci*2+1` (team 2), and the bench is the final group. The UI and
 * this reducer both use these helpers so slot addresses line up exactly.
 */

export interface CourtLayout {
  courts: Court[];
  bench: Player[];
}

export interface CourtSwapResult extends CourtLayout {
  /** Court numbers whose team composition changed (winner/score were cleared). */
  changedCourtNumbers: number[];
}

/** Group index of a court's team. */
export function courtTeamGroup(courtIndex: number, team: 1 | 2): number {
  return courtIndex * 2 + (team - 1);
}

/** Group index of the bench, given the number of courts. */
export function benchGroup(courtCount: number): number {
  return courtCount * 2;
}

/** Full slot address of a player on a court team. */
export function courtSlot(courtIndex: number, team: 1 | 2, index: number): SlotAddr {
  return { group: courtTeamGroup(courtIndex, team), index };
}

/** Full slot address of a benched player. */
export function benchSlot(courtCount: number, index: number): SlotAddr {
  return { group: benchGroup(courtCount), index };
}

function buildGroups(courts: Court[], bench: Player[]): Player[][] {
  const groups: Player[][] = [];
  for (const court of courts) {
    groups.push(court.teams?.team1 ?? []);
    groups.push(court.teams?.team2 ?? []);
  }
  groups.push(bench);
  return groups;
}

/**
 * Swaps the two addressed players and rebuilds the court layout, keeping each
 * court's `players` list in sync with its `teams` and clearing `winner`/`score`
 * on any court whose team composition changed (the previous result is no longer
 * valid once the line-up differs). Returns the original layout unchanged for a
 * no-op swap.
 */
export function applyCourtSwap(
  courts: Court[],
  bench: Player[],
  a: SlotAddr,
  b: SlotAddr,
): CourtSwapResult {
  const groups = buildGroups(courts, bench);
  const swapped = swapInGroups(groups, a, b);
  if (swapped === groups) return { courts, bench, changedCourtNumbers: [] };

  const changedCourtNumbers: number[] = [];

  const nextCourts = courts.map((court, ci) => {
    if (!court.teams) return court; // no editable slots on this court
    const team1 = swapped[courtTeamGroup(ci, 1)];
    const team2 = swapped[courtTeamGroup(ci, 2)];
    const changed = !samePlayers(court.teams.team1, team1) || !samePlayers(court.teams.team2, team2);

    // Preserve any player not on a team (e.g. a singles waiting player); swaps
    // only move players between team/bench slots, so extras are untouched.
    const origTeamIds = new Set([...court.teams.team1, ...court.teams.team2].map(p => p.id));
    const extras = court.players.filter(p => !origTeamIds.has(p.id));

    const next: Court = {
      ...court,
      teams: { team1, team2 },
      players: [...team1, ...team2, ...extras],
    };

    if (changed) {
      next.winner = undefined;
      next.score = undefined;
      changedCourtNumbers.push(court.courtNumber);
    }
    return next;
  });

  return { courts: nextCourts, bench: swapped[benchGroup(courts.length)], changedCourtNumbers };
}
