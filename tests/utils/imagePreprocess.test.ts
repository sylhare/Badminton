import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { preprocessImage } from '../../src/utils/imagePreprocess';

// Save originals so we can restore them after tests
const OriginalImage = global.Image;
const OriginalFileReader = global.FileReader;

describe('preprocessImage', () => {
  const mockWidth = 200;
  const mockHeight = 100;

  beforeEach(() => {
    // Mock global Image
    class MockImage {
      public width = mockWidth;
      public height = mockHeight;
      public onload: () => void = () => {};
      public onerror: () => void = () => {};
      private _src = '';
      set src(val: string) {
        this._src = val;
        // simulate async load
        setTimeout(() => this.onload());
      }
      get src() {
        return this._src;
      }
    }
    // @ts-ignore
    global.Image = MockImage as any;

    // Mock FileReader
    class MockFileReader {
      public result: string | null = null;
      public onload: () => void = () => {};
      public onerror: () => void = () => {};
      readAsDataURL(_file: Blob) {
        this.result = 'data:image/png;base64,mock';
        this.onload();
      }
    }
    // @ts-ignore
    global.FileReader = MockFileReader as any;

    // Mock canvas element
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => ({
            imageSmoothingEnabled: false,
            imageSmoothingQuality: 'high',
            drawImage: vi.fn(),
            getImageData: vi.fn().mockReturnValue({
              data: new Uint8ClampedArray(mockWidth * mockHeight * 4 * 2),
            }),
            putImageData: vi.fn(),
          }),
        } as unknown as HTMLCanvasElement;
      }
      // default behaviour
      // @ts-ignore
      return (document as any).createElement(tag);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // @ts-ignore
    global.Image = OriginalImage;
    // @ts-ignore
    global.FileReader = OriginalFileReader;
  });

  it('upscales the image and returns a canvas', async () => {
    const scale = 1.5;
    const file = new File([new Uint8Array([1, 2, 3])], 'test.png', { type: 'image/png' });

    const canvas = await preprocessImage(file, scale);

    expect(canvas.width).toBeCloseTo(mockWidth * scale);
    expect(canvas.height).toBeCloseTo(mockHeight * scale);
  });
});