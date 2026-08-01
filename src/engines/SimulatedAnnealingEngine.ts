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

  readonly name = 'Simulated Annealing';
  get description(): string {
    return `Simulated Annealing with iterative improvement. Performs ${this.SA_ITERATIONS} iterations, accepting worse solutions probabilistically to escape local minima.`;
  }

  protected evaluateTeamSplitCost(t1: Player[], t2: Player[]): number {
    let cost = 0;
    cost += this.calculateTeammateCost(t1, this.TEAMMATE_REPEAT_PENALTY);
    cost += this.calculateTeammateCost(t2, this.TEAMMATE_REPEAT_PENALTY);
    cost += this.calculateOpponentCost(t1, t2, this.OPPONENT_REPEAT_PENALTY);
    cost += this.calculateWinBalanceCost(t1, t2, this.BALANCE_PENALTY);
    return cost;
  }

  protected courtSpecificCost(court: Court): number {
    if (!court.teams) return 0;
    return this.calculateSkillPairPenalty(court.teams.team1, this.SKILL_PAIR_PENALTY)
      + this.calculateSkillPairPenalty(court.teams.team2, this.SKILL_PAIR_PENALTY)
      + this.calculateLossBalanceCost(court.teams.team1, court.teams.team2, this.BALANCE_PENALTY);
  }
}

export const engineSA = new CourtAssignmentEngineSA();
