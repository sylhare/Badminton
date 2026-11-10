import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';

import { useImageOcr } from '../../src/hooks/useImageOcr';
import * as ocrEngine from '../../src/utils/ocrEngine';

vi.mock('../../src/utils/ocrEngine', () => ({
  recognizePlayerNames: vi.fn(),
  isOcrSupported: vi.fn(() => true),
}));

describe('useImageOcr hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports isSupported correctly', () => {
    let hookApi: ReturnType<typeof useImageOcr> | undefined;

    function TestComponent() {
      hookApi = useImageOcr({ onPlayersExtracted: vi.fn() });
      return null;
    }

    render(<TestComponent />);
    expect(hookApi?.isSupported).toBe(true);
  });

  it('processes image and returns extracted player names', async () => {
    const mockRecognizePlayerNames = vi.mocked(ocrEngine.recognizePlayerNames);
    mockRecognizePlayerNames.mockImplementation((_, options) => {
      if (options?.onProgress) {
        options.onProgress(0.5);
        options.onProgress(1.0);
      }
      return Promise.resolve(['Alice', 'Bob']);
    });
    const file = new File(['fake'], 'test.png', { type: 'image/png' });
    const onPlayersExtracted = vi.fn();
    let hookApi: ReturnType<typeof useImageOcr> | undefined;

    function TestComponent() {
      hookApi = useImageOcr({ onPlayersExtracted });
      return null;
    }

    render(<TestComponent />);
    expect(hookApi).toBeTruthy();

    await act(async () => await hookApi!.processImage(file));

    expect(mockRecognizePlayerNames).toHaveBeenCalledWith(file, expect.objectContaining({
      onProgress: expect.any(Function),
    }));
    expect(onPlayersExtracted).toHaveBeenCalledWith(['Alice', 'Bob']);
  });

  it('handles OCR errors gracefully and resets isProcessing', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const mockRecognizePlayerNames = vi.mocked(ocrEngine.recognizePlayerNames);
    mockRecognizePlayerNames.mockRejectedValue(new Error('OCR failed'));

    const file = new File(['fake'], 'test.png', { type: 'image/png' });
    const onPlayersExtracted = vi.fn();
    let hookApi: ReturnType<typeof useImageOcr> | undefined;

    function TestComponent() {
      hookApi = useImageOcr({ onPlayersExtracted });
      return null;
    }

    render(<TestComponent />);
    await act(async () => await hookApi!.processImage(file));

    expect(hookApi?.isProcessing).toBe(false);
    expect(onPlayersExtracted).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith('OCR processing failed:', expect.any(Error));
    expect(alertSpy).toHaveBeenCalledWith('Failed to process image. Please try again or enter players manually.');

    consoleErrorSpy.mockRestore();
    alertSpy.mockRestore();
  });
});