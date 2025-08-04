import type { Court, Player } from '../App';

export class CourtAssignmentEngine {
  private static benchCountMap: Map<string, number> = new Map();
  private static teammateCountMap: Map<string, number> = new Map();
  private static opponentCountMap: Map<string, number> = new Map();
  private static winCountMap: Map<string, number> = new Map();
  private static lossCountMap: Map<string, number> = new Map();
  private static readonly MAX_ATTEMPTS = 300;

  constructor(private players: Player[], private numberOfCourts: number) {
  }

  private _assignments: Court[] = [];

  static resetHistory(): void {
    this.benchCountMap.clear();
    this.teammateCountMap.clear();
    this.opponentCountMap.clear();
    this.winCountMap.clear();
    this.lossCountMap.clear();
  }

  static recordWins(courts: Court[]): void {
    courts.forEach(court => {
      if (court.winner && court.teams) {
        const winningTeam = court.winner === 1 ? court.teams.team1 : court.teams.team2;
        const losingTeam = court.winner === 1 ? court.teams.team2 : court.teams.team1;
        winningTeam.forEach(player => {
          this.incrementMapCount(this.winCountMap, player.id);
        });
        losingTeam.forEach(player => {
          this.incrementMapCount(this.lossCountMap, player.id);
        });
      }
    });
  }

  static getWinCounts(): Map<string, number> {
    return new Map(this.winCountMap);
  }

  static generate(players: Player[], numberOfCourts: number): Court[] {
    const presentPlayers = players.filter(p => p.isPresent);
    if (presentPlayers.length === 0) return [];

    const capacity = numberOfCourts * 4;
    let benchSpots = Math.max(0, presentPlayers.length - capacity);
    if ((presentPlayers.length - benchSpots) % 2 === 1) benchSpots += 1;
    benchSpots = Math.min(benchSpots, presentPlayers.length);

    const benchedPlayers = this.selectBenchedPlayers(presentPlayers, benchSpots);
    const onCourtPlayers = presentPlayers.filter(p => !benchedPlayers.includes(p));

    let best: { courts: Court[]; cost: number } | null = null;
    for (let i = 0; i < this.MAX_ATTEMPTS; i++) {
      const cand = this.generateCandidate(onCourtPlayers, numberOfCourts);
      if (!best || cand.cost < best.cost) best = cand;
    }

    const finalCourts = best ? best.courts : [];

    benchedPlayers.forEach(p => this.incrementMapCount(this.benchCountMap, p.id));
    finalCourts.forEach(court => {
      if (!court.teams) return;

      const addTeamPairs = (team: Player[]): void => {
        for (let i = 0; i < team.length; i++) {
          for (let j = i + 1; j < team.length; j++) {
            this.incrementMapCount(this.teammateCountMap, this.pairKey(team[i].id, team[j].id));
          }
        }
      };

      addTeamPairs(court.teams.team1);
      addTeamPairs(court.teams.team2);

      court.teams.team1.forEach(a => {
        court.teams!.team2.forEach(b => {
          this.incrementMapCount(this.opponentCountMap, this.pairKey(a.id, b.id));
        });
      });
    });

    return finalCourts;
  }

  static getBenchedPlayers(assignments: Court[], players: Player[]): Player[] {
    const assignedIds = new Set(assignments.flatMap(c => c.players.map(p => p.id)));
    return players.filter(p => p.isPresent && !assignedIds.has(p.id));
  }

