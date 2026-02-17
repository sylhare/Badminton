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

import type { EngineType, ICourtAssignmentEngine } from '../types';

import { engineMC } from './MonteCarloEngine';
import { engineSA } from './SimulatedAnnealingEngine';
import { engineCG } from './ConflictGraphEngine';

export type { EngineType };

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

