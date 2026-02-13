/**
 * Engine Selector - Utility for switching between court assignment algorithms
 *
 * This module provides a unified interface for selecting and using different
 * court assignment engines. All engines implement the same API, making them
 * drop-in replacements for each other.
 *
 * Available Engines:
 * - 'sa' (default): Simulated Annealing - 5000 iterative improvements, escapes local minima
 * - 'mc': Monte Carlo Greedy Search - 300 random samples, picks best
 * - 'cg': Conflict Graph - Deterministic greedy construction with conflict modeling
 *
 * Usage:
 * ```typescript
 * import { setEngine, getEngine, generateCourtAssignments } from './engineSelector';
 *
 * // Switch to Monte Carlo engine
 * setEngine('mc');
 *
 * // Use the unified API
 * const assignments = generateCourtAssignments(players, courts);
 * ```
 */

import type { Court, Player, ManualCourtSelection, CourtEngineState, ICourtAssignmentEngine } from '../types';

import { engineMC } from './MonteCarloEngine';
import { engineSA } from './SimulatedAnnealingEngine';
import { engineCG } from './ConflictGraphEngine';

export type EngineType = 'sa' | 'mc' | 'cg';

/** Currently selected engine type */
let currentEngineType: EngineType = 'sa';

/**
 * Gets the engine instance for the specified type.
 */
const getEngineInstance = (type: EngineType): ICourtAssignmentEngine => {
  switch (type) {
    case 'cg':
      return engineCG;
    case 'mc':
      return engineMC;
    case 'sa':
    default:
      return engineSA;
  }
};

/**
 * Sets the active court assignment engine.
 */
export const setEngine = (type: EngineType): void => {
  currentEngineType = type;
};

/**
 * Gets the currently active engine type.
 */
export const getEngineType = (): EngineType => currentEngineType;

/**
 * Gets the currently active engine instance.
 * Use this to access all engine methods directly.
 * 
 * @example
 * ```typescript
 * import { engine } from './engineSelector';
 * 
 * const assignments = engine.generateCourtAssignments(players, 2);
 * const stats = engine.getStats();
 * ```
 */
export const engine = (): ICourtAssignmentEngine => {
  return getEngineInstance(currentEngineType);
};

/**
 * Gets a human-readable name for the current engine.
 */
export const getEngineName = (): string => {
  switch (currentEngineType) {
    case 'cg':
      return 'Conflict Graph';
    case 'mc':
      return 'Monte Carlo';
    case 'sa':
    default:
      return 'Simulated Annealing';
  }
};

/**
 * Gets a description of the current engine's algorithm.
 */
export const getEngineDescription = (): string => {
  switch (currentEngineType) {
    case 'cg':
      return 'Deterministic greedy construction using conflict graph modeling. Systematically builds assignments by selecting players that minimize total conflict.';
    case 'mc':
      return 'Monte Carlo sampling with greedy evaluation. Generates 300 random candidate assignments and selects the one with lowest cost.';
    case 'sa':
    default:
      return 'Simulated Annealing with iterative improvement. Performs 5000 iterations, accepting worse solutions probabilistically to escape local minima.';
  }
};