  private static pairKey(a: string, b: string): string {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  private static incrementMapCount(map: Map<string, number>, key: string, inc = 1): void {
    map.set(key, (map.get(key) ?? 0) + inc);
  }

  private static selectBenchedPlayers(players: Player[], benchSpots: number): Player[] {
    if (benchSpots <= 0) return [];

    players.forEach(p => {
      if (!this.benchCountMap.has(p.id)) this.benchCountMap.set(p.id, 0);
    });

    return [...players].sort((a, b) => {
      const diff = (this.benchCountMap.get(a.id) ?? 0) - (this.benchCountMap.get(b.id) ?? 0);
      return diff !== 0 ? diff : Math.random() - 0.5;
    }).slice(0, benchSpots);
  }

  private static evaluateCourtCost(court: Court): number {
    let cost = 0;

    const addTeamPairs = (team: Player[]): void => {
      for (let i = 0; i < team.length; i++) {
        for (let j = i + 1; j < team.length; j++) {
          cost += this.teammateCountMap.get(this.pairKey(team[i].id, team[j].id)) ?? 0;
        }
      }
    };

    if (court.teams) {
      addTeamPairs(court.teams.team1);
      addTeamPairs(court.teams.team2);

      court.teams.team1.forEach(a => {
        court.teams!.team2.forEach(b => {
          cost += this.opponentCountMap.get(this.pairKey(a.id, b.id)) ?? 0;
        });
      });

      const addSkillPairPenalty = (team: Player[]): void => {
        for (let i = 0; i < team.length; i++) {
          for (let j = i + 1; j < team.length; j++) {
            const p1 = team[i];
            const p2 = team[j];
            const wins1 = this.winCountMap.get(p1.id) ?? 0;
            const wins2 = this.winCountMap.get(p2.id) ?? 0;
            const losses1 = this.lossCountMap.get(p1.id) ?? 0;
            const losses2 = this.lossCountMap.get(p2.id) ?? 0;

            cost += wins1 * wins2;
            cost += losses1 * losses2;
          }
        }
      };

      addSkillPairPenalty(court.teams.team1);
      addSkillPairPenalty(court.teams.team2);

      const team1WinSum = court.teams.team1.reduce((acc, p) => acc + (this.winCountMap.get(p.id) ?? 0), 0);
      const team2WinSum = court.teams.team2.reduce((acc, p) => acc + (this.winCountMap.get(p.id) ?? 0), 0);
      cost += Math.abs(team1WinSum - team2WinSum);

      const team1LossSum = court.teams.team1.reduce((acc, p) => acc + (this.lossCountMap.get(p.id) ?? 0), 0);
      const team2LossSum = court.teams.team2.reduce((acc, p) => acc + (this.lossCountMap.get(p.id) ?? 0), 0);
      cost += Math.abs(team1LossSum - team2LossSum);
    }

    return cost;
  }

  private static chooseBestTeamSplit(players: Player[]): { teams: Court['teams']; cost: number } {
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
      const cost = this.evaluateCourtCost({ courtNumber: -1, players, teams: { team1, team2 } });
      if (cost < bestCost) {
        bestCost = cost;
        bestTeams = { team1, team2 };
      }
    });

    return { teams: bestTeams, cost: bestCost };
  }

  private static generateCandidate(onCourtPlayers: Player[], numberOfCourts: number) {
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

      if (courtPlayers.length < 2) break;
      if (courtPlayers.length === 3) {
        playersCopy.unshift(courtPlayers.pop()!);
      }

      let teams: Court['teams'] | undefined;
      let cost = 0;

      if (courtPlayers.length === 4) {
        const res = this.chooseBestTeamSplit(courtPlayers);
        teams = res.teams;
        cost = res.cost;
      } else {
        teams = { team1: [courtPlayers[0]], team2: [courtPlayers[1]] };
        cost = this.evaluateCourtCost({ courtNumber: -1, players: courtPlayers, teams });
      }

      totalCost += cost;
      courts.push({ courtNumber: courtNum, players: courtPlayers, teams });
    }

    return { courts, cost: totalCost };
  }

  generate(): Court[] {
    this._assignments = CourtAssignmentEngine.generate(this.players, this.numberOfCourts);
    return this._assignments;
  }
}

export const __testResetHistory = (): void => CourtAssignmentEngine.resetHistory();

export const generateCourtAssignments = (players: Player[], courts: number): Court[] =>
  CourtAssignmentEngine.generate(players, courts);

export const getBenchedPlayers = (assignments: Court[], players: Player[]): Player[] =>
  CourtAssignmentEngine.getBenchedPlayers(assignments, players);