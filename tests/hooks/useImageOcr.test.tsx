import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import '@testing-library/jest-dom';

import { useImageOcr } from '../../src/hooks/useImageOcr';
import * as ocrEngine from '../../src/utils/ocrEngine';

vi.mock('../../src/utils/ocrEngine', () => ({
  recognizePlayerNames: vi.fn(),
}));

describe('useImageOcr hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});