import type { Court, ICourtAssignmentEngine, Player } from '../types';

import { SimulatedAnnealingBase } from './SimulatedAnnealingBase';

/**
 * Simulated Annealing Implementation
 *
 * This engine uses simulated annealing to find a solution that minimizes
 * repetitions and balances teams.
 */
export class CourtAssignmentEngineSA extends SimulatedAnnealingBase implements ICourtAssignmentEngine {
  private readonly SKILL_PAIR_PENALTY = 1000;

  getName(): string {
    return 'Simulated Annealing';
  }

  getDescription(): string {
    return 'Simulated Annealing with iterative improvement. Performs 5000 iterations, accepting worse solutions probabilistically to escape local minima.';
  }

  protected evaluateTeamSplitCost(t1: Player[], t2: Player[]): number {
    let cost = 0;
    cost += this.calculateTeammateCost(t1, this.TEAMMATE_REPEAT_PENALTY);
    cost += this.calculateTeammateCost(t2, this.TEAMMATE_REPEAT_PENALTY);
    cost += this.calculateOpponentCost(t1, t2, this.OPPONENT_REPEAT_PENALTY);
    cost += this.calculateWinBalanceCost(t1, t2, this.BALANCE_PENALTY);
    return cost;
  }

  protected evaluateTotalCost(courts: Court[]): number {
    let totalCost = 0;
    for (const court of courts) {
      if (!court.teams) continue;
      if (court.players.length === 2) {
        totalCost += this.calculateSinglesCost(court.players, this.SINGLES_REPEAT_PENALTY);
      }
      totalCost += this.calculateTeammateCost(court.teams.team1, this.TEAMMATE_REPEAT_PENALTY);
      totalCost += this.calculateTeammateCost(court.teams.team2, this.TEAMMATE_REPEAT_PENALTY);
      totalCost += this.calculateOpponentCost(court.teams.team1, court.teams.team2, this.OPPONENT_REPEAT_PENALTY);
      totalCost += this.calculateSkillPairPenalty(court.teams.team1, this.SKILL_PAIR_PENALTY);
      totalCost += this.calculateSkillPairPenalty(court.teams.team2, this.SKILL_PAIR_PENALTY);
      totalCost += this.calculateWinBalanceCost(court.teams.team1, court.teams.team2, this.BALANCE_PENALTY);
      totalCost += this.calculateLossBalanceCost(court.teams.team1, court.teams.team2, this.BALANCE_PENALTY);
    }
    return totalCost;
  }
}

export const engineSA = new CourtAssignmentEngineSA();
