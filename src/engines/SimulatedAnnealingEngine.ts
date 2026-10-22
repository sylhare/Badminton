import type { ICourtAssignmentEngine } from '../types';

import { SimulatedAnnealingBase } from './SimulatedAnnealingBase';

/**
 * Simulated Annealing Implementation
 *
 * This engine uses simulated annealing to find a solution that minimizes
 * repetitions and balances teams.
 */
export class CourtAssignmentEngineSA extends SimulatedAnnealingBase implements ICourtAssignmentEngine {
  readonly name = 'Simulated Annealing';
  readonly descriptionKey = 'engine.sa.description';
  get descriptionParams(): { iterations: number } {
    return { iterations: this.SA_ITERATIONS };
  }
  get description(): string {
    return `Simulated Annealing with iterative improvement. Performs ${this.SA_ITERATIONS} iterations, accepting worse solutions probabilistically to escape local minima.`;
  }

  protected courtSpecificCost(): number {
    return 0;
  }
}

export const engineSA = new CourtAssignmentEngineSA();
