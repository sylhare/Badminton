import type { Court, ICourtAssignmentEngine, ManualCourtSelection, Player } from '../types';

import { CourtAssignmentTracker } from './CourtAssignmentTracker';

/**
 * Base Court Assignment Engine
 *
 * Implements the Template Method pattern for court generation.
 * Handles common tasks like:
 * - Filtering present players
 * - Managing manual court selections
 * - Calculating and assigning bench spots
 * - Recording statistics (benching, singles, pairs)
 *
 * Subclasses must implement `generateAssignments` to provide the specific
 * algorithm for pairing players on the available courts.
 */
export abstract class BaseCourtAssignmentEngine extends CourtAssignmentTracker implements ICourtAssignmentEngine {

  abstract getDescription(): string;

  abstract getName(): string;

  /**
   * Generates court assignments for a set of players.
   * This template method defines the skeletal implementation of the assignment process.
   */
  generate(
    players: Player[],
    numberOfCourts: number,
    manualSelection?: ManualCourtSelection,
    forceBenchPlayerIds?: Set<string>,
  ): Court[] {
    const presentPlayers = players.filter(p => p.isPresent);
    if (presentPlayers.length === 0) return [];

    let manualCourtResult: Court | null = null;
    let remainingPlayers = presentPlayers;
    let remainingCourts = numberOfCourts;

    if (manualSelection && manualSelection.players.length > 0) {
      const manualPlayers = manualSelection.players.filter(p => p.isPresent);
      if (manualPlayers.length >= 2 && manualPlayers.length <= 4) {
        manualCourtResult = this.createManualCourt(manualPlayers, 1, (p) => this.getOptimalTeamSplit(p));
        remainingPlayers = presentPlayers.filter(p => !manualPlayers.some(mp => mp.id === p.id));
        remainingCourts = numberOfCourts - 1;
      }
    }

    const capacity = remainingCourts * 4;
    let benchSpots = Math.max(0, remainingPlayers.length - capacity);
    if ((remainingPlayers.length - benchSpots) % 2 === 1) benchSpots += 1;
    benchSpots = Math.min(benchSpots, remainingPlayers.length);

    const forceBenchedPlayers = forceBenchPlayerIds
      ? remainingPlayers.filter(p => forceBenchPlayerIds.has(p.id))
      : [];

    const additionalBenchSpots = Math.max(0, benchSpots - forceBenchedPlayers.length);
    const playersForAlgorithmBench = remainingPlayers.filter(p => !forceBenchPlayerIds?.has(p.id));
    const algorithmBenchedPlayers = this.selectBenchedPlayers(playersForAlgorithmBench, additionalBenchSpots);

    const benchedPlayers = [...forceBenchedPlayers, ...algorithmBenchedPlayers];

    const onCourtPlayers = remainingPlayers.filter(p => !benchedPlayers.includes(p));

    const startCourtNum = manualCourtResult ? 2 : 1;
    let finalCourts = this.generateAssignments(onCourtPlayers, remainingCourts, startCourtNum);
    if (manualCourtResult) {
      finalCourts = [manualCourtResult, ...finalCourts];
    }

    this.recordSessionStats(benchedPlayers, finalCourts);

    return finalCourts;
  }

  /**
   * Core algorithm implementation to be defined by subclasses.
   * @param players Players available for assignment (already filtered for benching).
   * @param numberOfCourts Number of courts to fill.
   * @param startCourtNum The starting court number (offset if manual court exists).
   */
  protected abstract generateAssignments(players: Player[], numberOfCourts: number, startCourtNum: number): Court[];

  /**
   * Helper to split 4 players into 2 teams.
   * Subclasses should implement their specific heuristic (cost interpretation).
   * By default, engines used `chooseBestTeamSplit`.
   */
  protected abstract getOptimalTeamSplit(players: Player[]): Court['teams'];

  /**
   * Evaluates the cost of a specific team split.
   * Each engine implements its own cost calculation logic.
   */
  protected abstract evaluateTeamSplitCost(team1: Player[], team2: Player[]): number;

  /**
   * Chooses the best team split from all possible configurations.
   * Uses the engine-specific cost evaluation to select optimal teams.
   */
  protected chooseBestTeamSplit(players: Player[]): { teams: Court['teams']; cost: number } {
    const splits: Array<[[number, number], [number, number]]> = [
      [[0, 1], [2, 3]],
      [[0, 2], [1, 3]],
      [[0, 3], [1, 2]],
    ];

    let bestCost = Infinity;
    let bestTeams: Court['teams'];

    for (const split of splits) {
      const team1 = [players[split[0][0]], players[split[0][1]]];
      const team2 = [players[split[1][0]], players[split[1][1]]];
      const cost = this.evaluateTeamSplitCost(team1, team2);

      if (cost < bestCost) {
        bestCost = cost;
        bestTeams = { team1, team2 };
      }
    }

    return { teams: bestTeams!, cost: bestCost };
  }

