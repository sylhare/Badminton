import type { Player, Court } from '../App';

/**
 * Builds teams for a given court based on the number of players available.
 *
 * - 4+ players → doubles (2 & 2)
 * - 3 players  → singles + 1 waiting
 * - 2 players  → singles
 * - <2 players → undefined (not enough players)
 */
export function createTeamsForCourt(courtPlayers: Player[]): Court['teams'] {
  if (courtPlayers.length >= 4) {
    return {
      team1: [courtPlayers[0], courtPlayers[1]],
      team2: [courtPlayers[2], courtPlayers[3]],
    };
  }

  if (courtPlayers.length === 3) {
    return {
      team1: [courtPlayers[0]],
      team2: [courtPlayers[1]],
    };
  }

  if (courtPlayers.length === 2) {
    return {
      team1: [courtPlayers[0]],
      team2: [courtPlayers[1]],
    };
  }

  return undefined;
}

/**
 * Generates court assignments from the available players and user-selected settings.
 * The algorithm is intentionally simple (random shuffle + sequential allocation)
 * so that it can be swapped out or enhanced from this single module.
 *
 * @param players         All players that have been added to the system.
 * @param numberOfCourts  Total courts available for assignment.
 * @returns               Array of Court objects (may be empty).
 */
export function generateCourtAssignments(players: Player[], numberOfCourts: number): Court[] {
  // 1. Filter to present players
  const presentPlayers = players.filter(p => p.isPresent);
  if (presentPlayers.length === 0) return [];

  // 2. Determine bench spots & select benched players fairly.
  //    Additional rule: on-court players must be an EVEN number so that every
  //    court ends up with either 2 (singles) or 4 (doubles) players – no 3-player courts.

  const capacity = numberOfCourts * 4;

  let benchSpots = Math.max(0, presentPlayers.length - capacity);

  // If the remaining on-court total would be odd, bench one more.
  if ((presentPlayers.length - benchSpots) % 2 === 1) {
    benchSpots += 1;
  }

  // Clamp (safety):
  benchSpots = Math.min(benchSpots, presentPlayers.length);

  const benchedPlayers = selectBenchedPlayers(presentPlayers, benchSpots);
  const onCourtPlayers = presentPlayers.filter(p => !benchedPlayers.includes(p));

  // 3. Generate multiple candidate assignments & pick the minimal-cost one
  let best: CandidateAssignment | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const cand = generateCandidate(onCourtPlayers, numberOfCourts);
    if (!best || cand.cost < best.cost) best = cand;
  }

  const finalCourts = best ? best.courts : [];

  // 4. Update historical maps for next round
  // 4a. Benches
  benchedPlayers.forEach(p => incrementMapCount(benchCountMap, p.id));

  // 4b. Teammates & opponents
  finalCourts.forEach(court => {
    const players = court.players;
    // teammates
    if (court.teams) {
      const teamPairs: Array<[Player, Player]> = [];
      court.teams.team1.forEach((p, idx) => {
        for (let j = idx + 1; j < court.teams!.team1.length; j++) {
          teamPairs.push([p, court.teams!.team1[j]]);
        }
      });
      court.teams.team2.forEach((p, idx) => {
        for (let j = idx + 1; j < court.teams!.team2.length; j++) {
          teamPairs.push([p, court.teams!.team2[j]]);
        }
      });
      teamPairs.forEach(([a, b]) => incrementMapCount(teammateCountMap, pairKey(a.id, b.id)));
    }

    // opponents (any unique pair on different teams)
    if (court.teams) {
      court.teams.team1.forEach(a => {
        court.teams!.team2.forEach(b => {
          incrementMapCount(opponentCountMap, pairKey(a.id, b.id));
        });
      });
    }
  });

  return finalCourts;
}

/**
 * Returns the list of present players that are NOT currently assigned to any court.
 */
export function getBenchedPlayers(assignments: Court[], players: Player[]): Player[] {
  const assignedIds = new Set(assignments.flatMap(court => court.players.map(p => p.id)));
  return players.filter(p => p.isPresent && !assignedIds.has(p.id));
}

// ---------------------------------------------------------------------------
// Optional OO wrapper – provides a single place to evolve assignment behaviour
// without changing consuming components. Not used by the UI yet, but ready.
// ---------------------------------------------------------------------------
export class CourtAssignmentEngine {
  private _assignments: Court[] = [];

  constructor(private players: Player[], private numberOfCourts: number) {}

  generate(): Court[] {
    this._assignments = generateCourtAssignments(this.players, this.numberOfCourts);
    return this._assignments;
  }

  get assignments(): Court[] {
    return this._assignments;
  }

  getBenchedPlayers(): Player[] {
    return getBenchedPlayers(this._assignments, this.players);
  }
}

// -------------------- TESTING HELPERS --------------------
/**
 * Clears all internal history maps. Only intended for unit tests.
 */
export function __testResetHistory(): void {
  benchCountMap.clear();
  teammateCountMap.clear();
  opponentCountMap.clear();
}

// ----------------------------------------------------------------------------
// Persistent historical data – lives for the duration of the browser session.
// This fulfils fairness rules across successive “generate” clicks without the
// need for additional plumbing in React components.
// ----------------------------------------------------------------------------

/*
 * How often each player has been benched.
 * key   → playerId (string)
 * value → benchCount (number, starts at 0)
 */
const benchCountMap: Map<string, number> = new Map();

