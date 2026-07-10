import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { decodeSlot, encodeSlot, useSlotDragSwap } from '../../src/hooks/useSlotDragSwap';
import type { SlotAddr } from '../../src/utils/slotSwap';

describe('encodeSlot / decodeSlot', () => {
  it('round-trips an address', () => {
    expect(encodeSlot({ group: 2, index: 3 })).toBe('2:3');
    expect(decodeSlot('2:3')).toEqual({ group: 2, index: 3 });
  });

  it('returns null for malformed input', () => {
    expect(decodeSlot(null)).toBeNull();
    expect(decodeSlot('')).toBeNull();
    expect(decodeSlot('x:y')).toBeNull();
  });
});

interface HarnessProps {
  onSwap: (from: SlotAddr, to: SlotAddr) => void;
  onTap?: (addr: SlotAddr) => void;
}

// Two groups of two items: a,b | c,d
const GROUPS = [['a', 'b'], ['c', 'd']];

const Harness: React.FC<HarnessProps> = ({ onSwap, onTap }) => {
  const { getSlotProps, slotState } = useSlotDragSwap({ onSwap, onTap, longPressMs: 300 });
  return (
    <div>
      {GROUPS.map((group, gi) =>
        group.map((item, ii) => {
          const addr = { group: gi, index: ii };
          const st = slotState(addr);
          return (
            <div key={item} data-testid={item} {...getSlotProps(addr)}>
              {item}
              {st.isDragging ? ' drag' : ''}
              {st.isDropTarget ? ' over' : ''}
              {st.isArmed ? ' armed' : ''}
            </div>
          );
        }),
      )}
    </div>
  );
};

describe('useSlotDragSwap gestures', () => {
  let elementFromPoint: (id: string) => void;

  beforeEach(() => {
    const mock = vi.fn<(x: number, y: number) => Element | null>(() => null);
    // jsdom does not implement elementFromPoint; define it, then steer per-test.
    (document as unknown as { elementFromPoint: unknown }).elementFromPoint = mock;
    elementFromPoint = (id: string) => mock.mockImplementation(() => screen.getByTestId(id));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('swaps via a mouse drag onto another slot', () => {
    const onSwap = vi.fn();
    render(<Harness onSwap={onSwap} />);
    const a = screen.getByTestId('a');

    elementFromPoint('c');
    fireEvent.pointerDown(a, { pointerType: 'mouse', button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(a, { pointerType: 'mouse', clientX: 100, clientY: 0 });
    fireEvent.pointerUp(a, { pointerType: 'mouse', clientX: 100, clientY: 0 });

    expect(onSwap).toHaveBeenCalledWith({ group: 0, index: 0 }, { group: 1, index: 0 });
  });

  it('reports a plain click as a tap, not a swap', () => {
    const onSwap = vi.fn();
    const onTap = vi.fn();
    render(<Harness onSwap={onSwap} onTap={onTap} />);
    const a = screen.getByTestId('a');

    fireEvent.pointerDown(a, { pointerType: 'mouse', button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerUp(a, { pointerType: 'mouse', clientX: 0, clientY: 0 });

    expect(onTap).toHaveBeenCalledWith({ group: 0, index: 0 });
    expect(onSwap).not.toHaveBeenCalled();
  });

  it('requires a long press before a touch drag arms', () => {
    vi.useFakeTimers();
    const onSwap = vi.fn();
    render(<Harness onSwap={onSwap} />);
    const a = screen.getByTestId('a');

    elementFromPoint('c');
    fireEvent.pointerDown(a, { pointerType: 'touch', button: 0, clientX: 0, clientY: 0 });
    // Long press elapses -> armed.
    act(() => { vi.advanceTimersByTime(300); });
    expect(screen.getByTestId('a').textContent).toContain('armed');

    fireEvent.pointerMove(a, { pointerType: 'touch', clientX: 100, clientY: 0 });
    fireEvent.pointerUp(a, { pointerType: 'touch', clientX: 100, clientY: 0 });

    expect(onSwap).toHaveBeenCalledWith({ group: 0, index: 0 }, { group: 1, index: 0 });
  });

  it('treats touch movement before the long press as a scroll (no swap)', () => {
    vi.useFakeTimers();
    const onSwap = vi.fn();
    const onTap = vi.fn();
    render(<Harness onSwap={onSwap} onTap={onTap} />);
    const a = screen.getByTestId('a');

    fireEvent.pointerDown(a, { pointerType: 'touch', button: 0, clientX: 0, clientY: 0 });
    // Move before the long press fires -> scroll, gesture cancelled.
    fireEvent.pointerMove(a, { pointerType: 'touch', clientX: 100, clientY: 0 });
    vi.advanceTimersByTime(300);
    fireEvent.pointerUp(a, { pointerType: 'touch', clientX: 100, clientY: 0 });

    expect(onSwap).not.toHaveBeenCalled();
    expect(onTap).not.toHaveBeenCalled();
  });
});
