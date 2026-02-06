import { expect, vi } from 'vitest';
import { screen } from '@testing-library/react';

import type { Player } from '../../src/types';

import { GRAPH_COLORS, GRAPH_LEGEND_LABELS } from './testFactories';

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

/** Assertions and helpers for graph component tests */
export const graphAssertions = {
  /** Asserts that the container is empty (component returned null) */
  expectEmptyGraph: (container: HTMLElement): void => {
    expect(container).toBeEmptyDOMElement();
  },

  /** Asserts that an SVG element is rendered */
  expectSvgRendered: (): SVGSVGElement => {
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
    return svg!;
  },

  /** Asserts that the legend contains all standard labels */
  expectLegendRendered: (): void => {
    const legend = document.querySelector('.graph-legend');
    expect(legend).toBeInTheDocument();
    GRAPH_LEGEND_LABELS.forEach(label => {
      expect(legend?.textContent).toContain(label);
    });
  },

  /** Asserts that all four count-based colors are present in circle strokes */
  expectAllCountColors: (): void => {
    const circles = document.querySelectorAll('circle');
    const strokes = Array.from(circles)
      .filter(c => c.getAttribute('fill') === GRAPH_COLORS.nodeFill)
      .map(c => c.getAttribute('stroke'));

    expect(strokes).toContain(GRAPH_COLORS.count1);
    expect(strokes).toContain(GRAPH_COLORS.count2);
    expect(strokes).toContain(GRAPH_COLORS.count3);
    expect(strokes).toContain(GRAPH_COLORS.count4Plus);
  },

  /** Asserts that a glow circle (fill='none') is rendered */
  expectGlowCircle: (): void => {
    const circles = document.querySelectorAll('circle');
    const glowCircle = Array.from(circles).find(c => c.getAttribute('fill') === 'none');
    expect(glowCircle).toBeInTheDocument();
  },

  /** Asserts minimum number of groups for grid layout */
  expectGridLayout: (minGroups: number): void => {
    const groups = document.querySelectorAll('g');
    expect(groups.length).toBeGreaterThanOrEqual(minGroups);
  },

  /** Gets all line elements (edges) from the SVG */
  getEdges: (): NodeListOf<SVGLineElement> => {
    return document.querySelectorAll('line');
  },

  /** Gets all circle elements with the standard node fill color */
  getNodeCircles: (): SVGCircleElement[] => {
    return Array.from(document.querySelectorAll('circle'))
      .filter(c => c.getAttribute('fill') === GRAPH_COLORS.nodeFill) as SVGCircleElement[];
  },

  /** Gets all stroke colors from node circles */
  getNodeStrokes: (): (string | null)[] => {
    return graphAssertions.getNodeCircles().map(c => c.getAttribute('stroke'));
  },
};