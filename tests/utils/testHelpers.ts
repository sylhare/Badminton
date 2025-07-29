import { expect, vi } from 'vitest';
import { screen } from '@testing-library/react';

import { Player } from '../../src/App';

/**
 * Helper to assert that all players in an array are rendered in the document
 */
export function expectPlayersToBeRendered(players: Player[]): void {
  players.forEach(player => {
    expect(screen.getByText(player.name)).toBeInTheDocument();
  });
}

/**
 * Helper to assert that players are rendered in the correct order
 */
export function expectPlayersInOrder(players: Player[]): void {
  const playerNames = players.map(p => p.name);
  const regex = new RegExp(playerNames.join('|'));
  const playerElements = screen.getAllByText(regex);

  playerNames.forEach((name, index) => {
    expect(playerElements[index]).toHaveTextContent(name);
  });
}

/**
 * Helper to assert that container has no text content (empty render)
 */
export function expectEmptyRender(container: HTMLElement): void {
  expect(container.textContent).toBe('');
}

/**
 * Helper to get element by text and assert it exists
 */
export function getElementByText(text: string): HTMLElement {
  const element = screen.getByText(text);
  expect(element).toBeInTheDocument();
  return element;
}

/**
 * Helper to assert parent element has correct CSS class
 */
export function expectParentToHaveClass(text: string, className: string): void {
  const element = screen.getByText(text);
  expect(element.parentElement).toHaveClass(className);
}

/**
 * Helper to assert sibling element has correct CSS class
 */
export function expectSiblingToHaveClass(text: string, className: string): void {
  const element = screen.getByText(text);
  expect(element.nextElementSibling).toHaveClass(className);
}

/**
 * Common assertion patterns for testing different file types
 */
export const fileAssertions = {
  expectImageFile: (_mockFile: File, result: boolean): void => {
    expect(result).toBe(true);
  },

  expectNonImageFile: (_mockFile: File, result: boolean): void => {
    expect(result).toBe(false);
  },

  expectNullFile: (result: boolean): void => {
    expect(result).toBe(false);
  },
};

type MockFunction = ReturnType<typeof vi.fn>;

/**
 * Common patterns for asserting function calls
 */
export const mockAssertions = {
  expectCalled: (mockFn: MockFunction): void => {
    expect(mockFn).toHaveBeenCalled();
  },

  expectCalledWith: (mockFn: MockFunction, ...args: unknown[]): void => {
    expect(mockFn).toHaveBeenCalledWith(...args);
  },

  expectNotCalled: (mockFn: MockFunction): void => {
    expect(mockFn).not.toHaveBeenCalled();
  },

  expectCalledTimes: (mockFn: MockFunction, times: number): void => {
    expect(mockFn).toHaveBeenCalledTimes(times);
  },
};