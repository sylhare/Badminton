/**
 * Engine Selector - Utility for switching between court assignment algorithms
 *
 * This module provides a unified interface for selecting and using different
 * court assignment engines. All engines implement the same API, making them
 * drop-in replacements for each other.
 *
 * Available Engines:
 * - 'sa' (default): Simulated Annealing - iterative improvements, escapes local minima
 * - 'sl': Smart Matching - Simulated Annealing with gender/level-aware cost functions
 *
 * Usage:
 * ```typescript
 * import { setEngine, getEngine, generateCourtAssignments } from './engineSelector';
 *
 * // Switch to Smart engine
 * setEngine('sl');
 *
 * // Use the unified API
 * const assignments = generateCourtAssignments(players, courts);
 * ```
 */

import type { EngineType, ICourtAssignmentEngine } from '../types';

import { engineSL } from './SmartEngine';
import { engineSA } from './SimulatedAnnealingEngine';

export type { EngineType };

/** Currently selected engine type */
let currentEngineType: EngineType = 'sa';

/**
 * Gets the engine instance for the specified type.
 */
const getEngineInstance = (type: EngineType): ICourtAssignmentEngine => {
  switch (type) {
    case 'sl':
      return engineSL;
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
 * const snapshot = engine.snapshot();
 * ```
 */
export const engine = (): ICourtAssignmentEngine => {
  return getEngineInstance(currentEngineType);
};

export class EnginePersistence {
  private unsubscribe?: () => void;
  private timer?: ReturnType<typeof setTimeout>;

  /**
   * Starts persisting engine state to storage on every engine change. A pending
   * zero-delay timer coalesces a synchronous burst of notifications into a single
   * save. Must be called only after initial load, so an early save can't clobber
   * stored data. Idempotent; returns a stop function.
   */
  start(): () => void {
    this.stop();
    this.unsubscribe = engine().onStateChange(() => {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => void engine().saveState(getEngineType()));
    });
    return () => this.stop();
  }

  /** Stops persisting engine state and cancels any pending debounced write. */
  stop(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }
}

export const enginePersistence = new EnginePersistence();

