import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { MOBILE_BREAKPOINT, useIsMobile } from '../../src/hooks/useIsMobile';

type ChangeListener = (e: MediaQueryListEvent) => void;

function mockMatchMedia(initialMatches: boolean) {
  let listener: ChangeListener | null = null;
  const mql = {
    matches: initialMatches,
    addEventListener: (_: string, cb: ChangeListener) => { listener = cb; },
    removeEventListener: vi.fn(),
  };
  window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia;
  return {
    emit: (matches: boolean) => {
      mql.matches = matches;
      listener?.({ matches } as MediaQueryListEvent);
    },
    mql,
  };
}

describe('useIsMobile', () => {
  const original = window.matchMedia;
  afterEach(() => {
    window.matchMedia = original;
    vi.restoreAllMocks();
  });

  it('returns true when the viewport matches the mobile query', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('returns false when the viewport is wider than the breakpoint', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('updates when the media query changes', () => {
    const { emit } = mockMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
    act(() => emit(true));
    expect(result.current).toBe(true);
  });

  it('queries the default breakpoint', () => {
    mockMatchMedia(false);
    renderHook(() => useIsMobile());
    expect(window.matchMedia).toHaveBeenCalledWith(`(max-width: ${MOBILE_BREAKPOINT}px)`);
  });

  it('removes its listener on unmount', () => {
    const { mql } = mockMatchMedia(false);
    const { unmount } = renderHook(() => useIsMobile());
    unmount();
    expect(mql.removeEventListener).toHaveBeenCalled();
  });
});