/*
 * How many times a pair of players have been team-mates.
 * key   → "idA|idB" (sorted alphabetically to ensure uniqueness)
 * value → count
 */
const teammateCountMap: Map<string, number> = new Map();

/*
 * How many times a pair of players have appeared on the *same court*
 * but on opposing teams.
 */
const opponentCountMap: Map<string, number> = new Map();

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function incrementMapCount(map: Map<string, number>, key: string, inc = 1): void {
  map.set(key, (map.get(key) ?? 0) + inc);
}

// ----------------------------------------------------------------------------
// Bench-selection helpers
// ----------------------------------------------------------------------------

function selectBenchedPlayers(players: Player[], benchSpots: number): Player[] {
  if (benchSpots <= 0) return [];

  // Ensure every player exists in the map
  players.forEach(p => {
    if (!benchCountMap.has(p.id)) benchCountMap.set(p.id, 0);
  });

  // Sort by bench count ascending (fewest benches first). If tie, random order.
  const sorted = [...players].sort((a, b) => {
    const diff = (benchCountMap.get(a.id) ?? 0) - (benchCountMap.get(b.id) ?? 0);
    return diff !== 0 ? diff : Math.random() - 0.5;
  });

  return sorted.slice(0, benchSpots);
}

// ----------------------------------------------------------------------------
// Team-optimisation helpers
// ----------------------------------------------------------------------------

interface CandidateAssignment {
  courts: Court[];
  cost: number;
}

const MAX_ATTEMPTS = 300;

function evaluateCourtCost(court: Court): number {
  const players = court.players;

  let cost = 0;

  // teammate costs
  const teamPairs: Array<[Player, Player]> = [];
  if (court.teams) {
    court.teams.team1.forEach((p, idx) => {
      for (let j = idx + 1; j < court.teams!.team1.length; j++) {
        teamPairs.push([p, court.teams!.team1[j]]);
      }
    });
    court.teams.team2.forEach((p, idx) => {
      for (let j = idx + 1; j < court.teams!.team2.length; j++) {
        teamPairs.push([p, court.teams!.team2[j]]);
      }
    });
  }

  teamPairs.forEach(([a, b]) => {
    cost += teammateCountMap.get(pairKey(a.id, b.id)) ?? 0;
  });

  // opponent costs (any two players on court but diff teams)
  const opponentPairs: Array<[Player, Player]> = [];
  if (court.teams) {
    court.teams.team1.forEach(a => {
      court.teams!.team2.forEach(b => {
        opponentPairs.push([a, b]);
      });
    });
  }

  opponentPairs.forEach(([a, b]) => {
    cost += opponentCountMap.get(pairKey(a.id, b.id)) ?? 0;
  });

  return cost;
}

function chooseBestTeamSplit(players: Player[]): { teams: Court['teams']; cost: number } {
  // players length must be 4 here.
  const splits: Array<[[number, number], [number, number]]> = [
    [[0, 1], [2, 3]],
    [[0, 2], [1, 3]],
    [[0, 3], [1, 2]],
  ];

  let bestCost = Infinity;
  let bestTeams: Court['teams'] = undefined;

  splits.forEach(split => {
    const team1 = [players[split[0][0]], players[split[0][1]]];
    const team2 = [players[split[1][0]], players[split[1][1]]];

    const tempCourt: Court = {
      courtNumber: -1, // dummy
      players,
      teams: { team1, team2 },
    };

    const cost = evaluateCourtCost(tempCourt);
    if (cost < bestCost) {
      bestCost = cost;
      bestTeams = { team1, team2 };
    }
  });

  return { teams: bestTeams, cost: bestCost };
}

function generateCandidate(onCourtPlayers: Player[], numberOfCourts: number): CandidateAssignment {
  const courts: Court[] = [];
  const playersCopy = [...onCourtPlayers].sort(() => Math.random() - 0.5);

  const playersPerCourt = 4;
  let idx = 0;
  let totalCost = 0;

  for (let courtNum = 1; courtNum <= numberOfCourts; courtNum++) {
    const courtPlayers: Player[] = [];
    for (let i = 0; i < playersPerCourt && idx < playersCopy.length; i++) {
      courtPlayers.push(playersCopy[idx++]);
    }

    if (courtPlayers.length < 2) break; // ignore incomplete courts

    // If somehow we picked 3 players (should not happen due to bench logic),
    // move one back to the pool so the count is even.
    if (courtPlayers.length === 3) {
      playersCopy.unshift(courtPlayers.pop()!);
    }

    let teams: Court['teams'] | undefined;
    let cost = 0;

    if (courtPlayers.length === 4) {
      const res = chooseBestTeamSplit(courtPlayers);
      teams = res.teams;
      cost = res.cost;
    } else if (courtPlayers.length === 3) {
      teams = {
        team1: [courtPlayers[0]],
        team2: [courtPlayers[1]],
      };
      cost = evaluateCourtCost({ courtNumber: -1, players: courtPlayers, teams });
    } else if (courtPlayers.length === 2) {
      teams = {
        team1: [courtPlayers[0]],
        team2: [courtPlayers[1]],
      };
      cost = evaluateCourtCost({ courtNumber: -1, players: courtPlayers, teams });
    }

    totalCost += cost;

    courts.push({
      courtNumber: courtNum,
      players: courtPlayers,
      teams,
    });
  }

  return { courts, cost: totalCost };
}

// ----------------------------------------------------------------------------
// Main algorithm (public API)
// ---------------------------------------------------------------------------- 