import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { computeOtsuThreshold, preprocessImage } from '../../src/utils/imagePreprocess';

describe('imagePreprocess', () => {
  describe('computeOtsuThreshold', () => {
    it('finds optimal threshold for a bimodal distribution', () => {
      const pixels = new Uint8Array(1000);
      for (let i = 0; i < 500; i++) {
        pixels[i] = 40;
      }
      for (let i = 500; i < 1000; i++) {
        pixels[i] = 220;
      }

      const threshold = computeOtsuThreshold(pixels);
      expect(threshold).toBeGreaterThanOrEqual(40);
      expect(threshold).toBeLessThan(220);
    });

    it('returns a valid threshold for uniform image data', () => {
      const pixels = new Uint8Array(100).fill(128);
      const threshold = computeOtsuThreshold(pixels);
      expect(typeof threshold).toBe('number');
      expect(threshold).toBeGreaterThanOrEqual(0);
      expect(threshold).toBeLessThanOrEqual(255);
    });
  });

  describe('preprocessImage', () => {
    let originalCreateObjectURL: typeof URL.createObjectURL;
    let originalRevokeObjectURL: typeof URL.revokeObjectURL;
    let revokedUrls: string[];

    beforeEach(() => {
      revokedUrls = [];
      originalCreateObjectURL = URL.createObjectURL;
      originalRevokeObjectURL = URL.revokeObjectURL;

      URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      URL.revokeObjectURL = vi.fn((url: string) => {
        revokedUrls.push(url);
      });
    });

    afterEach(() => {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      vi.restoreAllMocks();
    });

    function createMockImage(options: { width?: number; height?: number; shouldFail?: boolean } = {}) {
      const { width = 400, height = 300, shouldFail = false } = options;
      return class MockImage {
        width = width;
        height = height;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_val: string) {
          setTimeout(() => {
            if (shouldFail) {
              this.onerror?.();
            } else {
              this.onload?.();
            }
          }, 0);
        }
      };
    }

    function mockCanvasContext() {
      const mockGetImageData = vi.fn((_sx, _sy, sw, sh) => ({
        data: new Uint8ClampedArray(sw * sh * 4),
        width: sw,
        height: sh,
      }));
      const mockPutImageData = vi.fn();
      const mockDrawImage = vi.fn();

      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        const el = originalCreateElement(tagName);
        if (tagName === 'canvas') {
          (el as any).getContext = vi.fn(() => ({
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high',
            drawImage: mockDrawImage,
            getImageData: mockGetImageData,
            putImageData: mockPutImageData,
          }));
        }
        return el;
      });

      return { mockGetImageData, mockPutImageData, mockDrawImage };
    }

    it('decodes an image, applies Canvas preprocessing, and revokes the object URL', async () => {
      const originalImage = globalThis.Image;
      globalThis.Image = createMockImage() as any;
      const { mockGetImageData, mockPutImageData, mockDrawImage } = mockCanvasContext();

      try {
        const file = new File(['mock'], 'test.png', { type: 'image/png' });
        const canvas = await preprocessImage(file);

        expect(canvas).toBeInstanceOf(HTMLCanvasElement);
        expect(revokedUrls).toContain('blob:mock-url');
        expect(mockDrawImage).toHaveBeenCalled();
        expect(mockGetImageData).toHaveBeenCalled();
        expect(mockPutImageData).toHaveBeenCalled();
      } finally {
        globalThis.Image = originalImage;
      }
    });

    it('preserves aspect ratio when scaling non-square images', async () => {
      const originalImage = globalThis.Image;
      globalThis.Image = createMockImage({ width: 2000, height: 1000 }) as any;
      mockCanvasContext();

      try {
        const blob = new Blob(['mock'], { type: 'image/png' });
        const canvas = await preprocessImage(blob);

        expect(canvas.width / canvas.height).toBeCloseTo(2.0, 2);
        expect(canvas.width).toBeLessThanOrEqual(2500);
        expect(canvas.height).toBeLessThanOrEqual(2500);
      } finally {
        globalThis.Image = originalImage;
      }
    });

    it('rejects corrupt images on error and still revokes the object URL', async () => {
      const originalImage = globalThis.Image;
      globalThis.Image = createMockImage({ shouldFail: true }) as any;

      try {
        const file = new File(['corrupt-bytes'], 'corrupt.png', { type: 'image/png' });
        await expect(preprocessImage(file)).rejects.toThrow('Failed to load image');
        expect(revokedUrls).toContain('blob:mock-url');
      } finally {
        globalThis.Image = originalImage;
      }
    });
  });
});
