import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { preprocessImage } from '../../src/utils/imagePreprocess';

const OriginalImage = global.Image;
const OriginalFileReader = global.FileReader;

describe('preprocessImage', () => {
  const mockWidth = 200;
  const mockHeight = 100;

  beforeEach(() => {

    class MockImage {
      public width = mockWidth;
      public height = mockHeight;
      public onload: () => void = () => {};
      public onerror: () => void = () => {};
      private _src = '';
      set src(val: string) {
        this._src = val;

        setTimeout(() => this.onload());
      }
      get src() {
        return this._src;
      }
    }

    global.Image = MockImage as any;

    class MockFileReader {
      public result: string | null = null;
      public onload: () => void = () => {};
      public onerror: () => void = () => {};
      readAsDataURL(_file: Blob) {
        this.result = 'data:image/png;base64,mock';
        this.onload();
      }
    }

    global.FileReader = MockFileReader as any;

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

      return (document as any).createElement(tag);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();

    global.Image = OriginalImage;

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