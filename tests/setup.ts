import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

/**
 * Mock CompressionStream / DecompressionStream with pass-through transforms.
 *
 * Node.js's native CompressionStream (gzip) uses libuv I/O worker threads, so
 * its internal reads resolve via I/O callbacks rather than microtasks. This
 * breaks React Testing Library's act() model, because state updates triggered
 * by storage reads/writes happen *between* act() polling intervals rather than
 * inside them — causing both spurious "not wrapped in act()" warnings and real
 * race conditions where localStorage is read before a concurrent save finishes.
 *
 * The mocks below are pure JS TransformStreams that pass data through unchanged.
 * Their readable/writable streams use Web Streams API, which in Node.js resolves
 * via microtasks — making them transparently compatible with act() and waitFor().
 * The compress/decompress functions in StorageManager still base64-encode the
 * result, so data round-trips correctly; real gzip compression isn't needed in
 * tests.
 */
class MockTransformStream {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;

  constructor() {
    let ctrl!: ReadableStreamDefaultController<Uint8Array>;
    this.readable = new ReadableStream<Uint8Array>({ start(c) { ctrl = c; } });
    this.writable = new WritableStream<Uint8Array>({
      write(chunk) { ctrl.enqueue(chunk); },
      close() { ctrl.close(); },
    });
  }
}

globalThis.CompressionStream = class MockCompressionStream extends MockTransformStream {
  constructor(_format: string) { super(); }
} as unknown as typeof CompressionStream;

globalThis.DecompressionStream = class MockDecompressionStream extends MockTransformStream {
  constructor(_format: string) { super(); }
} as unknown as typeof DecompressionStream;

afterEach(async () => {
  cleanup();
  await new Promise(resolve => setTimeout(resolve, 0));
});

if (typeof HTMLCanvasElement !== 'undefined') {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    value: vi.fn(() => ({
      clearRect: vi.fn(),
      fillStyle: '',
      globalAlpha: 1,
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      beginPath: vi.fn(),
      roundRect: vi.fn(),
      fill: vi.fn(),
    })),
  });
}

/**
 * Mock requestAnimationFrame and cancelAnimationFrame (only in browser environment).
 * Uses writable and configurable properties so vi.useFakeTimers() can override them.
 */
if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'undefined') {
  Object.defineProperty(window, 'requestAnimationFrame', {
    writable: true,
    configurable: true,
    value: vi.fn((cb) => setTimeout(cb, 16)),
  });
}

if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'undefined') {
  Object.defineProperty(window, 'cancelAnimationFrame', {
    writable: true,
    configurable: true,
    value: vi.fn((id) => clearTimeout(id)),
  });
}

/** Mock window dimensions for canvas sizing */
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: 1024,
  });

  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: 768,
  });
}