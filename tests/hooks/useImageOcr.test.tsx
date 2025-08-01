import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { createWorker } from 'tesseract.js';

import { useImageOcr } from '../../src/hooks/useImageOcr';

vi.mock('tesseract.js', () => ({
  createWorker: vi.fn(),
}));

vi.mock('../../src/utils/imagePreprocess', () => ({
  preprocessImage: vi.fn((file: File) => Promise.resolve(file)),
}));

const mockCreateWorker = vi.mocked(createWorker);

describe('useImageOcr hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('processes image and returns extracted player names', async () => {
    const mockWorker = {
      loadLanguage: vi.fn().mockResolvedValue(undefined),
      initialize: vi.fn().mockResolvedValue(undefined),
      recognize: vi.fn().mockResolvedValue({
        data: {
          text: 'Alice\nBob\n',
        },
      }),
      terminate: vi.fn().mockResolvedValue(undefined),
    };

    mockCreateWorker.mockResolvedValue(mockWorker as any);

    const onPlayersExtracted = vi.fn();
    let hookApi: ReturnType<typeof useImageOcr> | undefined;

    function TestComponent() {
      hookApi = useImageOcr({ onPlayersExtracted });
      return null;
    }

    render(<TestComponent />);

    const file = new File(['fake'], 'test.png', { type: 'image/png' });

    expect(hookApi).toBeTruthy();

    await act(async () => {
      await hookApi!.processImage(file);
    });

    expect(mockCreateWorker).toHaveBeenCalledWith('eng');
    expect(mockWorker.recognize).toHaveBeenCalledWith(file);
    expect(mockWorker.terminate).toHaveBeenCalled();
    expect(onPlayersExtracted).toHaveBeenCalledWith(['Alice', 'Bob']);
  });
});