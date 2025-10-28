import { expect, vi } from 'vitest';
import { screen } from '@testing-library/react';

import type { Player } from '../../src/types';

export function expectPlayersToBeRendered(players: Player[]): void {
  players.forEach(player => {
    expect(screen.getByText(player.name)).toBeInTheDocument();
  });
}

export function expectPlayersInOrder(players: Player[]): void {
  const playerNames = players.map(p => p.name);
  const regex = new RegExp(playerNames.join('|'));
  const playerElements = screen.getAllByText(regex);

  playerNames.forEach((name, index) => {
    expect(playerElements[index]).toHaveTextContent(name);
  });
}

export function expectEmptyRender(container: HTMLElement): void {
  expect(container.textContent).toBe('');
}

export function getElementByText(text: string): HTMLElement {
  const element = screen.getByText(text);
  expect(element).toBeInTheDocument();
  return element;
}

export function expectParentToHaveClass(text: string, className: string): void {
  const element = screen.getByText(text);
  expect(element.parentElement).toHaveClass(className);
}

export function expectSiblingToHaveClass(text: string, className: string): void {
  const element = screen.getByText(text);
  expect(element.nextElementSibling).toHaveClass(className);
}

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