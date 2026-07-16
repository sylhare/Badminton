import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { useSlotSwap } from '../../src/hooks/useSlotSwap';
import type { SlotSwapTouchMode } from '../../src/hooks/useSlotSwap';
import type { SlotAddr } from '../../src/utils/slotSwap';

const GROUPS = [['a', 'b'], ['c', 'd']];

interface HarnessProps {
  onSwap: (from: SlotAddr, to: SlotAddr) => void;
  touch?: SlotSwapTouchMode;
}

const Harness: React.FC<HarnessProps> = ({ onSwap, touch }) => {
  const swap = useSlotSwap({ onSwap, touch });
  return (
    <div>
      {GROUPS.map((group, gi) => {
        const binding = swap.binding(index => ({ group: gi, index }));
        return group.map((item, ii) => (
          <div key={item} data-testid={item} className={binding.stateClass(ii)} {...binding.getProps(ii)}>
            {item}
          </div>
        ));
      })}
      {swap.isEditMode ? <span data-testid="edit-on" /> : null}
      {swap.dragGhost}
    </div>
  );
};

function tap(id: string, pointerType: 'mouse' | 'touch' = 'mouse') {
  const el = screen.getByTestId(id);
  fireEvent.pointerDown(el, { pointerType, button: 0, clientX: 0, clientY: 0 });
  fireEvent.pointerUp(el, { pointerType, clientX: 0, clientY: 0 });
}

describe('useSlotSwap', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('touch mode: tap', () => {
    it('selects on the first tap and swaps on the second, bumping both slots', () => {
      vi.useFakeTimers();
      const onSwap = vi.fn();
      render(<Harness onSwap={onSwap} touch="tap" />);

      tap('a');
      expect(screen.getByTestId('a').className).toContain('swap-selected');

      tap('c');
      expect(onSwap).toHaveBeenCalledWith({ group: 0, index: 0 }, { group: 1, index: 0 });
      expect(screen.getByTestId('a').className).toContain('slot-bumped');
      expect(screen.getByTestId('c').className).toContain('slot-bumped');
      expect(screen.getByTestId('a').className).not.toContain('swap-selected');

      act(() => { vi.advanceTimersByTime(400); });
      expect(screen.getByTestId('a').className).not.toContain('slot-bumped');
      expect(screen.getByTestId('c').className).not.toContain('slot-bumped');
    });

    it('tapping the same slot twice deselects without swapping', () => {
      const onSwap = vi.fn();
      render(<Harness onSwap={onSwap} touch="tap" />);

      tap('a');
      expect(screen.getByTestId('a').className).toContain('swap-selected');
      tap('a');
      expect(screen.getByTestId('a').className).not.toContain('swap-selected');
      expect(onSwap).not.toHaveBeenCalled();
    });
  });

  it('fires onSwap exactly once under StrictMode (no double-invoke cancel-out)', () => {
    const onSwap = vi.fn();
    render(
      <React.StrictMode>
        <Harness onSwap={onSwap} touch="tap" />
      </React.StrictMode>,
    );

    tap('a');
    tap('c');

    expect(onSwap).toHaveBeenCalledTimes(1);
    expect(onSwap).toHaveBeenCalledWith({ group: 0, index: 0 }, { group: 1, index: 0 });
  });

  describe('touch mode: edit-mode', () => {
    it('ignores a plain touch tap until a long press opens edit mode', () => {
      const onSwap = vi.fn();
      render(<Harness onSwap={onSwap} touch="edit-mode" />);

      tap('a', 'touch');
      expect(screen.queryByTestId('edit-on')).toBeNull();
      expect(screen.getByTestId('a').className).not.toContain('swap-selected');
      expect(onSwap).not.toHaveBeenCalled();
    });

    it('enters edit mode and picks up the pressed chip on a long press, then swaps on a tap', () => {
      vi.useFakeTimers();
      const onSwap = vi.fn();
      render(<Harness onSwap={onSwap} touch="edit-mode" />);

      const a = screen.getByTestId('a');
      fireEvent.pointerDown(a, { pointerType: 'touch', button: 0, clientX: 0, clientY: 0 });
      act(() => { vi.advanceTimersByTime(400); });
      expect(screen.getByTestId('edit-on')).toBeTruthy();
      expect(screen.getByTestId('a').className).toContain('swap-selected');
      fireEvent.pointerUp(a, { pointerType: 'touch', clientX: 0, clientY: 0 });

      tap('c', 'touch');
      expect(onSwap).toHaveBeenCalledWith({ group: 0, index: 0 }, { group: 1, index: 0 });
    });
  });
});
