import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useCopyToClipboard } from '../../src/hooks/useCopyToClipboard';

describe('useCopyToClipboard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('starts with copied=false', () => {
    const { result } = renderHook(() => useCopyToClipboard());
    expect(result.current.copied).toBe(false);
  });

  it('writes the given text to the clipboard and flips copied to true', async () => {
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => { await result.current.copy('hello'); });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('hello');
    expect(result.current.copied).toBe(true);
  });

  it('resets copied to false after the default 2000ms', async () => {
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => { await result.current.copy('x'); });
    expect(result.current.copied).toBe(true);

    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current.copied).toBe(false);
  });

  it('honours a custom reset duration', async () => {
    const { result } = renderHook(() => useCopyToClipboard(500));

    await act(async () => { await result.current.copy('x'); });

    act(() => { vi.advanceTimersByTime(499); });
    expect(result.current.copied).toBe(true);

    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current.copied).toBe(false);
  });
});