  /**
   * Records statistics for the generated round.
   */
  protected recordSessionStats(benchedPlayers: Player[], courts: Court[]): void {
    benchedPlayers.forEach(p => this.recordBenching(p.id));

    courts.forEach(court => {
      if (!court.teams) return;

      if (court.players.length === 2) {
        court.players.forEach(p => this.recordSingles(p.id));
      }

      const addTeamPairs = (team: Player[]) => {
        for (let i = 0; i < team.length; i++) {
          for (let j = i + 1; j < team.length; j++) {
            this.recordTeammatePair(team[i].id, team[j].id);
          }
        }
      };
      addTeamPairs(court.teams.team1);
      addTeamPairs(court.teams.team2);

      court.teams.team1.forEach(a => {
        court.teams!.team2.forEach(b => {
          this.recordOpponentPair(a.id, b.id);
        });
      });
    });
  }

  /**
   * Calculates the teammate repetition cost for a team.
   */
  protected calculateTeammateCost(team: Player[], penaltyMultiplier: number): number {
    let cost = 0;
    for (let i = 0; i < team.length; i++) {
      for (let j = i + 1; j < team.length; j++) {
        cost += (this.teammateCountMap.get(this.pairKey(team[i].id, team[j].id)) ?? 0) * penaltyMultiplier;
      }
    }
    return cost;
  }

  /**
   * Calculates the skill-based pairing penalty for a team.
   * Penalizes pairing players with similar skill levels (wins/losses).
   */
  protected calculateSkillPairPenalty(team: Player[], penaltyMultiplier: number): number {
    let cost = 0;
    for (let i = 0; i < team.length; i++) {
      for (let j = i + 1; j < team.length; j++) {
        const wins1 = this.winCountMap.get(team[i].id) ?? 0;
        const wins2 = this.winCountMap.get(team[j].id) ?? 0;
        const losses1 = this.lossCountMap.get(team[i].id) ?? 0;
        const losses2 = this.lossCountMap.get(team[j].id) ?? 0;
        cost += (wins1 * wins2 + losses1 * losses2) * penaltyMultiplier;
      }
    }
    return cost;
  }

  /**
   * Calculates the opponent repetition cost between two teams.
   */
  protected calculateOpponentCost(team1: Player[], team2: Player[], penaltyMultiplier: number): number {
    let cost = 0;
    team1.forEach(a => {
      team2.forEach(b => {
        cost += (this.opponentCountMap.get(this.pairKey(a.id, b.id)) ?? 0) * penaltyMultiplier;
      });
    });
    return cost;
  }

  /**
   * Calculates the win balance cost between two teams.
   * Penalizes imbalanced matchups based on win history.
   */
  protected calculateWinBalanceCost(team1: Player[], team2: Player[], penaltyMultiplier: number): number {
    const team1WinSum = team1.reduce((acc, p) => acc + (this.winCountMap.get(p.id) ?? 0), 0);
    const team2WinSum = team2.reduce((acc, p) => acc + (this.winCountMap.get(p.id) ?? 0), 0);
    return Math.abs(team1WinSum - team2WinSum) * penaltyMultiplier;
  }

  /**
   * Calculates the loss balance cost between two teams.
   * Penalizes imbalanced matchups based on loss history.
   */
  protected calculateLossBalanceCost(team1: Player[], team2: Player[], penaltyMultiplier: number): number {
    const team1LossSum = team1.reduce((acc, p) => acc + (this.lossCountMap.get(p.id) ?? 0), 0);
    const team2LossSum = team2.reduce((acc, p) => acc + (this.lossCountMap.get(p.id) ?? 0), 0);
    return Math.abs(team1LossSum - team2LossSum) * penaltyMultiplier;
  }

  /**
   * Calculates the singles repetition cost for a pair of players.
   */
  protected calculateSinglesCost(players: Player[], penaltyMultiplier: number): number {
    if (players.length !== 2) return 0;
    const p1Count = this.singleCountMap.get(players[0].id) ?? 0;
    const p2Count = this.singleCountMap.get(players[1].id) ?? 0;
    return (p1Count + p2Count) * penaltyMultiplier;
  }

  /**
   * Creates teams from a list of players.
   * For 4 players, uses optimal team split. For 2 players, creates singles match.
   */
  protected createTeamsFromPlayers(players: Player[]): Court['teams'] {
    if (players.length === 4) {
      return this.chooseBestTeamSplit(players).teams;
    } else if (players.length === 2) {
      return { team1: [players[0]], team2: [players[1]] };
    }
    return undefined;
  }
}
