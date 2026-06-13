import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useAnalytics } from '../../src/hooks/useAnalytics';

describe('useAnalytics', () => {
  let gtag: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    gtag = vi.fn();
    window.gtag = gtag;
  });

  afterEach(() => {
    delete (window as { gtag?: unknown }).gtag;
  });

  describe('trackGameAction', () => {
    it('uses gameType as the label when provided', () => {
      const { result } = renderHook(() => useAnalytics());

      result.current.trackGameAction('set_winner', { gameType: 'with_score', courtNumber: 2 });

      expect(gtag).toHaveBeenCalledWith('event', 'set_winner', {
        event_category: 'Game Management',
        event_label: 'with_score',
        value: 2,
      });
    });

    it('falls back to a court label when only courtNumber is provided', () => {
      const { result } = renderHook(() => useAnalytics());

      result.current.trackGameAction('rotate_teams', { courtNumber: 3 });

      expect(gtag).toHaveBeenCalledWith('event', 'rotate_teams', {
        event_category: 'Game Management',
        event_label: 'Court 3',
        value: 3,
      });
    });

    it('omits the label when no details are provided', () => {
      const { result } = renderHook(() => useAnalytics());

      result.current.trackGameAction('reset_algorithm');

      expect(gtag).toHaveBeenCalledWith('event', 'reset_algorithm', {
        event_category: 'Game Management',
        event_label: undefined,
        value: undefined,
      });
    });
  });
});
