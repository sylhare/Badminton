import type { Player } from '../types';

/**
 * Self-contained mock data + pure layout helpers for the team-editing demos.
 * Nothing here touches the real engine or storage — the demos are a sandbox
 * for comparing interaction styles, so they stay side-effect free.
 */

export interface DemoCourt {
  courtNumber: number;
  team1: Player[];
  team2: Player[];
}

export interface Layout {
  courts: DemoCourt[];
  bench: Player[];
}

/** Address of a single player slot anywhere in a layout. */
export type SlotAddr =
  | { kind: 'court'; courtIdx: number; team: 1 | 2; playerIdx: number }
  | { kind: 'bench'; playerIdx: number };

const NAMES = [
  'Ann', 'Bob', 'Cid', 'Dan', 'Eve', 'Fay', 'Gia', 'Hal',
  'Ivy', 'Jax', 'Kim', 'Leo', 'Mia', 'Ned',
];

export const DEMO_PLAYERS: Player[] = NAMES.map((name, i) => ({
  id: `p${i + 1}`,
  name,
  isPresent: true,
  gender: i % 2 === 0 ? 'F' : 'M',
  level: 30 + ((i * 13) % 60),
}));

export function sameSlot(a: SlotAddr, b: SlotAddr): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'bench' && b.kind === 'bench') return a.playerIdx === b.playerIdx;
  if (a.kind === 'court' && b.kind === 'court') {
    return a.courtIdx === b.courtIdx && a.team === b.team && a.playerIdx === b.playerIdx;
  }
  return false;
}

function cloneLayout(layout: Layout): Layout {
  return {
    courts: layout.courts.map(c => ({
      courtNumber: c.courtNumber,
      team1: [...c.team1],
      team2: [...c.team2],
    })),
    bench: [...layout.bench],
  };
}

function readSlot(layout: Layout, addr: SlotAddr): Player | undefined {
  if (addr.kind === 'bench') return layout.bench[addr.playerIdx];
  const court = layout.courts[addr.courtIdx];
  if (!court) return undefined;
  return (addr.team === 1 ? court.team1 : court.team2)[addr.playerIdx];
}

function writeSlot(layout: Layout, addr: SlotAddr, player: Player): void {
  if (addr.kind === 'bench') {
    layout.bench[addr.playerIdx] = player;
    return;
  }
  const court = layout.courts[addr.courtIdx];
  if (!court) return;
  (addr.team === 1 ? court.team1 : court.team2)[addr.playerIdx] = player;
}

/**
 * Swap the two players at addresses `a` and `b`, returning a new layout.
 * This is the single edit primitive shared by both the click-to-swap and
 * drag-and-drop demos — moving a bench player onto a court simply swaps the
 * displaced court player onto the bench (a natural "sub in" behaviour).
 */
export function swapSlots(layout: Layout, a: SlotAddr, b: SlotAddr): Layout {
  if (sameSlot(a, b)) return layout;
  const playerA = readSlot(layout, a);
  const playerB = readSlot(layout, b);
  if (!playerA || !playerB) return layout;

  const next = cloneLayout(layout);
  writeSlot(next, a, playerB);
  writeSlot(next, b, playerA);
  return next;
}

/** Chunk present players into courts of four; the remainder goes to the bench. */
export function buildLayout(players: Player[], numberOfCourts: number): Layout {
  const present = players.filter(p => p.isPresent);
  const courts: DemoCourt[] = [];
  let cursor = 0;

  for (let i = 0; i < numberOfCourts && cursor + 4 <= present.length; i++) {
    const group = present.slice(cursor, cursor + 4);
    courts.push({ courtNumber: i + 1, team1: group.slice(0, 2), team2: group.slice(2, 4) });
    cursor += 4;
  }

  return { courts, bench: present.slice(cursor) };
}
