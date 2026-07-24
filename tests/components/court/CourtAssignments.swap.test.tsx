import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';

import { CourtAssignments } from '../../../src/components/court';
import type { Court } from '../../../src/types';
import { createMockPlayers } from '../../data/testFactories';

const players = createMockPlayers(8);

const assignments: Court[] = [
  {
    courtNumber: 1,
    players: players.slice(0, 4),
    teams: { team1: players.slice(0, 2), team2: players.slice(2, 4) },
  },
  {
    courtNumber: 2,
    players: players.slice(4, 8),
    teams: { team1: players.slice(4, 6), team2: players.slice(6, 8) },
  },
];

function renderCourts(overrides = {}) {
  const props = {
    players,
    assignments,
    benchedPlayers: [],
    numberOfCourts: 2,
    onNumberOfCourtsChange: vi.fn(),
    onGenerateAssignments: vi.fn(),
    onWinnerChange: vi.fn(),
    onSwapPlayers: vi.fn(),
    ...overrides,
  };
  render(<CourtAssignments {...props} />);
  return props;
}

function pointFrom(id: string) {
  (document as unknown as { elementFromPoint: unknown }).elementFromPoint = () =>
    document.querySelector(`[data-slot="${id}"]`);
}

describe('CourtAssignments drag-and-drop editing', () => {
  beforeEach(() => {
    (document as unknown as { elementFromPoint: unknown }).elementFromPoint = () => null;
  });
  afterEach(cleanup);

  it('stamps a data-slot address on every player chip', () => {
    renderCourts();
    expect(document.querySelector('[data-slot="0:0"]')).not.toBeNull();
    expect(document.querySelector('[data-slot="3:1"]')).not.toBeNull();
  });

  it('calls onSwapPlayers with the dragged and dropped addresses', () => {
    const props = renderCourts();
    const source = document.querySelector('[data-slot="0:0"]')!;

    pointFrom('2:0');
    fireEvent.pointerDown(source, { pointerType: 'mouse', button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(source, { pointerType: 'mouse', clientX: 100, clientY: 0 });
    fireEvent.pointerUp(source, { pointerType: 'mouse', clientX: 100, clientY: 0 });

    expect(props.onSwapPlayers).toHaveBeenCalledWith({ group: 0, index: 0 }, { group: 2, index: 0 });
  });

  it('still selects the winner on a plain tap of a chip (gesture-split)', () => {
    const props = renderCourts();
    const chip = document.querySelector('[data-slot="0:0"]')!;
    fireEvent.click(chip);
    expect(props.onWinnerChange).toHaveBeenCalledWith(1, 1);
  });

  it('suppresses the winner click that follows a drag', () => {
    const props = renderCourts();
    const source = document.querySelector('[data-slot="0:0"]')!;

    pointFrom('2:0');
    fireEvent.pointerDown(source, { pointerType: 'mouse', button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(source, { pointerType: 'mouse', clientX: 100, clientY: 0 });
    fireEvent.pointerUp(source, { pointerType: 'mouse', clientX: 100, clientY: 0 });
    fireEvent.click(source);

    expect(props.onWinnerChange).not.toHaveBeenCalled();
  });

  it('makes bench players draggable slots too', () => {
    renderCourts({ benchedPlayers: createMockPlayers(2).map((p, i) => ({ ...p, id: `bench-${i}` })) });
    expect(document.querySelector('[data-slot="4:0"]')).not.toBeNull();
    expect(document.querySelector('[data-slot="4:1"]')).not.toBeNull();
  });

  describe('touch edit mode (tap-to-swap)', () => {
    function longPress(slot: string) {
      const chip = document.querySelector(`[data-slot="${slot}"]`)!;
      fireEvent.pointerDown(chip, { pointerType: 'touch', button: 0, clientX: 0, clientY: 0 });
      act(() => { vi.advanceTimersByTime(400); });
      fireEvent.pointerUp(chip, { pointerType: 'touch', clientX: 0, clientY: 0 });
    }

    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('enters edit mode on a long press and swaps two tapped players', () => {
      const props = renderCourts();

      longPress('0:0');
      expect(screen.getByTestId('edit-mode-banner')).toBeTruthy();

      const target = document.querySelector('[data-slot="2:0"]')!;
      fireEvent.pointerDown(target, { pointerType: 'touch', button: 0, clientX: 0, clientY: 0 });
      fireEvent.pointerUp(target, { pointerType: 'touch', clientX: 0, clientY: 0 });

      expect(props.onSwapPlayers).toHaveBeenCalledWith({ group: 0, index: 0 }, { group: 2, index: 0 });
    });

    it('suppresses the set-winner tap while in edit mode', () => {
      const props = renderCourts();
      longPress('0:0');

      fireEvent.click(within(screen.getByTestId('court-1')).getByTestId('team-1'));
      expect(props.onWinnerChange).not.toHaveBeenCalled();
    });

    it('leaves edit mode via Done', () => {
      renderCourts();
      longPress('0:0');
      fireEvent.click(screen.getByTestId('edit-mode-done'));
      expect(screen.queryByTestId('edit-mode-banner')).toBeNull();
    });
  });

  describe('Rearrange players button (discoverability)', () => {
    function tap(slot: string) {
      const chip = document.querySelector(`[data-slot="${slot}"]`)!;
      fireEvent.pointerDown(chip, { pointerType: 'touch', button: 0, clientX: 0, clientY: 0 });
      fireEvent.pointerUp(chip, { pointerType: 'touch', clientX: 0, clientY: 0 });
    }

    it('shows the Rearrange button when assignments can be edited', () => {
      renderCourts();
      expect(screen.getByTestId('rearrange-button')).toBeTruthy();
    });

    it('is hidden when there are no assignments to rearrange', () => {
      renderCourts({ assignments: [] });
      expect(screen.queryByTestId('rearrange-button')).toBeNull();
    });

    it('enters edit mode and enables tap-to-swap when clicked', () => {
      const props = renderCourts();

      fireEvent.click(screen.getByTestId('rearrange-button'));
      expect(screen.getByTestId('edit-mode-banner')).toBeTruthy();

      tap('0:0');
      tap('2:0');

      expect(props.onSwapPlayers).toHaveBeenCalledWith({ group: 0, index: 0 }, { group: 2, index: 0 });
    });

    it('toggles edit mode off when clicked again', () => {
      renderCourts();
      const button = screen.getByTestId('rearrange-button');

      fireEvent.click(button);
      expect(screen.getByTestId('edit-mode-banner')).toBeTruthy();

      fireEvent.click(button);
      expect(screen.queryByTestId('edit-mode-banner')).toBeNull();
    });
  });
});
