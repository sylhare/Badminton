import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useShareState } from '../../src/hooks/useShareState';
import { storageManager } from '../../src/utils/StorageManager';

vi.mock('../../src/utils/StorageManager', () => ({
  storageManager: {
    getRawState: vi.fn(),
    isValidState: vi.fn(),
    importRawState: vi.fn(),
    getImportTimestamps: vi.fn().mockResolvedValue({}),
  },
}));

describe('useShareState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(storageManager.getImportTimestamps).mockResolvedValue({});
    history.replaceState(null, '', window.location.pathname);
  });

  afterEach(() => {
    history.replaceState(null, '', window.location.pathname);
  });

  describe('handleShare', () => {
    it('does not set shareUrl when storage is empty', () => {
      vi.mocked(storageManager.getRawState).mockReturnValue(null);
      const { result } = renderHook(() => useShareState());

      act(() => { result.current.handleShare(); });

      expect(result.current.shareUrl).toBeNull();
    });

    it('sets shareUrl containing ?state= when storage has data', () => {
      vi.mocked(storageManager.getRawState).mockReturnValue('abc123');
      const { result } = renderHook(() => useShareState());

      act(() => { result.current.handleShare(); });

      expect(result.current.shareUrl).toContain('?state=abc123');
    });
  });

  describe('URL detection on mount', () => {
    it('does nothing when no ?state= param in URL', async () => {
      const { result } = renderHook(() => useShareState());

      await act(async () => {});

      expect(result.current.importState).toBeNull();
      expect(storageManager.isValidState).not.toHaveBeenCalled();
    });

    it('sets importState when ?state= param is valid', async () => {
      vi.mocked(storageManager.isValidState).mockResolvedValue(true);
      vi.mocked(storageManager.getRawState).mockReturnValue('backup123');
      history.replaceState(null, '', '?state=shared456');

      const { result } = renderHook(() => useShareState());

      await waitFor(() => expect(result.current.importState).not.toBeNull());

      expect(result.current.importState?.param).toBe('shared456');
      expect(result.current.importState?.backupUrl).toContain('?state=backup123');
    });

    it('sets sharedSavedAt and currentSavedAt from getImportTimestamps', async () => {
      vi.mocked(storageManager.isValidState).mockResolvedValue(true);
      vi.mocked(storageManager.getRawState).mockReturnValue('backup123');
      vi.mocked(storageManager.getImportTimestamps).mockResolvedValue({
        sharedSavedAt: 1700000000000,
        currentSavedAt: 1700003600000,
      });
      history.replaceState(null, '', '?state=shared456');

      const { result } = renderHook(() => useShareState());

      await waitFor(() => expect(result.current.importState).not.toBeNull());

      expect(result.current.importState?.sharedSavedAt).toBe(1700000000000);
      expect(result.current.importState?.currentSavedAt).toBe(1700003600000);
    });

    it('sets empty backupUrl and no timestamps when no existing state in storage', async () => {
      vi.mocked(storageManager.isValidState).mockResolvedValue(true);
      vi.mocked(storageManager.getRawState).mockReturnValue(null);
      history.replaceState(null, '', '?state=shared456');

      const { result } = renderHook(() => useShareState());

      await waitFor(() => expect(result.current.importState).not.toBeNull());

      expect(result.current.importState?.backupUrl).toBe('');
      expect(result.current.importState?.currentSavedAt).toBeUndefined();
    });

    it('cleans ?state= from URL when param is invalid', async () => {
      vi.mocked(storageManager.isValidState).mockResolvedValue(false);
      history.replaceState(null, '', '?state=garbage');

      const { result } = renderHook(() => useShareState());

      await waitFor(() => expect(window.location.search).not.toContain('state='));

      expect(result.current.importState).toBeNull();
    });
  });

  describe('handleImportDecline', () => {
    it('clears importState and removes ?state= from URL', async () => {
      vi.mocked(storageManager.isValidState).mockResolvedValue(true);
      vi.mocked(storageManager.getRawState).mockReturnValue(null);
      history.replaceState(null, '', '?state=shared456');

      const { result } = renderHook(() => useShareState());
      await waitFor(() => expect(result.current.importState).not.toBeNull());

      act(() => { result.current.handleImportDecline(); });

      expect(result.current.importState).toBeNull();
      expect(window.location.search).not.toContain('state=');
    });
  });

  describe('handleImportAccept', () => {
    it('calls importRawState with the shared param', async () => {
      vi.mocked(storageManager.isValidState).mockResolvedValue(true);
      vi.mocked(storageManager.getRawState).mockReturnValue(null);
      history.replaceState(null, '', '?state=shared456');

      const { result } = renderHook(() => useShareState());
      await waitFor(() => expect(result.current.importState).not.toBeNull());

      act(() => { result.current.handleImportAccept(); });

      expect(storageManager.importRawState).toHaveBeenCalledWith('shared456');
    });
  });
});
